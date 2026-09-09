import { authedRequestVoid } from '../../../api.js'
import { confirm } from '../../../confirm.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import { handleCalendarError, requireCredentials } from '../calendar-shared.js'

/**
 * A bare uuid deletes the whole event (for a series, every occurrence); an
 * occurrence id cancels just that one. Either way the guests get an email, which
 * is why this is the one command that confirms first.
 */
export async function calendarEventsDeleteCommand(
  calendarUuid: string,
  eventId: string,
  options: OutputOptions & { yes?: boolean },
): Promise<void> {
  requireCredentials(options)

  if (!options.yes) {
    const isOccurrence = eventId.includes('_')
    const what = isOccurrence
      ? `occurrence ${eventId}`
      : `event ${eventId} (every occurrence, if it repeats)`

    if (!(await confirm(`Delete ${what}? Guests will be emailed a cancellation.`))) {
      outputError('Cancelled.', {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'not_confirmed',
        hint: 'Pass --yes to delete without confirming.',
      })
    }
  }

  try {
    await authedRequestVoid(
      `public_api/v1/calendars/${encodeURIComponent(calendarUuid)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    )

    output(
      { id: eventId, deleted: true },
      { ...options, text: () => `Deleted ${eventId}`, quietValue: () => eventId },
    )
  } catch (error) {
    handleCalendarError(error, options, {
      action: 'Delete event',
      notFound: `Event '${eventId}' not found on calendar '${calendarUuid}'.`,
    })
  }
}
