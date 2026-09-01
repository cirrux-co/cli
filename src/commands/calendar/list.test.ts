import { test, expect } from 'bun:test'
import { formatCalendarList } from './list.js'
import type { Calendar, CalendarListResponse } from './calendar-shared.js'

function calendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    object: 'calendar',
    uuid: 'mc-1',
    calendar_uuid: 'cal-1',
    mailbox_uuid: 'mb-1',
    name: 'Work',
    description: null,
    color: '#00CCAA',
    role: 'owner',
    can_write: true,
    source: 'owned',
    position: 0,
    is_default: true,
    ...overrides,
  }
}

function response(data: Calendar[]): CalendarListResponse {
  return { object: 'list', url: '/v1/calendars', has_more: false, data }
}

test('formatCalendarList lists the calendar uuid, name and role', () => {
  const { text, quietValue } = formatCalendarList(response([calendar()]))

  expect(text).toBe('cal-1\tWork\t(owner, default)')
  expect(quietValue).toBe('cal-1')
})

test('formatCalendarList omits the default marker when the calendar is not one', () => {
  const { text } = formatCalendarList(response([calendar({ is_default: false, role: 'viewer' })]))

  expect(text).toBe('cal-1\tWork\t(viewer)')
})

// A calendar linked into two mailboxes is two entries sharing one calendar_uuid. --quiet emits
// what the events command takes, so the same uuid legitimately appears twice.
test('formatCalendarList keeps one line per mailbox link', () => {
  const { text, quietValue } = formatCalendarList(
    response([calendar(), calendar({ uuid: 'mc-2', mailbox_uuid: 'mb-2', role: 'viewer', is_default: false })]),
  )

  expect(text.split('\n')).toHaveLength(2)
  expect(quietValue).toBe('cal-1\ncal-1')
})

test('formatCalendarList says so when there are none', () => {
  const { text, quietValue } = formatCalendarList(response([]))

  expect(text).toBe('No calendars found.')
  expect(quietValue).toBe('')
})
