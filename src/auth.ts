import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import open from 'open'
import { apiRequest, apiUrl } from './api.js'
import { saveWorkspaceCredentials } from './config.js'
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

export async function login(): Promise<void> {
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
    throw new Error('No authorization URL returned')
  }

  console.log('Opening browser for authentication...')
  console.log(`If the browser doesn't open, visit: ${authResponse.authorization_url}`)
  await open(authResponse.authorization_url)

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
        res.end('<html><body><h1>Login successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>')
        clearTimeout(timeout)
        server.close()
        resolve(authCode)
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Login failed</h1><p>No authorization code received.</p></body></html>')
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
}
