import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApiError } from '../../api.js'
import { classifyApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { DRAFT_CREATE_ERROR_RULES, readMimeInput } from './create.js'

test('readMimeInput reads the MIME content from a file when --file is set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cirrux-draft-test-'))
  const path = join(dir, 'message.eml')
  const mime = 'From: me@example.com\r\nSubject: hi\r\n\r\nbody'
  writeFileSync(path, mime, 'utf8')

  try {
    const result = await readMimeInput({ file: path })
    expect(result).toBe(mime)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a reply in the wrong mailbox is a usage error that points at --mailbox-uuid', () => {
  const body = JSON.stringify({
    error: 'mailbox_mismatch',
    error_description: 'The email you are replying to is in mailbox abc.',
    mailbox_uuid: 'abc',
  })
  const result = classifyApiError(new ApiError(422, body), {
    action: 'Create draft',
    rules: DRAFT_CREATE_ERROR_RULES,
  })

  expect(result.code).toBe(ExitCode.USAGE_ERROR)
  expect(result.errorType).toBe('mailbox_mismatch')
  expect(result.message).toBe('Create draft failed: The email you are replying to is in mailbox abc.')
  expect(result.hint).toContain('--mailbox-uuid')
})
