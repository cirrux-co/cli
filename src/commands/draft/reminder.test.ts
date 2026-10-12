import { expect, test } from 'bun:test'
import { buildReminderFields } from './reminder.js'

const NOW = new Date(2026, 7, 19, 14, 30, 0)

test('no reminder flags means no reminder fields', () => {
  const result = buildReminderFields({}, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.fields).toBeNull()
})

test('--remind-at defaults to the always condition', () => {
  const result = buildReminderFields({ remindAt: '+3d' }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.fields?.remind_condition).toBe('always')
})

test('--remind-if-no-reply selects the reminder condition', () => {
  const result = buildReminderFields({ remindAt: '+3d', remindIfNoReply: true }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.fields?.remind_condition).toBe('if_no_reply')
})

test('emits an absolute instant', () => {
  const result = buildReminderFields({ remindAt: 'monday' }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.fields?.remind_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})

// The condition on its own would otherwise be silently dropped, and the caller would
// believe they had set a reminder.
test('--remind-if-no-reply without a time is a usage error', () => {
  const result = buildReminderFields({ remindIfNoReply: true }, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/--remind-at/)
})

test('surfaces an unparseable time as a usage message', () => {
  const result = buildReminderFields({ remindAt: 'whenever' }, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/Could not understand/)
})

test('surfaces a past time as a usage message', () => {
  const result = buildReminderFields({ remindAt: '2020-01-01T00:00:00Z' }, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/in the past/)
})
