import { test, expect } from 'bun:test'
import { formatAddress, formatDate, formatThread } from './list.js'

test('formatAddress includes the display name when present', () => {
  expect(formatAddress({ name: 'Ada Lovelace', address: 'ada@example.com' })).toBe(
    'Ada Lovelace <ada@example.com>',
  )
})

test('formatAddress falls back to the bare address when name is null', () => {
  expect(formatAddress({ name: null, address: 'ada@example.com' })).toBe('ada@example.com')
})

test('formatDate renders an ISO timestamp in en-US short form', () => {
  // 2026-01-15T09:30:00Z — exact rendering depends on locale data, but it
  // should at least include the year and the month abbreviation.
  const out = formatDate('2026-01-15T09:30:00Z')
  expect(out).toContain('2026')
  expect(out).toMatch(/Jan/)
})

const baseEmail = {
  object: 'email',
  uuid: 'e1',
  thread_uuid: 't1',
  from: [{ name: 'Ada', address: 'ada@example.com' }],
  to: [{ name: null, address: 'me@example.com' }],
  cc: [],
  subject: 'Hello',
  snippet: null,
  read_at: '2026-01-15T10:00:00Z',
  flagged_at: null,
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

test('formatThread renders a single-email thread without count or unread suffix', () => {
  const out = formatThread(baseThread)
  expect(out).toContain('thread-uuid-1')
  expect(out).toContain('Hello')
  expect(out).not.toContain('(1)')
  expect(out).not.toContain('unread')
  expect(out).toContain('From: Ada <ada@example.com>')
})

test('formatThread shows the email count when there are multiple emails', () => {
  const out = formatThread({
    ...baseThread,
    emails: [baseEmail, { ...baseEmail, uuid: 'e2', read_at: null }],
  })
  expect(out).toContain('(2)')
  expect(out).toContain('[1 unread]')
})

test('formatThread includes the labels line when labels are present', () => {
  const out = formatThread({
    ...baseThread,
    emails: [{ ...baseEmail, labels: ['inbox', 'work'] }],
  })
  expect(out).toContain('Labels: inbox, work')
})

test('formatThread falls back to "(no subject)" when subject is empty', () => {
  const out = formatThread({
    ...baseThread,
    emails: [{ ...baseEmail, subject: '' }],
  })
  expect(out).toContain('(no subject)')
})
