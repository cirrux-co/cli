import { getActiveCredentials, saveWorkspaceCredentials } from './config.js'

const DEFAULT_API_URL = 'https://api.cirrux.co/'

export function apiUrl(): string {
  return process.env.CIRRUX_API_URL ?? DEFAULT_API_URL
}

export function parseApiErrorDescription(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error_description?: unknown }
    if (typeof parsed.error_description === 'string') {
      return parsed.error_description
    }
    return null
  } catch {
    return null
  }
}

export class ApiError extends Error {
  status: number
  body: string
  description: string | null
  /** How long to wait before retrying, derived from the response's rate-limit
   * headers (Retry-After / X-RateLimit-Reset). Undefined when the server gave
   * no hint, in which case callers fall back to exponential backoff. */
  retryAfterMs?: number

  constructor(status: number, body: string, retryAfterMs?: number) {
    const description = parseApiErrorDescription(body)
    super(description ?? `API error ${status}: ${body}`)
    this.status = status
    this.body = body
    this.description = description
    this.retryAfterMs = retryAfterMs
  }
}

// --- Rate-limit-aware retry ---
//
// The public API throttles at 600 req/60s per token and answers with 429 plus
// Retry-After / X-RateLimit-Reset headers; S3 occasionally answers 503
// SlowDown. Both are transient, so we wait the hinted interval (or back off
// exponentially with full jitter) and retry a bounded number of times before
// letting the error surface. A batch uploader thus rides out a throttle window
// instead of failing the file.
const RETRYABLE_STATUSES = new Set([429, 503])
const MAX_RETRY_ATTEMPTS = 5
const BASE_BACKOFF_MS = 500
const MAX_RETRY_WAIT_MS = 60_000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Parse a retry delay (ms) from a response's rate-limit headers, if present. */
export function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
    const date = Date.parse(retryAfter) // Retry-After may also be an HTTP date
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  }
  const reset = headers.get('x-ratelimit-reset')
  if (reset) {
    const epoch = Number(reset)
    if (Number.isFinite(epoch)) return Math.max(0, epoch * 1000 - Date.now())
  }
  return undefined
}

/** Build an ApiError from a non-ok response, capturing its body and retry hint. */
async function apiErrorFrom(response: Response): Promise<ApiError> {
  return new ApiError(response.status, await response.text(), parseRetryAfterMs(response.headers))
}

function retryDelayMs(error: ApiError, attempt: number): number {
  if (error.retryAfterMs !== undefined) return Math.min(error.retryAfterMs, MAX_RETRY_WAIT_MS)
  const backoff = BASE_BACKOFF_MS * 2 ** attempt
  return Math.min(Math.random() * backoff, MAX_RETRY_WAIT_MS) // full jitter
}

/** Run a request, retrying on transient rate-limit / SlowDown responses. */
export async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        !RETRYABLE_STATUSES.has(error.status) ||
        attempt >= MAX_RETRY_ATTEMPTS
      ) {
        throw error
      }
      await sleep(retryDelayMs(error, attempt))
    }
  }
}

export class AuthRefreshFailedError extends Error {
  constructor(message = 'Session expired. Run `cirrux login` to sign in again.') {
    super(message)
  }
}

let explicitCoAuthor: string | undefined

export function setExplicitCoAuthor(value: string | undefined): void {
  explicitCoAuthor = value?.trim() || undefined
}

export function resolveCoAuthor(
  env: NodeJS.ProcessEnv = process.env,
  explicit: string | undefined = explicitCoAuthor,
): string | undefined {
  const fromExplicit = explicit?.trim()
  if (fromExplicit) return fromExplicit
  const fromEnv = env.CIRRUX_CO_AUTHOR?.trim()
  if (fromEnv) return fromEnv
  if (env.CLAUDECODE === '1') return 'claude'
  return undefined
}

function coAuthorHeader(): Record<string, string> {
  const coAuthor = resolveCoAuthor()
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

  const response = await withRetry(async () => {
    const r = await fetch(url.toString(), {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (!r.ok) throw await apiErrorFrom(r)
    return r
  })

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

  const response = await withRetry(async () => {
    const r = await fetch(url.toString(), { method: 'GET', headers })
    if (!r.ok) throw await apiErrorFrom(r)
    return r
  })

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

    await withRetry(async () => {
      const response = await fetch(url.toString(), {
        method: options.method ?? (options.body ? 'POST' : 'GET'),
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
      if (!response.ok) throw await apiErrorFrom(response)
    })
  })
}

export async function authedRequestRaw(
  path: string,
): Promise<{ body: Buffer; contentType: string }> {
  return withAccessToken((token) => apiRequestRaw(path, { token }))
}

// --- Direct S3 transfers (presigned URLs) ---
//
// Drive's chunked multipart flow PUTs encrypted chunks to, and GETs ciphertext
// ranges from, S3 presigned URLs directly — bypassing our API (no auth header,
// not the API base URL) and the ingress body-size limit. These take a full URL.

/** PUT an encrypted chunk to a presigned S3 part URL; returns the part's ETag. */
export async function putToPresignedUrl(url: string, body: Buffer): Promise<string> {
  // Copy into a fresh ArrayBuffer: a Node Buffer's backing store is typed
  // ArrayBufferLike, which fetch's BodyInit rejects (the SharedArrayBuffer-vs-
  // ArrayBuffer mismatch). The copy is cheap at chunk sizes.
  const payload = new ArrayBuffer(body.byteLength)
  new Uint8Array(payload).set(body)

  const response = await withRetry(async () => {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Length': String(body.byteLength) },
      body: payload,
    })
    if (!r.ok) throw await apiErrorFrom(r)
    return r
  })

  const etag = response.headers.get('etag')
  if (!etag) {
    throw new Error('S3 did not return an ETag for the uploaded part.')
  }
  return etag
}

/** GET a byte range [start, end) from a presigned S3 URL. */
export async function getRangeFromPresignedUrl(url: string, start: number, end: number): Promise<Buffer> {
  const response = await withRetry(async () => {
    const r = await fetch(url, {
      method: 'GET',
      headers: { Range: `bytes=${start}-${end - 1}` },
    })
    if (!r.ok) throw await apiErrorFrom(r)
    return r
  })

  return Buffer.from(await response.arrayBuffer())
}
