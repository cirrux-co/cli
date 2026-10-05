import { expect, test } from 'bun:test'
import { classifyApiError } from '../../api-errors.js'
import { ApiError } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { DOCS_ERROR_RULES } from './docs-shared.js'
import { parseAttachmentRef } from './download.js'

const UUID = '0b6f0d3e-8c1a-4f6e-9a4b-2d1e5c7a9f10'

test('parseAttachmentRef takes a bare uuid or the attachment: link docs read prints', () => {
  expect(parseAttachmentRef(UUID)).toBe(UUID)
  expect(parseAttachmentRef(` attachment:${UUID.toUpperCase()} `)).toBe(UUID)
})

test('parseAttachmentRef refuses anything else', () => {
  expect(parseAttachmentRef('chart.png')).toBeNull()
  expect(parseAttachmentRef(`![chart.png](attachment:${UUID})`)).toBeNull()
})

test('an attachment whose file has not arrived is a conflict, with a hint', () => {
  const body = '{"error":"not_uploaded","error_description":"The attachment\'s file is failed."}'
  const failure = classifyApiError(new ApiError(409, body), { action: 'Download', rules: DOCS_ERROR_RULES })
  expect(failure.code).toBe(ExitCode.CONFLICT)
  expect(failure.errorType).toBe('not_uploaded')
  expect(failure.hint).toContain('never arrived')
})
