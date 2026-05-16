import { getActiveCredentials, saveWorkspaceCredentials } from './config.js'

const DEFAULT_API_URL = 'https://api.cirrux.co/'

export function apiUrl(): string {
  return process.env.CIRRUX_API_URL ?? DEFAULT_API_URL
}

export class ApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`)
    this.status = status
    this.body = body
  }
}

export class AuthRefreshFailedError extends Error {
  constructor(message = 'Session expired. Run `cirrux login` to sign in again.') {
    super(message)
  }
}

function coAuthorHeader(): Record<string, string> {
  const coAuthor = process.env.CIRRUX_CO_AUTHOR?.trim()
  return coAuthor ? { 'X-Cirrux-Co-Author': coAuthor } : {}
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    token?: string
  } = {},
): Promise<T> {
  const url = new URL(path, apiUrl())
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...coAuthorHeader(),
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ApiError(response.status, errorBody)
  }

  return response.json() as Promise<T>
}

export async function apiRequestRaw(
  path: string,
  options: {
    token?: string
  } = {},
): Promise<{ body: Buffer; contentType: string }> {
  const url = new URL(path, apiUrl())
  const headers: Record<string, string> = {
    ...coAuthorHeader(),
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ApiError(response.status, errorBody)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'

  return { body: buffer, contentType }
}

interface RefreshTokenResponse {
  access_token: string
  refresh_token?: string
  session_uuid?: string
  access_token_expires_in?: number
  scopes?: string[]
}

// De-duplicates concurrent refreshes: if multiple authed requests 401 at the
// same time, they all await the same in-flight refresh rather than each firing
// their own (which would invalidate each other via token rotation).
let refreshPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  const creds = getActiveCredentials()
  if (!creds) {
    throw new AuthRefreshFailedError('Not logged in.')
  }

  let response: RefreshTokenResponse
  try {
    response = await apiRequest<RefreshTokenResponse>('api/auth/refresh_token', {
      body: { refresh_token: creds.refresh_token },
    })
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 422)) {
      throw new AuthRefreshFailedError()
    }
    throw err
  }

  saveWorkspaceCredentials({
    ...creds,
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? creds.refresh_token,
    session_uuid: response.session_uuid ?? creds.session_uuid,
    scopes: response.scopes ?? creds.scopes,
  })
}

async function withAccessToken<T>(run: (token: string) => Promise<T>): Promise<T> {
  const creds = getActiveCredentials()
  if (!creds) {
    throw new AuthRefreshFailedError('Not logged in.')
  }

  try {
    return await run(creds.access_token)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) {
      throw err
    }

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    await refreshPromise

    const refreshed = getActiveCredentials()
    if (!refreshed) {
      throw new AuthRefreshFailedError()
    }
    return await run(refreshed.access_token)
  }
}

export async function authedRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<T> {
  return withAccessToken((token) => apiRequest<T>(path, { ...options, token }))
}

// Same as authedRequest but for endpoints that respond with 204 No Content
// (e.g. DELETE /v1/drafts/{uuid}) where calling response.json() would throw.
export async function authedRequestVoid(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<void> {
  await withAccessToken(async (token) => {
    const url = new URL(path, apiUrl())
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...coAuthorHeader(),
    }
    headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url.toString(), {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ApiError(response.status, errorBody)
    }
  })
}

export async function authedRequestRaw(
  path: string,
): Promise<{ body: Buffer; contentType: string }> {
  return withAccessToken((token) => apiRequestRaw(path, { token }))
}
