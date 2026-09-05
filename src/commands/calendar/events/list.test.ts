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

// --- --today / --on ---
//
// Anchored to the real current date, never a hardcoded one: a fixed date
// silently becomes a past date and stops testing what "today" means.

function todayIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

test('--today spans exactly one calendar day and pins the timezone', () => {
  const window = resolveWindow({ today: true, timezone: 'Europe/Amsterdam' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  expect(window.timeMin).toBe(todayIn('Europe/Amsterdam'))
  expect(window.timezone).toBe('Europe/Amsterdam')
  // Sent as bare dates, so the server resolves both ends to local midnight.
  expect(window.timeMin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(window.timeMax).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('--today resolves the day in the given zone, not the machine zone', () => {
  const auckland = resolveWindow({ today: true, timezone: 'Pacific/Auckland' })
  const honolulu = resolveWindow({ today: true, timezone: 'Pacific/Honolulu' })

  expect(auckland.ok && honolulu.ok).toBe(true)
  if (!auckland.ok || !honolulu.ok) return
  expect(auckland.timeMin).toBe(todayIn('Pacific/Auckland'))
  expect(honolulu.timeMin).toBe(todayIn('Pacific/Honolulu'))
})

test('--today falls back to the machine timezone when none is given', () => {
  const window = resolveWindow({ today: true })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  expect(window.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(window.timeMin).toBe(todayIn(window.timezone as string))
})

test('--on covers the named day and ends on the next one', () => {
  const window = resolveWindow({ on: '2026-09-02', timezone: 'UTC' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  expect(window.timeMin).toBe('2026-09-02')
  expect(window.timeMax).toBe('2026-09-03')
})

test('--on rolls the month and year correctly', () => {
  const endOfYear = resolveWindow({ on: '2026-12-31', timezone: 'UTC' })
  const endOfMonth = resolveWindow({ on: '2026-02-28', timezone: 'UTC' })

  expect(endOfYear.ok && endOfMonth.ok).toBe(true)
  if (!endOfYear.ok || !endOfMonth.ok) return
  expect(endOfYear.timeMax).toBe('2027-01-01')
  expect(endOfMonth.timeMax).toBe('2026-03-01') // 2026 is not a leap year
})

test('--on rejects anything that is not a calendar date', () => {
  const window = resolveWindow({ on: '2026-09-02T10:00:00Z' })

  expect(window.ok).toBe(false)
  if (window.ok) return
  expect(window.message).toContain('YYYY-MM-DD')
})

test('--today and --on are mutually exclusive', () => {
  const window = resolveWindow({ today: true, on: '2026-09-02' })

  expect(window.ok).toBe(false)
  if (window.ok) return
  expect(window.message).toContain('not both')
})

test('--today cannot be combined with the range flags', () => {
  for (const extra of [{ from: '2026-09-01' }, { to: '2026-09-02' }, { days: '3' }]) {
    const window = resolveWindow({ today: true, ...extra })
    expect(window.ok).toBe(false)
    if (window.ok) continue
    expect(window.message).toContain('--today')
  }
})

// --- --from + --days boundary ---

test('--from as a bare date keeps --days on calendar-day boundaries', () => {
  const window = resolveWindow({ from: '2026-09-01', days: '1' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  // Bare dates, so the server resolves both to local midnight in the window's
  // timezone — the same boundary `--from`/`--to` would have given.
  expect(window.timeMin).toBe('2026-09-01')
  expect(window.timeMax).toBe('2026-09-02')
})

test('--from as an instant keeps --days on 24-hour periods', () => {
  const window = resolveWindow({ from: '2026-09-01T09:30:00Z', days: '2' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  expect(window.timeMin).toBe('2026-09-01T09:30:00.000Z')
  expect(window.timeMax).toBe('2026-09-03T09:30:00.000Z')
})

test('--days with no --from is still the next N days from now', () => {
  const window = resolveWindow({ days: '7' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  const span = Date.parse(window.timeMax as string) - Date.parse(window.timeMin as string)
  expect(span).toBe(7 * 24 * 60 * 60 * 1000)
})

test('an explicit --timezone survives a plain --from/--to window', () => {
  const window = resolveWindow({ from: '2026-09-01', to: '2026-09-08', timezone: 'Europe/Amsterdam' })

  expect(window.ok).toBe(true)
  if (!window.ok) return
  expect(window.timezone).toBe('Europe/Amsterdam')
})
