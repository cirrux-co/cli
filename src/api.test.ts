import { test, expect, beforeEach } from 'bun:test'
import { ApiError, parseRetryAfterMs, resolveCoAuthor, setExplicitCoAuthor, withRetry } from './api.js'

beforeEach(() => {
  setExplicitCoAuthor(undefined)
})

test('explicit value wins over env vars', () => {
  expect(
    resolveCoAuthor({ CIRRUX_CO_AUTHOR: 'env-name', CLAUDECODE: '1' }, 'flag-name'),
  ).toBe('flag-name')
})

test('CIRRUX_CO_AUTHOR is used when no explicit value', () => {
  expect(resolveCoAuthor({ CIRRUX_CO_AUTHOR: 'env-name', CLAUDECODE: '1' })).toBe('env-name')
})

test('CLAUDECODE=1 auto-sets co-author to "claude"', () => {
  expect(resolveCoAuthor({ CLAUDECODE: '1' })).toBe('claude')
})

test('CLAUDECODE values other than "1" are ignored', () => {
  expect(resolveCoAuthor({ CLAUDECODE: '0' })).toBeUndefined()
  expect(resolveCoAuthor({ CLAUDECODE: 'true' })).toBeUndefined()
})

test('returns undefined when nothing is set', () => {
  expect(resolveCoAuthor({})).toBeUndefined()
})

test('whitespace-only values are treated as unset', () => {
  expect(resolveCoAuthor({ CIRRUX_CO_AUTHOR: '   ' }, '  ')).toBeUndefined()
})

test('setExplicitCoAuthor trims and clears on empty', () => {
  setExplicitCoAuthor('  alice  ')
  expect(resolveCoAuthor({})).toBe('alice')

  setExplicitCoAuthor('')
  expect(resolveCoAuthor({})).toBeUndefined()

  setExplicitCoAuthor(undefined)
  expect(resolveCoAuthor({})).toBeUndefined()
})

// --- Rate-limit retry ---

// A 0ms Retry-After hint keeps these tests instant and deterministic (no
// reliance on the jittered exponential-backoff fallback).
const rateLimited = () => new ApiError(429, 'rate_limited', 0)

test('withRetry retries a 429 then resolves', async () => {
  let calls = 0
  const result = await withRetry(async () => {
    calls++
    if (calls === 1) throw rateLimited()
    return 'ok'
  })
  expect(result).toBe('ok')
  expect(calls).toBe(2)
})

test('withRetry retries a 503 (S3 SlowDown)', async () => {
  let calls = 0
  const result = await withRetry(async () => {
    calls++
    if (calls < 3) throw new ApiError(503, 'SlowDown', 0)
    return 'ok'
  })
  expect(result).toBe('ok')
  expect(calls).toBe(3)
})

test('withRetry gives up after the attempt cap and rethrows the 429', async () => {
  let calls = 0
  const error = await withRetry(async () => {
    calls++
    throw rateLimited()
  }).catch((e) => e)

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(429)
  expect(calls).toBe(6) // 1 initial attempt + 5 retries
})

test('withRetry does not retry non-retryable statuses', async () => {
  let calls = 0
  const error = await withRetry(async () => {
    calls++
    throw new ApiError(404, 'not found')
  }).catch((e) => e)

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(404)
  expect(calls).toBe(1)
})

test('parseRetryAfterMs reads Retry-After seconds', () => {
  expect(parseRetryAfterMs(new Headers({ 'retry-after': '5' }))).toBe(5000)
})

test('parseRetryAfterMs falls back to X-RateLimit-Reset epoch', () => {
  const reset = Math.floor(Date.now() / 1000) + 30
  const ms = parseRetryAfterMs(new Headers({ 'x-ratelimit-reset': String(reset) }))
  expect(ms).toBeGreaterThan(25_000)
  expect(ms).toBeLessThanOrEqual(31_000)
})

test('parseRetryAfterMs returns undefined when no rate-limit headers are present', () => {
  expect(parseRetryAfterMs(new Headers())).toBeUndefined()
})
