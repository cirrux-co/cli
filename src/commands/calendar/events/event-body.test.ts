import { describe, expect, test } from 'bun:test'
import { buildEventBody, parseAttendee } from './event-body.js'

function ok(result: ReturnType<typeof buildEventBody>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`)
  return result.body
}

function err(result: ReturnType<typeof buildEventBody>) {
  if (result.ok) throw new Error('expected a usage error')
  return result.message
}

describe('buildEventBody — create', () => {
  test('builds a timed event with an explicit timezone', () => {
    const body = ok(
      buildEventBody(
        {
          title: 'Coffee',
          start: '2026-09-02T10:00',
          end: '2026-09-02T10:30',
          timezone: 'Europe/Amsterdam',
          location: 'Cafe',
        },
        { mode: 'create' },
      ),
    )

    expect(body).toEqual({
      start: { date_time: '2026-09-02T10:00', time_zone: 'Europe/Amsterdam' },
      end: { date_time: '2026-09-02T10:30', time_zone: 'Europe/Amsterdam' },
      title: 'Coffee',
      location: 'Cafe',
    })
  })

  test('builds an all-day event from bare dates', () => {
    const body = ok(
      buildEventBody(
        { title: 'Offsite', start: '2026-09-02', end: '2026-09-04', allDay: true },
        { mode: 'create' },
      ),
    )

    expect(body.start).toEqual({ date: '2026-09-02' })
    expect(body.end).toEqual({ date: '2026-09-04' })
  })

  test('defaults the timezone to the machine when none is given', () => {
    const body = ok(
      buildEventBody(
        { title: 'Coffee', start: '2026-09-02T10:00', end: '2026-09-02T10:30' },
        { mode: 'create' },
      ),
    )

    expect(body.start?.time_zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  test('names every missing required flag at once', () => {
    expect(err(buildEventBody({ location: 'Cafe' }, { mode: 'create' }))).toBe(
      'Creating an event needs --title, --start, --end.',
    )
  })

  // Bare dates and --all-day have to agree, or the server gets a half-flipped event.
  test('rejects --all-day with a time', () => {
    expect(
      err(
        buildEventBody(
          { title: 'x', start: '2026-09-02T10:00', end: '2026-09-02T11:00', allDay: true },
          { mode: 'create' },
        ),
      ),
    ).toMatch(/--all-day needs --start and --end as YYYY-MM-DD/)
  })

  test('rejects bare dates without --all-day, and says how to fix it', () => {
    expect(
      err(buildEventBody({ title: 'x', start: '2026-09-02', end: '2026-09-04' }, { mode: 'create' })),
    ).toMatch(/Add --all-day, or give a time/)
  })

  test('rejects an unknown transparency', () => {
    expect(
      err(
        buildEventBody(
          { title: 'x', start: '2026-09-02T10:00', end: '2026-09-02T11:00', transparency: 'hazy' },
          { mode: 'create' },
        ),
      ),
    ).toMatch(/opaque, transparent/)
  })
})

describe('buildEventBody — update', () => {
  test('sends only what was passed', () => {
    expect(ok(buildEventBody({ title: 'Renamed' }, { mode: 'update' }))).toEqual({ title: 'Renamed' })
  })

  test('needs at least one field', () => {
    expect(err(buildEventBody({}, { mode: 'update' }))).toMatch(/Nothing to change/)
  })

  test('refuses --start without --end', () => {
    expect(err(buildEventBody({ start: '2026-09-02T10:00' }, { mode: 'update' }))).toBe(
      'Use --start and --end together, or neither.',
    )
  })

  // An empty string is how a caller clears a field or stops an event repeating.
  test('passes an empty string through rather than treating it as absent', () => {
    expect(ok(buildEventBody({ recurrence: '' }, { mode: 'update' }))).toEqual({ recurrence: '' })
  })

  test('carries the whole replacement guest list', () => {
    const body = ok(
      buildEventBody({ attendee: ['a@example.com', 'Bob <b@example.com>'] }, { mode: 'update' }),
    )

    expect(body.attendees).toEqual([{ email: 'a@example.com' }, { email: 'b@example.com', name: 'Bob' }])
  })

  test('accepts an empty guest list, which clears the attendees', () => {
    expect(ok(buildEventBody({ attendee: [] }, { mode: 'update' }))).toEqual({ attendees: [] })
  })

  test('echoes the attendee it could not read', () => {
    expect(err(buildEventBody({ attendee: ['not an email'] }, { mode: 'update' }))).toBe(
      "Could not read --attendee 'not an email' as an email address.",
    )
  })
})

describe('parseAttendee', () => {
  test.each([
    ['a@example.com', { email: 'a@example.com' }],
    ['  a@example.com  ', { email: 'a@example.com' }],
    ['Bob <b@example.com>', { email: 'b@example.com', name: 'Bob' }],
    ['"Bob Loblaw" <b@example.com>', { email: 'b@example.com', name: 'Bob Loblaw' }],
    ['<b@example.com>', { email: 'b@example.com' }],
  ])('reads %p', (input, expected) => {
    expect(parseAttendee(input as string)).toEqual(expected)
  })

  test.each(['', 'nobody', 'two words', 'a b@example.com'])('rejects %p', (input) => {
    expect(parseAttendee(input)).toBeNull()
  })
})
