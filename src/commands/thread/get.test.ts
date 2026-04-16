import { test, expect } from 'bun:test'
import { formatEmailLine, formatThreadDetail } from './get.js'

const baseEmail = {
  object: 'email',
  uuid: 'email-uuid-1',
  thread_uuid: 'thread-uuid-1',
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

const baseThread = {
  object: 'thread',
  uuid: 'thread-uuid-1',
  mailbox_uuid: 'mb1',
  last_email_received_at: null,
  last_email_sent_at: null,
  emails: [baseEmail],
}

test('formatEmailLine includes uuid, from, and subject', () => {
  const out = formatEmailLine(baseEmail)
  expect(out).toContain('email-uuid-1')
  expect(out).toContain('Ada <ada@example.com>')
  expect(out).toContain('Hello')
})

test('formatEmailLine marks unread and flagged emails', () => {
  const out = formatEmailLine({ ...baseEmail, is_read: false, is_flagged: true })
  expect(out).toContain('unread')
  expect(out).toContain('flagged')
})

test('formatEmailLine notes attachment count when attachments are present', () => {
  const out = formatEmailLine({
    ...baseEmail,
    attachments: [
      { object: 'attachment', uuid: 'a1', filename: 'a.pdf', content_type: 'application/pdf', file_size_bytes: 1 },
      { object: 'attachment', uuid: 'a2', filename: 'b.pdf', content_type: 'application/pdf', file_size_bytes: 1 },
    ],
  })
  expect(out).toContain('2 attachments')
})

test('formatEmailLine falls back to "(no subject)" when subject is empty', () => {
  const out = formatEmailLine({ ...baseEmail, subject: '' })
  expect(out).toContain('(no subject)')
})

test('formatThreadDetail renders the thread header with the email count', () => {
  const out = formatThreadDetail(baseThread)
  expect(out).toContain('Thread: thread-uuid-1')
  expect(out).toContain('(1 email)')
})

test('formatThreadDetail renders every email in the thread', () => {
  const out = formatThreadDetail({
    ...baseThread,
    emails: [
      baseEmail,
      { ...baseEmail, uuid: 'email-uuid-2', subject: 'Re: Hello' },
    ],
  })
  expect(out).toContain('email-uuid-1')
  expect(out).toContain('email-uuid-2')
  expect(out).toContain('Re: Hello')
  expect(out).toContain('(2 emails)')
})

test('formatThreadDetail handles an empty thread gracefully', () => {
  const out = formatThreadDetail({ ...baseThread, emails: [] })
  expect(out).toContain('(no emails)')
})
