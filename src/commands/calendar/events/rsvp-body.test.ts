import { describe, expect, test } from 'bun:test'
import { buildRsvpBody } from './rsvp-body.js'

describe('buildRsvpBody', () => {
  test('carries the answer', () => {
    expect(buildRsvpBody({ status: 'accepted' })).toEqual({ ok: true, body: { status: 'accepted' } })
  })

  test('carries a note to the organizer', () => {
    expect(buildRsvpBody({ status: 'declined', comment: 'Out that week' })).toEqual({
      ok: true,
      body: { status: 'declined', comment: 'Out that week' },
    })
  })

  test('needs a status', () => {
    expect(buildRsvpBody({ comment: 'Hi' })).toEqual({
      ok: false,
      message: '--status must be one of: accepted, declined, tentative.',
    })
  })

  test('refuses needs_action, which is not an answer', () => {
    expect(buildRsvpBody({ status: 'needs_action' }).ok).toBe(false)
  })

  test('is exact about spelling, so a typo never reaches the organizer as something else', () => {
    expect(buildRsvpBody({ status: 'Accepted' }).ok).toBe(false)
    expect(buildRsvpBody({ status: 'maybe' }).ok).toBe(false)
  })
})
