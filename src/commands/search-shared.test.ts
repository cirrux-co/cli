import { test, expect } from 'bun:test'
import { ApiError } from '../api.js'
import { classifyApiError } from '../api-errors.js'
import { ExitCode } from '../exit-codes.js'
import { SEARCH_ERROR_RULES } from './search-shared.js'

function classify(status: number, body = '') {
  return classifyApiError(new ApiError(status, body), {
    action: 'Search threads',
    notFound: 'Mailbox not found.',
    rules: SEARCH_ERROR_RULES,
  })
}

test('a rejected query is a usage error carrying the operator hint', () => {
  const body = '{"error":"invalid_query","error_description":"before: needs a value."}'
  const result = classify(422, body)

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('invalid_query')
  expect(result.message).toBe('Search threads failed: before: needs a value.')
  expect(result.hint).toContain('after:YYYY-MM-DD')
})

test('an unknown mailbox is NOT_FOUND', () => {
  const body = '{"error":"not_found","error_description":"Mailbox not found."}'

  expect(classify(404, body).code).toBe(ExitCode.NOT_FOUND)
})
