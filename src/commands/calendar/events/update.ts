import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import { type CalendarEvent, handleCalendarError, requireCredentials } from '../calendar-shared.js'
import { buildEventBody, type EventBodyOptions } from './event-body.js'
import { formatWrittenEvent } from './write-shared.js'

export async function calendarEventsUpdateCommand(
  calendarUuid: string,
  eventId: string,
  options: OutputOptions & EventBodyOptions,
): Promise<void> {
  requireCredentials(options)

  const built = buildEventBody(options, { mode: 'update' })
  if (!built.ok) {
    outputError(built.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  try {
    const event = await authedRequest<CalendarEvent>(
      `public_api/v1/calendars/${encodeURIComponent(calendarUuid)}/events/${encodeURIComponent(eventId)}`,
      { method: 'POST', body: built.body as unknown as Record<string, unknown> },
    )

    output(event as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatWrittenEvent(event),
      quietValue: () => event.id,
    })
  } catch (error) {
    handleCalendarError(error, options, {
      action: 'Update event',
      notFound: `Event '${eventId}' not found on calendar '${calendarUuid}'.`,
    })
  }
}
