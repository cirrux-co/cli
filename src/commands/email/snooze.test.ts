import { expect, test } from 'bun:test'
import { buildSnoozeBody, snoozePath, threadSnoozePath } from './snooze.js'

const NOW = new Date(2026, 7, 19, 14, 30, 0)

test('builds the email snooze path', () => {
  expect(snoozePath('abc-123', 'snooze')).toBe('public_api/v1/emails/abc-123/snooze')
  expect(snoozePath('abc-123', 'unsnooze')).toBe('public_api/v1/emails/abc-123/unsnooze')
})

test('builds the thread snooze path', () => {
  expect(threadSnoozePath('abc-123', 'snooze')).toBe('public_api/v1/threads/abc-123/snooze')
})

test('encodes the uuid in the path', () => {
  expect(snoozePath('a/b', 'snooze')).toBe('public_api/v1/emails/a%2Fb/snooze')
})

test('defaults the condition to always', () => {
  const result = buildSnoozeBody({ until: '+2d' }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.body.condition).toBe('always')
})

test('--if-no-reply selects the reminder condition', () => {
  const result = buildSnoozeBody({ until: '+2d', ifNoReply: true }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.body.condition).toBe('if_no_reply')
})

test('sends an absolute instant, not the phrase the user typed', () => {
  const result = buildSnoozeBody({ until: 'tomorrow 9am' }, NOW)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.body.until).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})

test('rejects a missing time with a usable message', () => {
  const result = buildSnoozeBody({}, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/--until/)
})

test('rejects a blank time', () => {
  const result = buildSnoozeBody({ until: '  ' }, NOW)
  expect(result.ok).toBe(false)
})

test('surfaces a parse failure as a usage message rather than throwing', () => {
  const result = buildSnoozeBody({ until: 'next fortnight' }, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/Could not understand/)
})

test('surfaces a past time as a usage message', () => {
  const result = buildSnoozeBody({ until: '2020-01-01T00:00:00Z' }, NOW)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.message).toMatch(/in the past/)
})
