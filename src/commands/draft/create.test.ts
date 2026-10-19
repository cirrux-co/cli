import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApiError } from '../../api.js'
import { classifyApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import {
  DRAFT_CREATE_ERROR_RULES,
  buildDraftCreateBody,
  draftCreateUsageError,
  readMimeInput,
} from './create.js'

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

const MAILBOX = 'mailbox-1'
const PARENT = 'email-parent'

test('a markdown reply sends only what was passed, leaving the server to derive the rest', () => {
  const body = buildDraftCreateBody(
    { mailboxUuid: MAILBOX, markdown: 'reply.md', inReplyTo: PARENT, to: [], cc: [], bcc: [] },
    'Thanks!',
  )

  expect(body).toEqual({
    mailbox_uuid: MAILBOX,
    body_format: 'markdown',
    markdown: 'Thanks!',
    in_reply_to_email_uuid: PARENT,
  })
})

test('--reply-all and --from reach the body as reply_all and from', () => {
  const body = buildDraftCreateBody(
    { mailboxUuid: MAILBOX, markdown: 'reply.md', inReplyTo: PARENT, replyAll: true, from: 'sales@example.com' },
    'Thanks all',
  )

  expect(body.reply_all).toBe(true)
  expect(body.from).toBe('sales@example.com')
  expect(body.in_reply_to_email_uuid).toBe(PARENT)
})

test('--forward becomes forward_email_uuid alongside explicit recipients', () => {
  const body = buildDraftCreateBody(
    { mailboxUuid: MAILBOX, markdown: 'note.md', forward: 'email-fwd', to: ['Bob <bob@example.com>'] },
    'FYI',
  )

  expect(body.forward_email_uuid).toBe('email-fwd')
  expect(body.to).toEqual([{ address: 'bob@example.com', name: 'Bob' }])
  expect(body).not.toHaveProperty('in_reply_to_email_uuid')
  expect(body).not.toHaveProperty('reply_all')
})

test('explicit subject and recipients are passed through so they win over derived ones', () => {
  const body = buildDraftCreateBody(
    {
      mailboxUuid: MAILBOX,
      markdown: 'reply.md',
      inReplyTo: PARENT,
      replyAll: true,
      subject: 'New subject',
      to: ['alice@example.com'],
      cc: ['carol@example.com'],
      quoteOriginal: false,
    },
    'Hi',
  )

  expect(body.subject).toBe('New subject')
  expect(body.to).toEqual([{ address: 'alice@example.com' }])
  expect(body.cc).toEqual([{ address: 'carol@example.com' }])
  expect(body.quote_original).toBe(false)
})

test('a MIME draft carries the message and the reply link only', () => {
  const body = buildDraftCreateBody({ mailboxUuid: MAILBOX, file: 'reply.eml', inReplyTo: PARENT }, 'MIME')

  expect(body).toEqual({
    mailbox_uuid: MAILBOX,
    body_format: 'mime',
    mime: 'MIME',
    in_reply_to_email_uuid: PARENT,
  })
})

test('valid flag combinations raise no usage error', () => {
  expect(draftCreateUsageError({ markdown: 'a.md', inReplyTo: PARENT, replyAll: true, from: 'a@example.com' })).toBeNull()
  expect(draftCreateUsageError({ markdown: 'a.md', forward: 'email-fwd' })).toBeNull()
  expect(draftCreateUsageError({ file: 'a.eml', inReplyTo: PARENT })).toBeNull()
  expect(draftCreateUsageError({})).toBeNull()
})

test('--file with --markdown is a usage error', () => {
  expect(draftCreateUsageError({ file: 'a.eml', markdown: 'a.md' })).toBe('--file and --markdown are mutually exclusive.')
})

test('--reply-all without --in-reply-to is a usage error', () => {
  expect(draftCreateUsageError({ markdown: 'a.md', replyAll: true })).toMatch(/--reply-all needs --in-reply-to/)
})

test('--forward with --in-reply-to is a usage error', () => {
  expect(draftCreateUsageError({ markdown: 'a.md', forward: 'email-fwd', inReplyTo: PARENT })).toMatch(
    /--forward and --in-reply-to are mutually exclusive/,
  )
})

// A MIME draft sets its own From/To/Cc/Subject, so these would otherwise be dropped
// without a word, and the caller would believe they had forwarded or picked an alias.
test('--reply-all, --forward and --from on a MIME draft are a usage error naming each flag', () => {
  const message = draftCreateUsageError({ file: 'a.eml', inReplyTo: PARENT, replyAll: true, from: 'a@example.com' })
  expect(message).toMatch(/--markdown/)
  expect(message).toContain('--reply-all')
  expect(message).toContain('--from')
  expect(message).not.toContain('--forward')

  expect(draftCreateUsageError({ forward: 'email-fwd' })).toContain('--forward')
})
