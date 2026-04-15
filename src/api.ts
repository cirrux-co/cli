const DEFAULT_API_URL = 'https://api.cirrux.co/'

export function apiUrl(): string {
  return process.env.CIRRUX_API_URL ?? DEFAULT_API_URL
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
    throw new Error(`API error ${response.status}: ${errorBody}`)
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
  const headers: Record<string, string> = {}

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`API error ${response.status}: ${errorBody}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'

  return { body: buffer, contentType }
}
