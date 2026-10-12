import { expect, test } from 'bun:test'
import { threadSnoozedText } from './snooze.js'

const thread = (overrides: Record<string, unknown> = {}) => ({
  object: 'thread',
  uuid: 'thread-1',
  mailbox_uuid: 'mailbox-1',
  snooze_until: '2026-08-20T07:00:00.000Z',
  snooze_condition: 'always',
  emails: [{ uuid: 'email-1' }, { uuid: 'email-2' }],
  ...overrides,
})

test('echoes the wake-up and how many messages it covers', () => {
  const text = threadSnoozedText(thread())
  expect(text).toContain('Snoozed until')
  expect(text).toContain('thread-1')
  expect(text).toContain('2 messages')
})

test('says "message" for a single-message thread', () => {
  const text = threadSnoozedText(thread({ emails: [{ uuid: 'email-1' }] }))
  expect(text).toContain('1 message')
  expect(text).not.toContain('1 messages')
})

test('marks a reminder as conditional on no reply', () => {
  const text = threadSnoozedText(thread({ snooze_condition: 'if_no_reply' }))
  expect(text).toContain('unless they reply')
})

// The unsnooze command renders through the same formatter, and the response it
// gets back carries no wake-up.
test('reports a cleared snooze when there is no wake-up left', () => {
  const text = threadSnoozedText(thread({ snooze_until: null, snooze_condition: null }))
  expect(text).toContain('Snooze removed')
  expect(text).not.toContain('Snoozed until')
})
