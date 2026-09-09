import { describe, expect, test } from 'bun:test'
import { type CalendarEvent } from '../calendar-shared.js'
import { formatWrittenEvent } from './write-shared.js'

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    object: 'calendar_event',
    id: '11111111-1111-4111-8111-111111111111',
    event_uuid: '11111111-1111-4111-8111-111111111111',
    series_uuid: null,
    series_group_uuid: null,
    calendar_uuid: '22222222-2222-4222-8222-222222222222',
    recurrence_id: null,
    is_exception: false,
    status: 'confirmed',
    title: 'Coffee',
    description: null,
    location: null,
    url: null,
    transparency: 'opaque',
    all_day: false,
    start: { date_time: '2026-09-02T08:00:00Z', time_zone: 'Europe/Amsterdam' },
    end: { date_time: '2026-09-02T08:30:00Z', time_zone: 'Europe/Amsterdam' },
    recurrence: null,
    sequence: 0,
    organizer: null,
    attendees: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('formatWrittenEvent', () => {
  test('leads with the id, so it pipes into update and delete', () => {
    expect(formatWrittenEvent(event())).toBe(
      '11111111-1111-4111-8111-111111111111\t2026-09-02T08:00:00Z → 2026-09-02T08:30:00Z\tCoffee',
    )
  })

  test('uses the dates for an all-day event', () => {
    const line = formatWrittenEvent(
      event({ all_day: true, start: { date: '2026-09-02' }, end: { date: '2026-09-04' } }),
    )

    expect(line).toContain('2026-09-02 → 2026-09-04')
    expect(line).toContain('(all-day)')
  })

  test('shows the rule and the guest count', () => {
    const line = formatWrittenEvent(
      event({
        recurrence: 'FREQ=WEEKLY;BYDAY=WE',
        attendees: [
          { email: 'a@example.com', name: null, calendar_address: null, status: 'needs_action', role: null, cutype: null, response_comment: null },
        ],
      }),
    )

    expect(line).toContain('(recurring: FREQ=WEEKLY;BYDAY=WE, 1 attendee(s))')
  })

  test('marks an edited occurrence', () => {
    expect(formatWrittenEvent(event({ is_exception: true }))).toContain('(exception)')
  })

  test('falls back when the title is inherited or unset', () => {
    expect(formatWrittenEvent(event({ title: null }))).toContain('(no title)')
  })
})
