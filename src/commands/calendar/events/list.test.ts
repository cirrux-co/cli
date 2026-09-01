import { test, expect } from 'bun:test'
import { formatCalendarEvents, resolveWindow } from './list.js'
import type { CalendarEvent, CalendarEventListResponse } from '../calendar-shared.js'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    object: 'calendar_event',
    id: 'evt-1',
    event_uuid: 'evt-1',
    series_uuid: null,
    series_group_uuid: null,
    calendar_uuid: 'cal-1',
    recurrence_id: null,
    is_exception: false,
    status: 'confirmed',
    title: 'Review',
    description: null,
    location: null,
    url: null,
    transparency: null,
    all_day: false,
    start: { date_time: '2026-09-02T07:00:00Z', time_zone: 'Europe/Amsterdam' },
    end: { date_time: '2026-09-02T08:00:00Z', time_zone: 'Europe/Amsterdam' },
    recurrence: null,
    sequence: 0,
    organizer: null,
    attendees: [],
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function response(data: CalendarEvent[], extra: Partial<CalendarEventListResponse> = {}): CalendarEventListResponse {
  return {
    object: 'list',
    url: '/v1/calendars/cal-1/events',
    time_min: '2026-09-01T00:00:00Z',
    time_max: '2026-10-02T00:00:00Z',
    timezone: 'UTC',
    has_more: false,
    data,
    ...extra,
  }
}

test('formatCalendarEvents renders a timed occurrence', () => {
  const { text, quietValue } = formatCalendarEvents(response([event()]))

  expect(text).toBe('evt-1\t2026-09-02T07:00:00Z → 2026-09-02T08:00:00Z\tReview')
  expect(quietValue).toBe('evt-1')
})

test('formatCalendarEvents renders an all-day occurrence from its dates', () => {
  const { text } = formatCalendarEvents(
    response([event({ all_day: true, start: { date: '2026-09-02' }, end: { date: '2026-09-03' } })]),
  )

  expect(text).toBe('evt-1\t2026-09-02 → 2026-09-03\tReview  (all-day)')
})

test('formatCalendarEvents marks a recurring instance that was individually edited', () => {
  const { text } = formatCalendarEvents(
    response([event({ id: 'master-1_20260909T070000Z', series_uuid: 'master-1', is_exception: true })]),
  )

  expect(text).toContain('(exception, recurring)')
})

test('formatCalendarEvents falls back when an event has no title', () => {
  const { text } = formatCalendarEvents(response([event({ title: null })]))

  expect(text).toContain('(no title)')
})

test('formatCalendarEvents surfaces the cursor when there is more', () => {
  const { text } = formatCalendarEvents(response([event()], { has_more: true, next_cursor: 'abc' }))

  expect(text).toContain('More results available (cursor: abc)')
})

test('formatCalendarEvents says so when the window is empty', () => {
  const { text, quietValue } = formatCalendarEvents(response([]))

  expect(text).toBe('No events in this window.')
  expect(quietValue).toBe('')
})

test('resolveWindow passes --from/--to through untouched so the server owns parsing', () => {
  const window = resolveWindow({ from: '2026-09-01', to: '2026-09-08' })

  expect(window).toEqual({ ok: true, timeMin: '2026-09-01', timeMax: '2026-09-08' })
})

test('resolveWindow sends nothing when no bounds are given, so the server defaults apply', () => {
  expect(resolveWindow({})).toEqual({ ok: true, timeMin: undefined, timeMax: undefined })
})

test('resolveWindow turns --days into an explicit window from --from', () => {
  const window = resolveWindow({ from: '2026-09-01T00:00:00Z', days: '7' })

  expect(window).toEqual({
    ok: true,
    timeMin: '2026-09-01T00:00:00.000Z',
    timeMax: '2026-09-08T00:00:00.000Z',
  })
})

test('resolveWindow rejects --days together with --to', () => {
  const window = resolveWindow({ days: '7', to: '2026-09-08' })

  expect(window).toEqual({ ok: false, message: 'Use either --days <n> or --to <date>, not both.' })
})

test('resolveWindow rejects a --days that is not a positive whole number', () => {
  for (const days of ['0', '-1', '1.5', 'seven']) {
    expect(resolveWindow({ days })).toEqual({
      ok: false,
      message: '--days must be a positive whole number of days.',
    })
  }
})

test('resolveWindow rejects a --from it cannot read when it has to do the arithmetic', () => {
  const window = resolveWindow({ from: 'nonsense', days: '7' })

  expect(window).toEqual({ ok: false, message: "Could not read --from 'nonsense' as a date." })
})
