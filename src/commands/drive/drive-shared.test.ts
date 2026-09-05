import { test, expect } from 'bun:test'
import { ApiError } from '../../api.js'
import { classifyApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { DRIVE_ERROR_RULES } from './drive-shared.js'

function classify(status: number, body = '') {
  return classifyApiError(new ApiError(status, body), {
    action: 'Upload',
    scope: 'Drive',
    rules: DRIVE_ERROR_RULES,
  })
}

function jsonBody(code: string, description = 'Rejected.'): string {
  return JSON.stringify({ error: code, error_description: description })
}

test('a name collision is a conflict, not a usage error, despite the 422', () => {
  const result = classify(422, jsonBody('name_taken'))

  expect(result.code).toBe(ExitCode.CONFLICT)
  expect(result.errorType).toBe('name_taken')
  expect(result.hint).toContain('different name')
})

test('a bare 413 from the ingress is recognised without a JSON body', () => {
  const result = classify(413)

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('file_too_large')
  expect(result.message).toContain('2 GB max')
})

test('a 422 file_too_large matches the same rule as the bare 413', () => {
  expect(classify(422, jsonBody('file_too_large')).errorType).toBe('file_too_large')
})

test('storage_limit_exceeded is a usage error', () => {
  const result = classify(422, jsonBody('storage_limit_exceeded'))

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.message).toContain('storage limit')
})

test('invalid_move explains the folder-into-itself case', () => {
  const result = classify(422, jsonBody('invalid_move'))

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.message).toContain('own subfolders')
})

test('public_link_exists is a conflict pointing at share get', () => {
  const result = classify(409, jsonBody('public_link_exists'))

  expect(result.code).toBe(ExitCode.CONFLICT)
  expect(result.hint).toContain('drive share get')
})

test('a Drive 404 still falls through to the standard NOT_FOUND rung', () => {
  expect(classify(404, jsonBody('not_found', 'File not found.')).code).toBe(ExitCode.NOT_FOUND)
})

test('a Drive insufficient_scope names Drive and survives the rule table', () => {
  const result = classify(403, jsonBody('insufficient_scope'))

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.message).toBe('Your session is missing Drive permissions.')
})

test('a description echoing a rule name does not misclassify', () => {
  // The old `body.includes('name_taken')` test would fire on this filename.
  const result = classify(422, jsonBody('invalid_value', 'Bad value for name_taken.txt'))

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('invalid_value')
})
