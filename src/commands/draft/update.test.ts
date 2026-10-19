import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApiError } from '../../api.js'
import { classifyApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { readMarkdownInput } from './create.js'
import {
  DRAFT_UPDATE_ERROR_RULES,
  buildDraftUpdateBody,
  draftUpdateUsageError,
  updatePath,
} from './update.js'

test('updatePath URL-encodes the draft uuid', () => {
  expect(updatePath('abc-123')).toBe('public_api/v1/drafts/abc-123')
  expect(updatePath('weird/uuid')).toBe('public_api/v1/drafts/weird%2Fuuid')
})

test('only the fields that were passed reach the body', () => {
  expect(buildDraftUpdateBody({ subject: 'New subject', to: [], cc: [], bcc: [] })).toEqual({ subject: 'New subject' })
  expect(buildDraftUpdateBody({ markdown: 'body.md', to: [], cc: [], bcc: [] }, 'Hello')).toEqual({ markdown: 'Hello' })
})

test('recipient flags replace each list with parsed addresses', () => {
  const body = buildDraftUpdateBody({
    to: ['Alice <alice@example.com>', 'bob@example.com'],
    cc: ['"Carol C" <carol@example.com>'],
    bcc: ['dave@example.com'],
  })

  expect(body).toEqual({
    to: [{ address: 'alice@example.com', name: 'Alice' }, { address: 'bob@example.com' }],
    cc: [{ address: 'carol@example.com', name: 'Carol C' }],
    bcc: [{ address: 'dave@example.com' }],
  })
})

test('--clear-cc and --clear-bcc send empty lists', () => {
  expect(buildDraftUpdateBody({ clearCc: true, clearBcc: true, cc: [], bcc: [] })).toEqual({ cc: [], bcc: [] })
})

test('an empty subject is still a change, so it is sent', () => {
  expect(buildDraftUpdateBody({ subject: '' })).toEqual({ subject: '' })
  expect(draftUpdateUsageError({ subject: '' })).toBeNull()
})

test('an update without any change is a usage error naming the flags', () => {
  const message = draftUpdateUsageError({ to: [], cc: [], bcc: [] })
  expect(message).toMatch(/^Nothing to update/)
  expect(message).toContain('--markdown')
  expect(message).toContain('--clear-cc')
  expect(draftUpdateUsageError({})).toMatch(/^Nothing to update/)
})

test('--cc with --clear-cc is a usage error, and so is --bcc with --clear-bcc', () => {
  expect(draftUpdateUsageError({ cc: ['a@example.com'], clearCc: true })).toBe('--cc and --clear-cc are mutually exclusive.')
  expect(draftUpdateUsageError({ bcc: ['a@example.com'], clearBcc: true })).toBe(
    '--bcc and --clear-bcc are mutually exclusive.',
  )
})

test('valid flag combinations raise no usage error', () => {
  expect(draftUpdateUsageError({ markdown: '-' })).toBeNull()
  expect(draftUpdateUsageError({ to: ['a@example.com'], clearCc: true, bcc: ['b@example.com'] })).toBeNull()
  expect(draftUpdateUsageError({ clearBcc: true })).toBeNull()
})

test('a scheduled draft is a conflict that says to cancel the scheduled send first', () => {
  const body = JSON.stringify({ error: 'already_scheduled', error_description: 'The draft is scheduled.' })
  const result = classifyApiError(new ApiError(422, body), { action: 'Update draft', rules: DRAFT_UPDATE_ERROR_RULES })

  expect(result.code).toBe(ExitCode.CONFLICT)
  expect(result.errorType).toBe('already_scheduled')
  expect(result.message).toBe('Update draft failed: the draft is scheduled to send, or is being sent.')
  expect(result.hint).toContain('Cancel the scheduled send')
})

test('updating an email that is not a draft is a usage error', () => {
  const body = JSON.stringify({ error: 'not_a_draft', error_description: 'Not a draft.' })
  const result = classifyApiError(new ApiError(422, body), { action: 'Update draft', rules: DRAFT_UPDATE_ERROR_RULES })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('not_a_draft')
  expect(result.hint).toContain('cirrux draft create')
})

test('an invalid address keeps the API description', () => {
  const body = JSON.stringify({ error: 'invalid_value', error_description: "'nope' is not a valid address." })
  const result = classifyApiError(new ApiError(422, body), { action: 'Update draft', rules: DRAFT_UPDATE_ERROR_RULES })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('invalid_value')
  expect(result.message).toBe("Update draft failed: 'nope' is not a valid address.")
})

test('readMarkdownInput reads the body from a file path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cirrux-draft-update-test-'))
  const path = join(dir, 'body.md')
  writeFileSync(path, '# Hi\n\nNew text', 'utf8')

  try {
    expect(await readMarkdownInput(path, {})).toBe('# Hi\n\nNew text')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
