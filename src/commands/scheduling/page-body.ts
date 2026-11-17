/**
 * Turning the scheduling page flags into the API's page body. Pure and separately tested: the
 * hours syntax, the lengths, and which host fields an update carries over all live here.
 *
 * The server checks everything that needs knowing what a page is (overlapping hours, an unknown
 * time zone, a calendar the caller can't write to). Here we only turn what was typed into the
 * shape the API takes, and refuse what can't be read at all.
 */
import { type Availability, type HoursRange, type SchedulingPageHost, type Weekday, WEEKDAYS } from './scheduling-shared.js'

export interface PageBodyOptions {
  title?: string
  slug?: string
  description?: string
  location?: string
  duration?: string
  timezone?: string
  hours?: string[]
  window?: string[]
  slot?: string[]
  notice?: string
  daysAhead?: string
  on?: boolean
  off?: boolean
  mailbox?: string
  bookInto?: string
  busyCalendar?: string[]
}

export type PageBody = Record<string, unknown>

export type BuiltPageBody = { ok: true; body: PageBody } | { ok: false; message: string; hint?: string }

const DAY_NAMES: Record<string, Weekday> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
}

const HOURS_EXAMPLE = 'like "mon-fri 09:00-17:00" or "sat 10:00-12:00,14:00-16:00"'

function dayFrom(word: string): Weekday | undefined {
  const key = word.toLowerCase().slice(0, 3)
  const day = DAY_NAMES[key]
  return day && day.startsWith(word.toLowerCase()) ? day : undefined
}

/** "mon-fri", "mon,wed,fri", "weekdays", "daily". */
export function parseDays(value: string): Weekday[] | null {
  const word = value.toLowerCase()
  if (word === 'daily') return [...WEEKDAYS]
  if (word === 'weekdays') return WEEKDAYS.slice(0, 5)
  if (word === 'weekends') return WEEKDAYS.slice(5)

  const days: Weekday[] = []
  for (const part of word.split(',')) {
    const [from, to, ...rest] = part.split('-')
    const first = from ? dayFrom(from) : undefined
    if (!first || rest.length > 0) return null
    if (to === undefined) {
      days.push(first)
      continue
    }
    const last = dayFrom(to)
    if (!last || WEEKDAYS.indexOf(last) < WEEKDAYS.indexOf(first)) return null
    days.push(...WEEKDAYS.slice(WEEKDAYS.indexOf(first), WEEKDAYS.indexOf(last) + 1))
  }
  return [...new Set(days)]
}

