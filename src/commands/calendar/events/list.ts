import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
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
}

export type ResolvedWindow =
  | { ok: true; timeMin?: string; timeMax?: string }
  | { ok: false; message: string }

/**
 * Turn `--from/--to/--days` into the `time_min`/`time_max` the API takes.
 * Values are passed through untouched — the server owns parsing and the error
 * messages, so the CLI does not get a second, subtly different opinion on what
 * a date is. `--days` is shorthand for "N days from --from (or now)", and is
 * mutually exclusive with `--to`.
 */
export function resolveWindow(options: WindowOptions): ResolvedWindow {
  if (options.days !== undefined && options.to !== undefined) {
    return { ok: false, message: 'Use either --days <n> or --to <date>, not both.' }
  }

  if (options.days === undefined) {
    return { ok: true, timeMin: options.from, timeMax: options.to }
  }

  const days = Number(options.days)
  if (!Number.isInteger(days) || days < 1) {
    return { ok: false, message: '--days must be a positive whole number of days.' }
  }

  const start = options.from ? new Date(options.from) : new Date()
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: `Could not read --from '${options.from}' as a date.` }
  }

  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)

  return { ok: true, timeMin: start.toISOString(), timeMax: end.toISOString() }
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
  options: OutputOptions & WindowOptions & { timezone?: string; limit?: string; cursor?: string },
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
    if (options.timezone) params.set('timezone', options.timezone)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)

    const query = params.toString()
    const path = `public_api/v1/calendars/${encodeURIComponent(calendarUuid)}/events${query ? `?${query}` : ''}`

    const response = await authedRequest<CalendarEventListResponse>(path)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...formatCalendarEvents(response),
    })
  } catch (error) {
    handleCalendarError(error, options, {
      action: 'List events',
      notFound: `Calendar '${calendarUuid}' not found.`,
    })
  }
}
