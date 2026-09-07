import { test, expect } from 'bun:test'
import { formatCalendarList } from './list.js'
import type { Calendar, CalendarListResponse } from './calendar-shared.js'

function calendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    object: 'calendar',
    uuid: 'mc-1',
    calendar_uuid: 'cal-1',
    mailbox_uuid: 'mb-1',
    mailbox_address: 'rick@example.com',
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

  expect(text).toBe('cal-1\tWork\trick@example.com\t(owner, default)')
  expect(quietValue).toBe('cal-1')
})

test('formatCalendarList omits the default marker when the calendar is not one', () => {
  const { text } = formatCalendarList(response([calendar({ is_default: false, role: 'viewer' })]))

  expect(text).toBe('cal-1\tWork\trick@example.com\t(viewer)')
})

// A calendar linked into two mailboxes is two entries sharing one calendar_uuid. --quiet emits
// what the events command takes, so the same uuid legitimately appears twice.
test('formatCalendarList keeps one line per mailbox link, named by its mailbox', () => {
  const { text, quietValue } = formatCalendarList(
    response([
      calendar(),
      calendar({
        uuid: 'mc-2',
        mailbox_uuid: 'mb-2',
        mailbox_address: 'rick@other.example.com',
        role: 'viewer',
        is_default: false,
      }),
    ]),
  )

  // Same calendar_uuid and same name on both lines: the mailbox address is the only
  // thing telling the caller which entry is which.
  expect(text.split('\n')).toEqual([
    'cal-1\tWork\trick@example.com\t(owner, default)',
    'cal-1\tWork\trick@other.example.com\t(viewer)',
  ])
  expect(quietValue).toBe('cal-1\ncal-1')
})

// primary_address falls back to the legacy mailboxes.address, but a mailbox with neither
// still has to render — the flags must not slide into the address column.
test('formatCalendarList drops the address column when the mailbox has no address', () => {
  const { text } = formatCalendarList(response([calendar({ mailbox_address: null })]))

  expect(text).toBe('cal-1\tWork\t(owner, default)')
})

test('formatCalendarList says so when there are none', () => {
  const { text, quietValue } = formatCalendarList(response([]))

  expect(text).toBe('No calendars found.')
  expect(quietValue).toBe('')
})
