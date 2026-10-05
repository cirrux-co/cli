import { expect, test } from 'bun:test'
import { classifyApiError } from '../../api-errors.js'
import { ApiError } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { attachmentPlace, type DocumentAttachment, formatAttachment } from './attach.js'
import { DOCS_ERROR_RULES } from './docs-shared.js'

const UUID = '0b6f0d3e-8c1a-4f6e-9a4b-2d1e5c7a9f10'

function attachment(overrides: Partial<DocumentAttachment> = {}): DocumentAttachment {
  return {
    object: 'document_attachment',
    uuid: UUID,
    document_uuid: 'd-1',
    filename: 'chart.png',
    content_type: 'image/png',
    byte_size: 2048,
    width: 640,
    height: 480,
    inline: true,
    markdown: `![chart.png](attachment:${UUID})`,
    created_at: '2026-10-03T10:00:00.000Z',
    ...overrides,
  }
}

test('attachmentPlace is nothing without a place, so the file is only uploaded', () => {
  expect(attachmentPlace({})).toBeNull()
})

test('attachmentPlace places as insert does', () => {
  expect(attachmentPlace({ after: 'section:Results' })).toEqual({ after: 'section:Results' })
  expect(attachmentPlace({ at: 'start' })).toEqual({ before: 'start' })
  expect(attachmentPlace({ at: 'end' })).toEqual({ after: 'end' })
  expect(attachmentPlace({ at: 'middle' })).toBe('--at is start or end.')
  expect(typeof attachmentPlace({ after: 'a', before: 'b' })).toBe('string')
})

test('formatAttachment names the file, its type, size and dimensions', () => {
  expect(formatAttachment(attachment())).toBe(`Attached chart.png (image/png, 2.0 KB, 640x480) as ${UUID}`)
  expect(
    formatAttachment(attachment({ filename: 'plan.zip', content_type: 'application/octet-stream', byte_size: 12, width: null, height: null })),
  ).toBe(`Attached plan.zip (application/octet-stream, 12 B) as ${UUID}`)
})

test('a file too large is a usage error, whether the API or the ingress refused it', () => {
  for (const body of ['{"error":"file_too_large","error_description":"The file is too large."}', '<html>413 Request Entity Too Large</html>']) {
    const failure = classifyApiError(new ApiError(413, body), { action: 'Attach', rules: DOCS_ERROR_RULES })
    expect(failure.code).toBe(ExitCode.USAGE_ERROR)
    expect(failure.errorType).toBe('file_too_large')
    expect(failure.message).toBe('Attach failed: the file is too large.')
  }
})

test('a workspace out of storage is a usage error that says so', () => {
  const body = '{"error":"storage_limit_exceeded","error_description":"The workspace is out of storage."}'
  const failure = classifyApiError(new ApiError(422, body), { action: 'Attach', rules: DOCS_ERROR_RULES })
  expect(failure.code).toBe(ExitCode.USAGE_ERROR)
  expect(failure.errorType).toBe('storage_limit_exceeded')
  expect(failure.message).toBe('Attach failed: the workspace storage limit has been reached.')
})
