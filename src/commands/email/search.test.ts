import { test, expect } from 'bun:test'
import { formatEmailSummary } from './search.js'

const baseEmail = {
  object: 'email',
  uuid: 'email-uuid-1',
  thread_uuid: 't1',
  from: [{ name: 'Ada', address: 'ada@example.com' }],
  to: [{ name: null, address: 'me@example.com' }],
  cc: [],
  subject: 'Hello',
  snippet: null,
  is_read: true,
  is_flagged: false,
  date: '2026-01-15T09:30:00Z',
  labels: [],
  attachments: [],
}

test('formatEmailSummary renders uuid, subject, and from/date', () => {
  const out = formatEmailSummary(baseEmail)
  expect(out).toContain('email-uuid-1')
  expect(out).toContain('Hello')
  expect(out).toContain('From: Ada <ada@example.com>')
  expect(out).toContain('2026')
})

test('formatEmailSummary marks unread emails', () => {
  const out = formatEmailSummary({ ...baseEmail, is_read: false })
  expect(out).toContain('[unread]')
})

test('formatEmailSummary shows attachment count when present', () => {
  const out = formatEmailSummary({
    ...baseEmail,
    attachments: [
      { object: 'attachment', uuid: 'a1', filename: 'a.pdf', content_type: 'application/pdf', file_size_bytes: 100 },
      { object: 'attachment', uuid: 'a2', filename: 'b.pdf', content_type: 'application/pdf', file_size_bytes: 200 },
    ],
  })
  expect(out).toContain('[2 attachments]')
})

test('formatEmailSummary pluralizes attachment count correctly', () => {
  const out = formatEmailSummary({
    ...baseEmail,
    attachments: [
      { object: 'attachment', uuid: 'a1', filename: 'a.pdf', content_type: 'application/pdf', file_size_bytes: 100 },
    ],
  })
  expect(out).toContain('[1 attachment]')
  expect(out).not.toContain('[1 attachments]')
})

test('formatEmailSummary includes the snippet when present', () => {
  const out = formatEmailSummary({ ...baseEmail, snippet: 'Sneak peek at the body' })
  expect(out).toContain('Sneak peek at the body')
})

test('formatEmailSummary falls back to "(no subject)" when subject is empty', () => {
  const out = formatEmailSummary({ ...baseEmail, subject: '' })
  expect(out).toContain('(no subject)')
})