/** "9:00" as "09:00"; null when it isn't a time of day. "24:00" ends a day. */
function clock(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return null
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

/** "09:00-12:00,13:00-17:00". */
export function parseRanges(value: string): HoursRange[] | null {
  const ranges: HoursRange[] = []
  for (const part of value.split(',')) {
    const [start, end, ...rest] = part.split('-').map((piece) => piece.trim())
    const from = start ? clock(start) : null
    const to = end ? clock(end) : null
    if (!from || !to || rest.length > 0) return null
    ranges.push({ start: from, end: to })
  }
  return ranges
}

/**
 * Every `--hours` value is "<days> <ranges>". Several of them add up, so a day named twice gets
 * the ranges of both, and a day never named is off.
 */
export function parseHours(values: string[]): { ok: true; hours: Partial<Record<Weekday, HoursRange[]>> } | { ok: false; message: string } {
  const hours: Partial<Record<Weekday, HoursRange[]>> = {}
  for (const value of values) {
    const [dayPart, rangePart, ...rest] = value.trim().split(/\s+/)
    const days = dayPart ? parseDays(dayPart) : null
    const ranges = rangePart ? parseRanges(rangePart) : null
    if (!days || !ranges || rest.length > 0) {
      return { ok: false, message: `Could not read --hours "${value}": write days and times, ${HOURS_EXAMPLE}.` }
    }
    for (const day of days) hours[day] = [...(hours[day] ?? []), ...ranges]
  }
  return { ok: true, hours }
}

/** "30", "30m", "1h", "1h30m", "2d" as minutes; null when it isn't a length. */
export function parseMinutes(value: string): number | null {
  const text = value.trim().toLowerCase()
  if (/^\d+$/.test(text)) return Number(text)
  const match = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/.exec(text)
  if (!match || text === '') return null
  const [, days = '0', hours = '0', minutes = '0'] = match
  return Number(days) * 1440 + Number(hours) * 60 + Number(minutes)
}

function availabilityFrom(options: PageBodyOptions): { ok: true; availability?: Availability } | { ok: false; message: string } {
  const given = [options.hours, options.window, options.slot].filter((list) => list && list.length > 0)
  if (given.length > 1) {
    return { ok: false, message: 'Pass one of --hours, --window or --slot: a page offers one kind of time.' }
  }

  if (options.hours?.length) {
    const parsed = parseHours(options.hours)
    return parsed.ok ? { ok: true, availability: { type: 'recurring', hours: parsed.hours } } : parsed
  }

  if (options.window?.length) {
    const windows = []
    for (const value of options.window) {
      const [start, end, ...rest] = value.split('/')
      if (!start || !end || rest.length > 0) {
        return { ok: false, message: `Could not read --window "${value}": write <start>/<end>, like 2026-12-01T09:00+01:00/2026-12-01T12:00+01:00.` }
      }
      windows.push({ start, end })
    }
    return { ok: true, availability: { type: 'windows', windows } }
  }

  if (options.slot?.length) {
    return { ok: true, availability: { type: 'slots', slots: options.slot.map((start) => ({ start })) } }
  }

  return { ok: true }
}

/**
 * The host fields to send. The API resolves a host from what it is given and fills in the rest
 * from the caller's own calendars, so an update that changes one field carries the others over
 * from the page as it is. A different mailbox carries nothing: its calendars are other ones.
 */
function hostFrom(options: PageBodyOptions, current: SchedulingPageHost | undefined): Record<string, unknown> | undefined {
  const changes = options.mailbox !== undefined || options.bookInto !== undefined || options.busyCalendar?.length
  if (!changes) return undefined

  const sameMailbox = current && (options.mailbox === undefined || options.mailbox === current.mailbox_uuid)
  const carried = sameMailbox ? current : undefined
  const host: Record<string, unknown> = {}
  const mailbox = options.mailbox ?? carried?.mailbox_uuid
  const bookInto = options.bookInto ?? carried?.booking_calendar_uuid
  const busy = options.busyCalendar?.length ? options.busyCalendar : carried?.availability_calendar_uuids
  if (mailbox) host.mailbox_uuid = mailbox
  if (bookInto) host.booking_calendar_uuid = bookInto
  if (busy?.length) host.availability_calendar_uuids = busy
  return host
}

/**
 * The request body for a create or an update, or the usage error to print instead. An update sends
 * only what was passed; an empty --description or --location clears it.
 */
export function buildPageBody(
  options: PageBodyOptions,
  { mode, currentHost }: { mode: 'create' | 'update'; currentHost?: SchedulingPageHost },
): BuiltPageBody {
  const body: PageBody = {}

  if (options.title !== undefined) {
    const title = options.title.trim()
    if (!title) return { ok: false, message: 'A page needs a title: --title cannot be empty.' }
    body.title = title
  }
  if (options.slug !== undefined) body.slug = options.slug.trim()
  if (options.description !== undefined) body.description = options.description.trim() || null
  if (options.location !== undefined) body.location = options.location.trim() || null
  if (options.timezone !== undefined) body.timezone = options.timezone

  if (options.duration !== undefined) {
    const minutes = parseMinutes(options.duration)
    if (minutes === null) return { ok: false, message: `Could not read --duration "${options.duration}": write minutes, like 30, 45m or 1h30m.` }
    body.duration_minutes = minutes
  }
  if (options.notice !== undefined) {
    const minutes = parseMinutes(options.notice)
    if (minutes === null) return { ok: false, message: `Could not read --notice "${options.notice}": write a length, like 4h, 30m or 1d.` }
    body.minimum_notice_minutes = minutes
  }
  if (options.daysAhead !== undefined) {
    if (!/^\d+$/.test(options.daysAhead.trim())) {
      return { ok: false, message: `Could not read --days-ahead "${options.daysAhead}": write a number of days, like 60.` }
    }
    body.booking_window_days = Number(options.daysAhead)
  }

  if (options.on && options.off) return { ok: false, message: 'Pass --on or --off, not both.' }
  if (options.on) body.active = true
  if (options.off) body.active = false

  const availability = availabilityFrom(options)
  if (!availability.ok) return availability
  if (availability.availability) body.availability = availability.availability

  const host = hostFrom(options, currentHost)
  if (host) body.hosts = [host]

  if (mode === 'create') {
    if (body.title === undefined) return { ok: false, message: 'A page needs a title.', hint: 'Pass --title "Intro call".' }
    if (body.duration_minutes === undefined) {
      return { ok: false, message: 'A page needs a length.', hint: 'Pass --duration 30 (minutes, or 1h, 1h30m).' }
    }
  } else if (Object.keys(body).length === 0) {
    return { ok: false, message: 'Nothing to change.', hint: "See 'cirrux scheduling pages update --help' for what can be changed." }
  }

  return { ok: true, body }
}
