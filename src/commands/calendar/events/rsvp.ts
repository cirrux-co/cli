import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import { type CalendarEvent, handleCalendarError, requireCredentials } from '../calendar-shared.js'
import { buildRsvpBody, rsvpStatusLabel, type RsvpOptions } from './rsvp-body.js'
import { formatWrittenEvent } from './write-shared.js'

export async function calendarEventsRsvpCommand(
  calendarUuid: string,
  eventId: string,
  options: OutputOptions & RsvpOptions,
): Promise<void> {
  requireCredentials(options)

  const built = buildRsvpBody(options)
  if (!built.ok) {
    outputError(built.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  try {
    const event = await authedRequest<CalendarEvent>(
      `public_api/v1/calendars/${encodeURIComponent(calendarUuid)}/events/${encodeURIComponent(eventId)}/rsvp`,
      { method: 'POST', body: built.body as unknown as Record<string, unknown> },
    )

    output(event as unknown as Record<string, unknown>, {
      ...options,
      text: () => `${rsvpStatusLabel(built.body.status)}: ${formatWrittenEvent(event)}`,
      quietValue: () => event.id,
    })
  } catch (error) {
    handleCalendarError(error, options, {
      action: 'Answer invitation',
      notFound: `Event '${eventId}' not found on calendar '${calendarUuid}'.`,
    })
  }
}
