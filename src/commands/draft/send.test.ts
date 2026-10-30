import { test, expect } from 'bun:test'
import { buildSendBody, sendPath } from './send.js'

const NOW = new Date('2026-04-08T12:00:00Z')

test('sendPath URL-encodes the draft uuid', () => {
  expect(sendPath('abc-123')).toBe('public_api/v1/drafts/abc-123/send')
  expect(sendPath('weird/uuid')).toBe('public_api/v1/drafts/weird%2Fuuid/send')
})

test('no flags sends now: an empty body', () => {
  const result = buildSendBody({}, NOW)
  expect(result).toEqual({ ok: true, body: {} })
})

test('--at schedules the send via send_at', () => {
  const result = buildSendBody({ at: '+2h' }, NOW)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.body.send_at).toBe('2026-04-08T14:00:00.000Z')
})

test('--at carries the reminder fields alongside send_at', () => {
  const result = buildSendBody({ at: '+2h', remindAt: '+3d', remindIfNoReply: true }, NOW)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.body.send_at).toBe('2026-04-08T14:00:00.000Z')
    expect(result.body.remind_condition).toBe('if_no_reply')
    expect(typeof result.body.remind_at).toBe('string')
  }
})

test('an --at time in the past is a usage error', () => {
  const result = buildSendBody({ at: '2020-01-01T00:00:00Z' }, NOW)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.message).toMatch(/past|future/i)
})

test('a reminder usage error is surfaced before scheduling', () => {
  const result = buildSendBody({ remindIfNoReply: true }, NOW)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.message).toMatch(/--remind-at/)
})
