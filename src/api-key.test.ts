import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { ApiError, authedRequest } from './api.js'
import { classifyApiError } from './api-errors.js'
import {
  API_KEY_ENV,
  apiKeyFromEnv,
  apiKeyRefusal,
  apiKeyStillInUseNotice,
  looksLikeApiKey,
  resolveApiKey,
  setExplicitApiKey,
} from './api-key.js'
import { ExitCode } from './exit-codes.js'

const KEY = 'cxk_1234567890abcdefghijklmnopqrstuvwxyzABCD'

// --- Which commands a key can run ---

test('the mail commands run with a key', () => {
  for (const path of [
    ['mailbox', 'list'],
    ['mailbox', 'labels', 'create'],
    ['mailbox', 'filters', 'update'],
    ['mailbox', 'addresses', 'list'],
    ['thread', 'search'],
    ['thread', 'labels', 'add'],
    ['email', 'move'],
    ['draft', 'send'],
    ['attachment', 'download'],
  ]) {
    expect(apiKeyRefusal(path)).toBeNull()
  }
})

test('commands that only touch this machine run with a key', () => {
  for (const path of [['whoami'], ['doctor'], ['login'], ['logout'], ['skill', 'install']]) {
    expect(apiKeyRefusal(path)).toBeNull()
  }
})

test('everything outside mail is refused, naming the command and what a key can do', () => {
  for (const path of [
    ['drive', 'list'],
    ['calendar', 'events', 'list'],
    ['tasks', 'create'],
    ['contacts', 'search'],
    ['docs', 'read'],
    ['feedback'],
  ]) {
    const refusal = apiKeyRefusal(path)
    expect(refusal).toContain(`cirrux ${path.join(' ')}`)
    expect(refusal).toContain('mailbox, thread, email, draft and attachment')
  }
})

test('changing a mailbox address is refused, since it needs a person', () => {
  for (const verb of ['create', 'update', 'delete']) {
    expect(apiKeyRefusal(['mailbox', 'addresses', verb])).toContain('signed-in person')
  }
})

// --- Reading the key ---

test('the key comes from CIRRUX_API_KEY, trimmed, and an empty one is no key', () => {
  expect(apiKeyFromEnv({ [API_KEY_ENV]: ` ${KEY}\n` })).toBe(KEY)
  expect(apiKeyFromEnv({ [API_KEY_ENV]: '  ' })).toBeUndefined()
  expect(apiKeyFromEnv({})).toBeUndefined()
})

test('--api-key wins over CIRRUX_API_KEY, and each says how to stop using it', () => {
  const other = 'cxk_other'
  expect(resolveApiKey({ [API_KEY_ENV]: KEY }, other)).toEqual({
    key: other,
    source: '--api-key',
    howToStop: 'Leave out --api-key and unset CIRRUX_API_KEY',
  })
  expect(resolveApiKey({}, other)).toEqual({ key: other, source: '--api-key', howToStop: 'Leave out --api-key' })
  expect(resolveApiKey({ [API_KEY_ENV]: KEY }, undefined)).toEqual({
    key: KEY,
    source: 'CIRRUX_API_KEY',
    howToStop: 'Unset CIRRUX_API_KEY',
  })
  expect(resolveApiKey({}, undefined)).toBeNull()
})

test('only a cxk_ secret looks like a key', () => {
  expect(looksLikeApiKey(KEY)).toBe(true)
  expect(looksLikeApiKey('eyJhbGciOiJIUzI1NiJ9.oauth-access-token')).toBe(false)
})

test('login and logout say the key stays in use while it is set', () => {
  expect(apiKeyStillInUseNotice({ [API_KEY_ENV]: KEY })).toContain('CIRRUX_API_KEY is set')
  expect(apiKeyStillInUseNotice({})).toBeNull()
})

// --- Requests ---

let previousKey: string | undefined
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

beforeEach(() => {
  previousKey = process.env[API_KEY_ENV]
  process.env[API_KEY_ENV] = KEY
})

afterEach(() => {
  if (previousKey === undefined) delete process.env[API_KEY_ENV]
  else process.env[API_KEY_ENV] = previousKey
  setExplicitApiKey(undefined)
  fetchSpy?.mockRestore()
})

function respondWith(status: number, body: string) {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => new Response(body, { status })) as unknown as typeof fetch)
}

test('a request carries the key as its bearer token', async () => {
  respondWith(200, '{"data":[]}')

  await authedRequest('public_api/v1/mailboxes')

  const init = fetchSpy.mock.calls[0]![1] as RequestInit
  expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${KEY}`)
})

test('a key given with --api-key is the one a request carries, over CIRRUX_API_KEY', async () => {
  respondWith(200, '{"data":[]}')
  setExplicitApiKey('cxk_fromflag')

  await authedRequest('public_api/v1/mailboxes')

  const init = fetchSpy.mock.calls[0]![1] as RequestInit
  expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer cxk_fromflag')
})

test('a rejected key is not refreshed, and says to get a new key rather than log in', async () => {
  respondWith(401, '{"error":"invalid_request","error_description":"Invalid API key or access token"}')

  const error = await authedRequest('public_api/v1/mailboxes').catch((e: unknown) => e)

  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).apiKeySource).toBe('CIRRUX_API_KEY')

  const result = classifyApiError(error, { action: 'List mailboxes', scope: 'email' })
  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.message).toBe('The API key from CIRRUX_API_KEY was not accepted.')
  expect(result.hint).toContain('admin.cirrux.co/api-keys')
})

test('a key without a scope names the scope, and says a new key is the fix', async () => {
  respondWith(403, '{"error":"insufficient_scope","error_description":"Required scope: email.send"}')

  const error = await authedRequest('public_api/v1/drafts/x/send', { method: 'POST' }).catch((e: unknown) => e)
  const result = classifyApiError(error, { action: 'Send draft', scope: 'email' })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('insufficient_scope')
  expect(result.message).toBe('This API key is missing a permission this needs. Required scope: email.send.')
  expect(result.hint).not.toContain('cirrux login')
})
