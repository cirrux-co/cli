import { authedRequest } from '../../api.js'
import { deferred, output, type OutputOptions } from '../../output.js'
import { type CalendarListResponse, handleCalendarError, requireCredentials } from './calendar-shared.js'

/**
 * Render a calendar listing into the CLI's human text and the newline-joined
 * calendar UUIDs used by --quiet. The quiet value is `calendar_uuid`, not
 * `uuid`, because that is what every other calendar command takes.
 *
 * The mailbox address is on the line because a user with several mailboxes has several
 * calendars called "Calendar", and one entry per mailbox link means even a single shared
 * calendar appears twice — the address is what distinguishes them.
 */
export function formatCalendarList(response: CalendarListResponse): { text: string; quietValue: string } {
  const lines = response.data.map((calendar) => {
    const flags = [calendar.role, calendar.is_default ? 'default' : null].filter(Boolean).join(', ')
    const columns = [calendar.calendar_uuid, calendar.name, calendar.mailbox_address, `(${flags})`]

    return columns.filter(Boolean).join('\t')
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
      ...deferred(() => formatCalendarList(response)),
    })
  } catch (error) {
    handleCalendarError(error, options, { action: 'List calendars' })
  }
}
