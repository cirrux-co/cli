import { expect, test } from 'bun:test'
import { type Draft, draftSummary } from './draft-shared.js'

const draft: Draft = {
  object: 'draft',
  uuid: 'd-1',
  mailbox_uuid: 'mb-1',
  thread_uuid: 't-1',
  in_reply_to_email_uuid: null,
  from: [{ address: 'rick@example.com', name: null }],
  to: [{ address: 'jan@example.com', name: null }],
  subject: 'Contract',
  snippet: null,
  body_html: null,
  body_text: null,
  labels: ['draft'],
  attachments: [{ uuid: 'att-1', filename: 'contract.pdf', content_type: 'application/pdf', file_size_bytes: 9 }],
  created_at: '2026-10-30T08:00:00Z',
  updated_at: '2026-10-30T08:00:00Z',
}

// The API leaves cc and bcc out of a draft that has none, which is most of them.
test('a draft without Cc or Bcc is summarised, with its attachments and their uuids', () => {
  expect(draftSummary(draft, 'Draft created')).toBe(
    [
      'Draft created: d-1',
      '  From: rick@example.com',
      '  Subject: Contract',
      '  To: jan@example.com',
      '  Attachment: contract.pdf (att-1)',
    ].join('\n'),
  )
})
