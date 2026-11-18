import { expect, test } from 'bun:test'
import { formatHours, formatLength, formatPage, formatPageList, formatSlots, formatWrittenPage, hostNamesFrom } from './format.js'
import type { Calendar } from '../calendar/calendar-shared.js'
import { parseHours } from './page-body.js'
import type { SchedulingPage } from './scheduling-shared.js'

function page(overrides: Partial<SchedulingPage> = {}): SchedulingPage {
  return {
    object: 'scheduling_page',
    uuid: 'page-1',
    url: 'https://book.cirrux.co/s/intro-call',
    slug: 'intro-call',
    title: 'Intro call',
    description: null,
    location: null,
    duration_minutes: 30,
    timezone: 'Europe/Amsterdam',
    active: true,
    hold_times: false,
    minimum_notice_minutes: 240,
    booking_window_days: 60,
    availability: {
      type: 'recurring',
      hours: Object.fromEntries(
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => [day, [{ start: '09:00', end: '17:00' }]]),
      ),
    },
    hosts: [{ user_uuid: 'u-1', mailbox_uuid: 'mb-1', booking_calendar_uuid: 'cal-1', availability_calendar_uuids: ['cal-1'] }],
    created_at: '2026-11-17T10:00:00Z',
    updated_at: '2026-11-17T10:00:00Z',
    ...overrides,
  }
}

test('lengths read the short way', () => {
  expect(formatLength(30)).toBe('30 min')
  expect(formatLength(60)).toBe('1h')
  expect(formatLength(90)).toBe('1h30m')
  expect(formatLength(1440)).toBe('1d')
})

test('hours put every day with the same times on one line', () => {
  expect(
    formatHours({
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '12:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [
        { start: '10:00', end: '12:00' },
        { start: '14:00', end: '16:00' },
      ],
    }),
  ).toEqual(['mon,tue,fri 09:00-17:00', 'wed 09:00-12:00', 'sat 10:00-12:00,14:00-16:00'])
  expect(
    formatHours(Object.fromEntries(['monday', 'tuesday', 'wednesday', 'friday'].map((day) => [day, [{ start: '09:00', end: '17:00' }]]))),
  ).toEqual(['mon-wed,fri 09:00-17:00'])
})

// What `get` prints is what `--hours` takes, so a page's hours can be copied, edited and sent back.
test('printed hours read back as the same hours', () => {
  const hours = {
    monday: [{ start: '09:00', end: '12:00' }],
    tuesday: [{ start: '09:00', end: '12:00' }],
    thursday: [
      { start: '08:00', end: '10:00' },
      { start: '13:00', end: '17:30' },
    ],
    friday: [{ start: '09:00', end: '12:00' }],
  }
  expect(parseHours(formatHours(hours))).toEqual({ ok: true, hours })
})

test('the list is a line per page, with its link', () => {
  const { text, quietValue } = formatPageList({
    object: 'list',
    url: '/v1/scheduling_pages',
    has_more: false,
    data: [page(), page({ uuid: 'page-2', active: false, duration_minutes: 60, title: 'Deep dive', url: 'https://book.cirrux.co/s/deep' })],
  })

  expect(text.split('\n')).toEqual([
    'page-1\ton\t30 min\tIntro call\thttps://book.cirrux.co/s/intro-call',
    'page-2\toff\t1h\tDeep dive\thttps://book.cirrux.co/s/deep',
  ])
  expect(quietValue).toBe('page-1\npage-2')
  expect(formatPageList({ object: 'list', url: '', has_more: false, data: [] }).text).toBe('No scheduling pages found.')
})

test('one page shows its link, hours, rules and calendars', () => {
  const text = formatPage(page({ location: 'https://meet.example.com/intro', description: 'A first chat.' }))

  expect(text).toContain('Intro call  (on)\nhttps://book.cirrux.co/s/intro-call')
  expect(text).toContain('hours       mon-fri 09:00-17:00')
  expect(text).toContain('notice      4h')
  expect(text).toContain('books into  cal-1')
  expect(text.endsWith('\n\nA first chat.')).toBe(true)
  expect(text).not.toContain('held')
})

test('a page holding its slots says so under them', () => {
  const held = page({ hold_times: true, availability: { type: 'slots', slots: [{ start: '2026-12-03T10:00:00+01:00' }] } })

  expect(formatPage(held)).toContain('slots       2026-12-03T10:00:00+01:00\nheld        in the calendar until the first booking')
})

function calendar(overrides: Partial<Calendar>): Calendar {
  return {
    object: 'calendar',
    uuid: 'link-1',
    calendar_uuid: 'cal-1',
    mailbox_uuid: 'mb-1',
    mailbox_address: 'jan@example.com',
    name: 'Calendar',
    description: null,
    color: null,
    role: 'owner',
    can_write: true,
    source: 'internal',
    position: 0,
    is_default: true,
    ...overrides,
  }
}

test("the host's mailbox and calendars read as addresses and names, so an unexpected host shows", () => {
  const names = hostNamesFrom([
    calendar({}),
    calendar({ uuid: 'link-2', calendar_uuid: 'cal-2', name: 'Family', mailbox_address: 'jan@example.com' }),
  ])
  const busy = page({
    hosts: [{ user_uuid: 'u-1', mailbox_uuid: 'mb-1', booking_calendar_uuid: 'cal-1', availability_calendar_uuids: ['cal-1', 'cal-2', 'cal-9'] }],
  })

  const lines = formatPage(busy, names).split('\n')
  expect(lines).toContain('mailbox     jan@example.com')
  expect(lines).toContain('books into  Calendar (jan@example.com)')
  expect(lines).toContain('busy from   Calendar (jan@example.com)')
  expect(lines).toContain('            Family (jan@example.com)')
  expect(lines).toContain('            cal-9')
  expect(formatWrittenPage(busy, names).endsWith('\thttps://book.cirrux.co/s/intro-call\tjan@example.com')).toBe(true)
  expect(formatWrittenPage(busy).endsWith('\tmb-1')).toBe(true)
})

test('slots read a day per line, start times in the zone they were asked for', () => {
  const { text, quietValue } = formatSlots({
    object: 'list',
    url: '',
    has_more: false,
    timezone: 'Europe/Amsterdam',
    data: [
      { start: '2026-12-01T09:00:00+01:00', end: '2026-12-01T09:30:00+01:00' },
      { start: '2026-12-01T09:30:00+01:00', end: '2026-12-01T10:00:00+01:00' },
      { start: '2026-12-02T14:00:00+01:00', end: '2026-12-02T14:30:00+01:00' },
    ],
  })

  expect(text).toBe('Times in Europe/Amsterdam:\n2026-12-01  09:00 09:30\n2026-12-02  14:00')
  expect(quietValue.split('\n')).toHaveLength(3)
})
