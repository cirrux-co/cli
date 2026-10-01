import { test, expect } from 'bun:test'
import { ApiError } from '../api.js'
import { classifyApiError } from '../api-errors.js'
import { ExitCode } from '../exit-codes.js'
import { buildMailSearchParams, SEARCH_ERROR_RULES } from './search-shared.js'

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

test('a label uuid is sent as label_uuid and leaves the query alone', () => {
  const params = buildMailSearchParams('invoice', { label: '0B3C1D2E-0000-4000-8000-000000000001' })

  expect(params.get('q')).toBe('invoice')
  expect(params.get('label_uuid')).toBe('0B3C1D2E-0000-4000-8000-000000000001')
})

test('a label name becomes a label: term in the query', () => {
  const params = buildMailSearchParams('invoice', { label: 'Receipts' })

  expect(params.get('q')).toBe('invoice label:Receipts')
  expect(params.has('label_uuid')).toBe(false)
})

test('a label name with spaces is quoted', () => {
  expect(buildMailSearchParams('invoice', { label: 'Project X' }).get('q')).toBe('invoice label:"Project X"')
})

test('mailbox, limit and cursor pass through untouched', () => {
  const params = buildMailSearchParams('invoice', { mailboxUuid: 'mb', limit: '5', cursor: 'c' })

  expect(params.get('mailbox_uuid')).toBe('mb')
  expect(params.get('limit')).toBe('5')
  expect(params.get('cursor')).toBe('c')
  expect(params.has('label_uuid')).toBe(false)
})
