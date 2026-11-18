import { expect, test } from 'bun:test'
import { buildPageBody, parseDays, parseHours, parseMinutes } from './page-body.js'

test('days read as ranges, lists and words', () => {
  expect(parseDays('mon-fri')).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  expect(parseDays('mon,wed,fri')).toEqual(['monday', 'wednesday', 'friday'])
  expect(parseDays('Tuesday')).toEqual(['tuesday'])
  expect(parseDays('weekdays')).toHaveLength(5)
  expect(parseDays('daily')).toHaveLength(7)
  expect(parseDays('fri-mon')).toBeNull()
  expect(parseDays('mo')).toBeNull()
  expect(parseDays('monx')).toBeNull()
})

test('several --hours add up, and a day never named is off', () => {
  expect(parseHours(['mon-fri 9:00-12:00', 'mon,wed 13:00-17:00'])).toEqual({
    ok: true,
    hours: {
      monday: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      tuesday: [{ start: '09:00', end: '12:00' }],
      wednesday: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      thursday: [{ start: '09:00', end: '12:00' }],
      friday: [{ start: '09:00', end: '12:00' }],
    },
  })
  expect(parseHours(['sat 10:00-12:00,14:00-16:00'])).toEqual({
    ok: true,
    hours: {
      saturday: [
        { start: '10:00', end: '12:00' },
        { start: '14:00', end: '16:00' },
      ],
    },
  })
})

test('hours that cannot be read say how to write them', () => {
  for (const value of ['mon-fri', '09:00-17:00', 'mon 9-17', 'mon 25:00-26:00', 'mon 09:00-17:00 extra']) {
    const parsed = parseHours([value])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.message).toContain('"mon-fri 09:00-17:00"')
  }
})

test('lengths read as minutes or with units', () => {
  expect(parseMinutes('30')).toBe(30)
  expect(parseMinutes('45m')).toBe(45)
  expect(parseMinutes('1h')).toBe(60)
  expect(parseMinutes('1h30m')).toBe(90)
  expect(parseMinutes('2d')).toBe(2880)
  expect(parseMinutes('')).toBeNull()
  expect(parseMinutes('half an hour')).toBeNull()
})

test('create needs a title and a length, and sends what was passed', () => {
  expect(buildPageBody({ duration: '30' }, { mode: 'create' })).toMatchObject({ ok: false, message: 'A page needs a title.' })
  expect(buildPageBody({ title: 'Intro' }, { mode: 'create' })).toMatchObject({ ok: false, message: 'A page needs a length.' })

  expect(
    buildPageBody(
      { title: ' Intro call ', duration: '1h', hours: ['tue,thu 14:00-17:00'], notice: '1d', daysAhead: '14', off: true },
      { mode: 'create' },
    ),
  ).toEqual({
    ok: true,
    body: {
      title: 'Intro call',
      duration_minutes: 60,
      minimum_notice_minutes: 1440,
      booking_window_days: 14,
      active: false,
      availability: {
        type: 'recurring',
        hours: { tuesday: [{ start: '14:00', end: '17:00' }], thursday: [{ start: '14:00', end: '17:00' }] },
      },
    },
  })
})

test('a page offers one kind of time', () => {
  expect(buildPageBody({ hours: ['mon 09:00-10:00'], slot: ['2026-12-01T09:00:00+01:00'] }, { mode: 'update' })).toMatchObject({
    ok: false,
    message: 'Pass one of --hours, --window or --slot: a page offers one kind of time.',
  })
  expect(buildPageBody({ window: ['2026-12-01T09:00:00+01:00/2026-12-01T12:00:00+01:00'] }, { mode: 'update' })).toEqual({
    ok: true,
    body: { availability: { type: 'windows', windows: [{ start: '2026-12-01T09:00:00+01:00', end: '2026-12-01T12:00:00+01:00' }] } },
  })
  expect(buildPageBody({ window: ['2026-12-01T09:00:00+01:00'] }, { mode: 'update' })).toMatchObject({ ok: false })
})

test('update sends only what changes, and an empty description or location clears it', () => {
  expect(buildPageBody({ on: true }, { mode: 'update' })).toEqual({ ok: true, body: { active: true } })
  expect(buildPageBody({ description: '', location: '  ' }, { mode: 'update' })).toEqual({
    ok: true,
    body: { description: null, location: null },
  })
  expect(buildPageBody({}, { mode: 'update' })).toMatchObject({ ok: false, message: 'Nothing to change.' })
  expect(buildPageBody({ on: true, off: true }, { mode: 'update' })).toMatchObject({ ok: false })
  expect(buildPageBody({ hold: true }, { mode: 'update' })).toEqual({ ok: true, body: { hold_times: true } })
  expect(buildPageBody({ hold: false }, { mode: 'update' })).toEqual({ ok: true, body: { hold_times: false } })
  expect(buildPageBody({ title: '  ' }, { mode: 'update' })).toMatchObject({ ok: false })
})

// The API keeps what an update doesn't name, so only the host fields passed are sent.
test('host flags send only what was passed', () => {
  expect(buildPageBody({ bookInto: 'cal-3' }, { mode: 'update' })).toEqual({
    ok: true,
    body: { hosts: [{ booking_calendar_uuid: 'cal-3' }] },
  })
  expect(buildPageBody({ mailbox: 'mb-2', busyCalendar: ['cal-8', 'cal-9'] }, { mode: 'update' })).toEqual({
    ok: true,
    body: { hosts: [{ mailbox_uuid: 'mb-2', availability_calendar_uuids: ['cal-8', 'cal-9'] }] },
  })
})

test('without host flags no host is sent', () => {
  expect(buildPageBody({ title: 'Chat' }, { mode: 'update' })).toEqual({ ok: true, body: { title: 'Chat' } })
})

// The help's "three set slots" example.
test('set start times become a slots page, each as long as the meeting', () => {
  expect(
    buildPageBody(
      {
        title: 'Launch demo',
        duration: '30',
        slot: ['2026-12-03T10:00:00+01:00', '2026-12-03T14:00:00+01:00', '2026-12-04T09:30:00+01:00'],
      },
      { mode: 'create' },
    ),
  ).toEqual({
    ok: true,
    body: {
      title: 'Launch demo',
      duration_minutes: 30,
      availability: {
        type: 'slots',
        slots: [
          { start: '2026-12-03T10:00:00+01:00' },
          { start: '2026-12-03T14:00:00+01:00' },
          { start: '2026-12-04T09:30:00+01:00' },
        ],
      },
    },
  })
})
