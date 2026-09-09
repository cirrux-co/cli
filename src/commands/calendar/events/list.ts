import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { deferred, output, outputError, type OutputOptions } from '../../../output.js'
import {
  type CalendarEvent,
  type CalendarEventListResponse,
  handleCalendarError,
  requireCredentials,
} from '../calendar-shared.js'

export interface WindowOptions {
  from?: string
  to?: string
  days?: string
  today?: boolean
  on?: string
  timezone?: string
}

export type ResolvedWindow =
  | { ok: true; timeMin?: string; timeMax?: string; timezone?: string }
  | { ok: false; message: string }

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** The machine's IANA zone, used to decide which day "today" is. */
function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Today's calendar date in `timeZone`, as `YYYY-MM-DD`.
 *
 * Built from `formatToParts` rather than a locale that happens to format as
 * ISO, so it does not depend on the host's locale data ordering.
 */
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

/**
 * Add whole days to a `YYYY-MM-DD` label.
 *
 * This is calendar arithmetic on a zoneless date, not on an instant, so UTC
 * math is exact and unaffected by DST — the server resolves each end to local
 * midnight in the window's timezone.
 */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY)
  return shifted.toISOString().slice(0, 10)
}

/**
 * Turn the window flags into the `time_min`/`time_max` the API takes.
 *
 * Dates are handed to the server as bare `YYYY-MM-DD` wherever the caller gave
 * one, because the server reads those as start-of-day in the window's timezone
 * — the CLI does not get a second, subtly different opinion on what a date is.
 *
 * `--today` / `--on` resolve the day in the window's timezone and pin that
 * timezone on the request, so the date and the day boundaries cannot disagree.
 * `--days` means calendar days when `--from` is a date, and 24-hour periods
 * when it is an instant (or absent, i.e. "the next N days from now").
 */
export function resolveWindow(options: WindowOptions): ResolvedWindow {
  const singleDay = [options.today ? '--today' : null, options.on !== undefined ? '--on' : null].filter(
    Boolean,
  )
  const rangeFlags = [
    options.from !== undefined ? '--from' : null,
    options.to !== undefined ? '--to' : null,
    options.days !== undefined ? '--days' : null,
  ].filter(Boolean)

  if (singleDay.length === 2) {
    return { ok: false, message: 'Use either --today or --on <date>, not both.' }
  }

  if (singleDay.length === 1 && rangeFlags.length > 0) {
    return {
      ok: false,
      message: `${singleDay[0]} already picks a single day, so it cannot be combined with ${rangeFlags.join(' / ')}.`,
    }
  }

  if (singleDay.length === 1) {
    const timezone = options.timezone ?? systemTimeZone()

    if (options.on !== undefined && !DATE_ONLY.test(options.on)) {
      return { ok: false, message: '--on takes a calendar date as YYYY-MM-DD.' }
    }

    const date = options.today ? todayIn(timezone) : (options.on as string)
    return { ok: true, timeMin: date, timeMax: addDays(date, 1), timezone }
  }

  if (options.days !== undefined && options.to !== undefined) {
    return { ok: false, message: 'Use either --days <n> or --to <date>, not both.' }
  }

  if (options.days === undefined) {
    return { ok: true, timeMin: options.from, timeMax: options.to, timezone: options.timezone }
  }

  const days = Number(options.days)
  if (!Number.isInteger(days) || days < 1) {
    return { ok: false, message: '--days must be a positive whole number of days.' }
  }

  // A bare date stays a date, so both ends land on local midnight in the
  // window's timezone — the same boundary `--from`/`--to` would have given.
  if (options.from !== undefined && DATE_ONLY.test(options.from)) {
    return {
      ok: true,
      timeMin: options.from,
      timeMax: addDays(options.from, days),
      timezone: options.timezone,
    }
  }

  const start = options.from ? new Date(options.from) : new Date()
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: `Could not read --from '${options.from}' as a date.` }
  }

  const end = new Date(start.getTime() + days * MS_PER_DAY)

  return {
    ok: true,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    timezone: options.timezone,
  }
}

function formatBound(event: CalendarEvent): string {
  const start = event.start.date ?? event.start.date_time ?? ''
  const end = event.end.date ?? event.end.date_time ?? ''
  return `${start} → ${end}`
}

/**
 * One line per occurrence: the id first so it can be piped, then when and what.
 * `--quiet` emits just the ids.
 */
export function formatCalendarEvents(response: CalendarEventListResponse): {
  text: string
  quietValue: string
} {
  const lines = response.data.map((event) => {
    const markers = [
      event.all_day ? 'all-day' : null,
      event.is_exception ? 'exception' : null,
      event.series_uuid ? 'recurring' : null,
    ].filter(Boolean)
    const suffix = markers.length > 0 ? `  (${markers.join(', ')})` : ''

    return `${event.id}\t${formatBound(event)}\t${event.title ?? '(no title)'}${suffix}`
  })

  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No events in this window.',
    quietValue: response.data.map((event) => event.id).join('\n'),
  }
}

export async function calendarEventsListCommand(
  calendarUuid: string,
  options: OutputOptions & WindowOptions & { limit?: string; cursor?: string },
): Promise<void> {
  requireCredentials(options)

  const window = resolveWindow(options)
  if (!window.ok) {
    outputError(window.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  try {
    const params = new URLSearchParams()
    if (window.timeMin) params.set('time_min', window.timeMin)
    if (window.timeMax) params.set('time_max', window.timeMax)
    if (window.timezone) params.set('timezone', window.timezone)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)

    const query = params.toString()
    const path = `public_api/v1/calendars/${encodeURIComponent(calendarUuid)}/events${query ? `?${query}` : ''}`

    const response = await authedRequest<CalendarEventListResponse>(path)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatCalendarEvents(response)),
    })
  } catch (error) {
    handleCalendarError(error, options, {
      action: 'List events',
      notFound: `Calendar '${calendarUuid}' not found.`,
    })
  }
}
