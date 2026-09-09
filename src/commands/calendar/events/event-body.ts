/**
 * Turning the write flags into the API's event body.
 *
 * Pure and separately tested: this is where every "did the user mean an all-day
 * event or a timed one" decision lives, and it is the only real logic in the
 * calendar write commands.
 *
 * Times are handed to the server as the caller typed them. A bare
 * `YYYY-MM-DDTHH:MM` is a wall-clock time the server resolves in `--timezone`,
 * so the CLI never gets a second, subtly different opinion about what a local
 * time means.
 */

export interface EventBodyOptions {
  title?: string
  start?: string
  end?: string
  allDay?: boolean
  timezone?: string
  location?: string
  description?: string
  url?: string
  transparency?: string
  recurrence?: string
  attendee?: string[]
}

export interface EventBound {
  date?: string
  date_time?: string
  time_zone?: string
}

export interface EventBody {
  title?: string
  location?: string
  description?: string
  url?: string
  transparency?: string
  recurrence?: string
  start?: EventBound
  end?: EventBound
  attendees?: { email: string; name?: string }[]
}

export type BuiltBody = { ok: true; body: EventBody } | { ok: false; message: string }

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const TRANSPARENCIES = ['opaque', 'transparent']

/** The machine's IANA zone, so a timed event lands where the user is sitting. */
function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * `Name <email>` or a bare address. The angle-bracket form is what people
 * already paste out of a mail client, so it is worth accepting.
 */
export function parseAttendee(value: string): { email: string; name?: string } | null {
  const angled = value.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/)
  const email = (angled ? angled[2] : value).trim()
  if (email.length === 0 || !email.includes('@') || /\s/.test(email)) return null

  const name = angled ? angled[1].replace(/^"|"$/g, '').trim() : ''
  return name.length > 0 ? { email, name } : { email }
}

function bound(value: string, allDay: boolean, timezone: string): EventBound {
  if (allDay) return { date: value }

  return { date_time: value, time_zone: timezone }
}

export function buildEventBody(
  options: EventBodyOptions,
  { mode }: { mode: 'create' | 'update' },
): BuiltBody {
  if (mode === 'create') {
    const missing = [
      options.title === undefined ? '--title' : null,
      options.start === undefined ? '--start' : null,
      options.end === undefined ? '--end' : null,
    ].filter(Boolean)

    if (missing.length > 0) {
      return { ok: false, message: `Creating an event needs ${missing.join(', ')}.` }
    }
  }

  if ((options.start === undefined) !== (options.end === undefined)) {
    return { ok: false, message: 'Use --start and --end together, or neither.' }
  }

  const body: EventBody = {}

  if (options.start !== undefined && options.end !== undefined) {
    const allDay = options.allDay === true
    const dateOnly = DATE_ONLY.test(options.start) && DATE_ONLY.test(options.end)

    if (allDay && !dateOnly) {
      return { ok: false, message: '--all-day needs --start and --end as YYYY-MM-DD dates.' }
    }
    if (!allDay && dateOnly) {
      return {
        ok: false,
        message: 'Bare dates mean an all-day event. Add --all-day, or give a time (2026-09-02T09:00).',
      }
    }

    const timezone = options.timezone ?? systemTimeZone()
    body.start = bound(options.start, allDay, timezone)
    body.end = bound(options.end, allDay, timezone)
  }

  if (options.transparency !== undefined) {
    if (!TRANSPARENCIES.includes(options.transparency)) {
      return { ok: false, message: `--transparency must be one of: ${TRANSPARENCIES.join(', ')}.` }
    }
    body.transparency = options.transparency
  }

  // An empty string clears the field, which is how a caller drops a location or
  // turns a series back into a single event.
  if (options.title !== undefined) body.title = options.title
  if (options.location !== undefined) body.location = options.location
  if (options.description !== undefined) body.description = options.description
  if (options.url !== undefined) body.url = options.url
  if (options.recurrence !== undefined) body.recurrence = options.recurrence

  if (options.attendee !== undefined) {
    const attendees = []
    for (const raw of options.attendee) {
      const parsed = parseAttendee(raw)
      if (parsed === null) {
        return { ok: false, message: `Could not read --attendee '${raw}' as an email address.` }
      }
      attendees.push(parsed)
    }
    body.attendees = attendees
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, message: 'Nothing to change. Pass at least one field to update.' }
  }

  return { ok: true, body }
}
