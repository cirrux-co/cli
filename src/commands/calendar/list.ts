import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { type CalendarListResponse, handleCalendarError, requireCredentials } from './calendar-shared.js'

/**
 * Render a calendar listing into the CLI's human text and the newline-joined
 * calendar UUIDs used by --quiet. The quiet value is `calendar_uuid`, not
 * `uuid`, because that is what every other calendar command takes.
 */
export function formatCalendarList(response: CalendarListResponse): { text: string; quietValue: string } {
  const lines = response.data.map((calendar) => {
    const flags = [calendar.role, calendar.is_default ? 'default' : null].filter(Boolean).join(', ')
    return `${calendar.calendar_uuid}\t${calendar.name}\t(${flags})`
  })

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No calendars found.',
    quietValue: response.data.map((calendar) => calendar.calendar_uuid).join('\n'),
  }
}

export async function calendarListCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<CalendarListResponse>('public_api/v1/calendars')

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...formatCalendarList(response),
    })
  } catch (error) {
    handleCalendarError(error, options, { action: 'List calendars' })
  }
}
