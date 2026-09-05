import { test, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import { ApiError, AuthRefreshFailedError } from './api.js'
import { classifyApiError, handleApiError, type ApiErrorRule } from './api-errors.js'
import { ExitCode } from './exit-codes.js'

const NOT_FOUND_BODY = '{"error":"not_found","error_description":"Mailbox not found."}'

function apiError(status: number, body = '', retryAfterMs?: number): ApiError {
  return new ApiError(status, body, retryAfterMs)
}

// --- The reported bug ---
//
// `cirrux mailbox get <unknown-uuid>` exited 1 instead of 3 because it detected
// the 404 with `message.includes('404')`. Every public API error body carries an
// `error_description`, which ApiError prefers for `Error.message`, so that
// substring is never present and the branch was dead.

test('a 404 body carries a description, so the message never contains "404"', () => {
  const error = apiError(404, NOT_FOUND_BODY)

  expect(error.message).toBe('Mailbox not found.')
  expect(error.message).not.toContain('404')
  expect(error.errorCode).toBe('not_found')
})

test('a public API 404 classifies as NOT_FOUND', () => {
  expect(classifyApiError(apiError(404, NOT_FOUND_BODY), { action: 'Fetch mailbox' })).toEqual({
    code: ExitCode.NOT_FOUND,
    message: 'Mailbox not found.',
    errorType: 'not_found',
  })
})

test('a 404 prefers the caller notFound message, which names the input', () => {
  const result = classifyApiError(apiError(404, NOT_FOUND_BODY), {
    action: 'Fetch mailbox',
    notFound: "Mailbox 'abc-123' not found.",
  })

  expect(result.code).toBe(ExitCode.NOT_FOUND)
  expect(result.message).toBe("Mailbox 'abc-123' not found.")
})

test('a 404 with no description at all still classifies as NOT_FOUND', () => {
  const result = classifyApiError(apiError(404, '<html>not found</html>'), { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.NOT_FOUND)
  expect(result.message).toBe('Not found.')
})

// --- The standard ladder ---

test('insufficient_scope names the scope and points at re-login', () => {
  const body = '{"error":"insufficient_scope","error_description":"Required scope: drive.read"}'
  const result = classifyApiError(apiError(403, body), { action: 'List files', scope: 'Drive' })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('insufficient_scope')
  expect(result.message).toBe('Your session is missing Drive permissions.')
  expect(result.hint).toContain('cirrux login')
})

test('a plain 403 is forbidden, not a scope problem', () => {
  const body = '{"error":"forbidden","error_description":"Nope."}'
  const result = classifyApiError(apiError(403, body), { action: 'List files', scope: 'Drive' })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('forbidden')
})

test('a 401 asks the user to sign in again', () => {
  const result = classifyApiError(apiError(401, ''), { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('auth_required')
})

test('a 422 is a usage error carrying the API error code', () => {
  const body = '{"error":"invalid_range","error_description":"time_max must be after time_min."}'
  const result = classifyApiError(apiError(422, body), { action: 'List events' })

  expect(result).toEqual({
    code: ExitCode.USAGE_ERROR,
    message: 'List events failed: time_max must be after time_min.',
    errorType: 'invalid_range',
  })
})

test('a 422 with a non-JSON body falls back to a generic reason and type', () => {
  const result = classifyApiError(apiError(422, 'nope'), { action: 'Create label' })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('invalid_value')
  expect(result.message).toBe('Create label failed: the request was rejected.')
})

test('a 400 is a usage error defaulting to invalid_body', () => {
  const result = classifyApiError(apiError(400, ''), { action: 'Create draft' })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('invalid_body')
})

test('a 409 is a conflict carrying the API error code', () => {
  const body = '{"error":"upload_in_progress","error_description":"Already uploading."}'
  const result = classifyApiError(apiError(409, body), { action: 'Upload' })

  expect(result.code).toBe(ExitCode.CONFLICT)
  expect(result.errorType).toBe('upload_in_progress')
})

test('a 429 reports the wait from the retry hint', () => {
  const result = classifyApiError(apiError(429, '', 3000), { action: 'List threads' })

  expect(result.code).toBe(ExitCode.RATE_LIMITED)
  expect(result.errorType).toBe('rate_limited')
  expect(result.hint).toBe('Wait 3s before retrying, or slow the request rate.')
})

test('a 429 without a retry hint still tells the caller to back off', () => {
  const result = classifyApiError(apiError(429, ''), { action: 'List threads' })

  expect(result.code).toBe(ExitCode.RATE_LIMITED)
  expect(result.hint).toBe('Wait a moment before retrying, or slow the request rate.')
})

test('a 500 is a general failure', () => {
  const result = classifyApiError(apiError(500, ''), { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.GENERAL_FAILURE)
  expect(result.errorType).toBe('api_error')
})

test('an expired session exits AUTH_REQUIRED rather than a generic failure', () => {
  const result = classifyApiError(new AuthRefreshFailedError(), { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('auth_required')
  expect(result.hint).toContain('cirrux login')
})

test('a non-API error is reported under the action', () => {
  const result = classifyApiError(new Error('socket hang up'), { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.GENERAL_FAILURE)
  expect(result.message).toBe('Fetch email failed: socket hang up')
})

test('a thrown non-Error is stringified rather than swallowed', () => {
  const result = classifyApiError('kaboom', { action: 'Fetch email' })

  expect(result.code).toBe(ExitCode.GENERAL_FAILURE)
  expect(result.message).toBe('Fetch email failed: kaboom')
})

// --- Domain rules ---

const NAME_TAKEN: ApiErrorRule = {
  errorCode: 'name_taken',
  exitCode: ExitCode.CONFLICT,
  reason: 'a file with that name already exists.',
  hint: 'Choose a different name.',
}

test('a rule overrides the ladder it would otherwise fall through to', () => {
  const body = '{"error":"name_taken","error_description":"Taken."}'
  const result = classifyApiError(apiError(422, body), { action: 'Upload', rules: [NAME_TAKEN] })

  // 422 would be a usage error (2); the rule makes it a conflict (5).
  expect(result.code).toBe(ExitCode.CONFLICT)
  expect(result.errorType).toBe('name_taken')
  expect(result.message).toBe('Upload failed: a file with that name already exists.')
  expect(result.hint).toBe('Choose a different name.')
})

test('the first matching rule wins', () => {
  const rules: ApiErrorRule[] = [
    { status: 422, exitCode: ExitCode.CONFLICT, errorType: 'first' },
    { status: 422, exitCode: ExitCode.USAGE_ERROR, errorType: 'second' },
  ]
  expect(classifyApiError(apiError(422, ''), { action: 'Do', rules }).errorType).toBe('first')
})

test('a rule with no reason falls back to the API description', () => {
  const body = '{"error":"invalid_move","error_description":"Cannot move into itself."}'
  const rules: ApiErrorRule[] = [{ errorCode: 'invalid_move', exitCode: ExitCode.USAGE_ERROR }]
  const result = classifyApiError(apiError(422, body), { action: 'Move', rules })

  expect(result.message).toBe('Move failed: Cannot move into itself.')
  expect(result.errorType).toBe('invalid_move')
})

test('a rule matching on status alone ignores the error code', () => {
  const rules: ApiErrorRule[] = [
    { status: 413, exitCode: ExitCode.USAGE_ERROR, errorType: 'file_too_large', reason: 'too big.' },
  ]
  const result = classifyApiError(apiError(413, ''), { action: 'Upload', rules })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('file_too_large')
})

test('a non-matching rule leaves the ladder untouched', () => {
  const result = classifyApiError(apiError(404, NOT_FOUND_BODY), {
    action: 'Upload',
    rules: [NAME_TAKEN],
  })

  expect(result.code).toBe(ExitCode.NOT_FOUND)
})

// --- handleApiError wiring ---

let stdoutSpy: ReturnType<typeof spyOn>
let stderrSpy: ReturnType<typeof spyOn>
let exitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true)
  exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`__exit__:${code ?? 0}`)
  }) as never)
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
  exitSpy.mockRestore()
})

test('handleApiError exits 3 and emits a JSON error for a 404', () => {
  expect(() =>
    handleApiError(apiError(404, NOT_FOUND_BODY), { json: true }, { action: 'Fetch mailbox' }),
  ).toThrow('__exit__:3')

  expect(exitSpy).toHaveBeenCalledWith(ExitCode.NOT_FOUND)
  expect(stdoutSpy).toHaveBeenCalledWith(
    '{"error":{"type":"not_found","message":"Mailbox not found."}}\n',
  )
})

test('handleApiError writes the message and hint to stderr in text mode', () => {
  expect(() =>
    handleApiError(apiError(429, '', 5000), {}, { action: 'List threads' }),
  ).toThrow('__exit__:6')

  expect(stderrSpy).toHaveBeenCalledWith('Error: List threads failed: rate limit exceeded.\n')
  expect(stderrSpy).toHaveBeenCalledWith('Hint: Wait 5s before retrying, or slow the request rate.\n')
})
