import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import open from 'open'
import { apiRequest, apiUrl } from './api.js'
import { renderErrorPage, renderSuccessPage } from './auth-pages.js'
import { saveWorkspaceCredentials } from './config.js'
import { isHeadless } from './headless.js'
import { CLI_VERSION } from './version.js'

function generateCodeVerifier(): string {
  return randomBytes(64).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  session_uuid: string
  access_token_expires_in: number
  scopes?: string[]
}

interface DeviceAuthorizationResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface LoginOptions {
  noBrowser?: boolean
}

export async function login(options: LoginOptions = {}): Promise<void> {
  if (options.noBrowser || isHeadless()) {
    await loginViaDeviceCode()
  } else {
    await loginViaBrowser()
  }
}

// Default flow for machines with a local browser: spin up a temporary loopback
// listener and complete the PKCE authorization-code flow in the browser.
async function loginViaBrowser(): Promise<void> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Find an available port
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start local server')
  }
  const port = address.port
  const redirectUri = `http://127.0.0.1:${port}/callback`

  // Get authorization URL
  const authResponse = await apiRequest<{ authorization_url?: string }>('api/auth/get_authorization_url', {
    body: {
      client_id: 'cirrux-cli',
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    },
  })

  if (!authResponse.authorization_url) {
    server.close()
    throw new Error('No authorization URL returned')
  }

  console.log('Opening browser for authentication...')
  console.log(`If the browser doesn't open, visit: ${authResponse.authorization_url}`)
  try {
    await open(authResponse.authorization_url)
  } catch {
    // No browser launcher available (e.g. a headless server). The URL is
    // already printed above; keep waiting in case the user opens it manually.
    console.log(
      "Couldn't open a browser automatically. Open the URL above, or re-run with `cirrux login --no-browser` on remote machines.",
    )
  }

  // Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('Login timed out after 5 minutes'))
    }, 5 * 60 * 1000)

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      const authCode = url.searchParams.get('code')

      if (authCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(renderSuccessPage())
        clearTimeout(timeout)
        server.close()
        resolve(authCode)
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(renderErrorPage('No authorization code received. Please try again.'))
      }
    })
  })

  // Exchange code for tokens
  const tokenResponse = await apiRequest<TokenResponse>('api/auth/token', {
    body: {
      code,
      code_verifier: codeVerifier,
      metadata: {
        app_version: CLI_VERSION,
      },
    },
  })

  await finishLogin(tokenResponse)
}

// Headless flow (OAuth 2.0 Device Authorization Grant, RFC 8628): the user
// opens a verification URL on any device and types a short code; meanwhile the
// CLI polls until the authorization is approved. No inbound redirect required.
async function loginViaDeviceCode(): Promise<void> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const device = await apiRequest<DeviceAuthorizationResponse>('api/auth/device_authorization', {
    body: {
      client_id: 'cirrux-cli',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    },
  })

  console.log('\nTo sign in, open this URL in a browser on any device:\n')
  console.log(`    ${device.verification_uri}\n`)
  console.log('and enter the code:\n')
  console.log(`    ${device.user_code}\n`)
  console.log('Waiting for you to authorize...')

  const tokenResponse = await pollForDeviceToken({ device, codeVerifier })

  await finishLogin(tokenResponse)
}

async function pollForDeviceToken({
  device,
  codeVerifier,
}: {
  device: DeviceAuthorizationResponse
  codeVerifier: string
}): Promise<TokenResponse> {
  const deadline = Date.now() + device.expires_in * 1000
  let intervalMs = device.interval * 1000

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))

    // The endpoint always responds 200: either the token bundle, or a body with
    // an RFC 8628 `error` code telling us to keep waiting (or to stop).
    const result = await apiRequest<Partial<TokenResponse> & { error?: string }>('api/auth/device_token', {
      body: {
        client_id: 'cirrux-cli',
        device_code: device.device_code,
        code_verifier: codeVerifier,
        metadata: {
          app_version: CLI_VERSION,
        },
      },
    })

    if (result.access_token) {
      return result as TokenResponse
    }

    if (result.error === 'authorization_pending') {
      continue
    }
    if (result.error === 'slow_down') {
      // RFC 8628: back off by 5 seconds on each slow_down response.
      intervalMs += 5000
      continue
    }
    if (result.error === 'access_denied') {
      throw new Error('Authorization was denied.')
    }
    if (result.error === 'expired_token') {
      throw new Error('The code expired before authorization completed. Please run `cirrux login` again.')
    }
    throw new Error(`Login failed: ${result.error ?? 'unknown error'}`)
  }

  throw new Error('The code expired before authorization completed. Please run `cirrux login` again.')
}

// Shared tail for both login flows: resolve the workspace, persist credentials,
// and print a confirmation.
async function finishLogin(tokenResponse: TokenResponse): Promise<void> {
  // We need to get workspace info from the token's grant
  // For now, fetch the profile to get workspace details
  const profile = await apiRequest<{
    user?: { uuid: string; username: string; first_name: string; last_name: string }
    workspace?: { uuid: string; name: string }
  }>('public_api/v1/user/profile', {
    token: tokenResponse.access_token,
  })

  if (!profile.workspace) {
    throw new Error('No workspace associated with this login. The grant may not have a workspace.')
  }

  saveWorkspaceCredentials({
    workspace_uuid: profile.workspace.uuid,
    workspace_name: profile.workspace.name,
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    session_uuid: tokenResponse.session_uuid,
    scopes: tokenResponse.scopes,
    api_url: apiUrl(),
  })

  console.log(`\nLogged in successfully!`)
  console.log(`Workspace: ${profile.workspace.name}`)
  if (profile.user) {
    console.log(`User: ${profile.user.first_name} ${profile.user.last_name} (${profile.user.username})`)
  }
  if (tokenResponse.scopes && tokenResponse.scopes.length > 0) {
    console.log(`Scopes: ${tokenResponse.scopes.join(', ')}`)
  }
}
