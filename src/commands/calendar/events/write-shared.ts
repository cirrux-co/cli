import { type CalendarEvent } from '../calendar-shared.js'

/**
 * One line describing the event that was written, in the same shape
 * `calendar events list` uses, so output stays recognisable across commands.
 */
export function formatWrittenEvent(event: CalendarEvent): string {
  const start = event.start.date ?? event.start.date_time ?? ''
  const end = event.end.date ?? event.end.date_time ?? ''

  const markers = [
    event.all_day ? 'all-day' : null,
    event.is_exception ? 'exception' : null,
    event.recurrence ? `recurring: ${event.recurrence}` : null,
    event.attendees.length > 0 ? `${event.attendees.length} attendee(s)` : null,
  ].filter(Boolean)
  const suffix = markers.length > 0 ? `  (${markers.join(', ')})` : ''

  return `${event.id}\t${start} → ${end}\t${event.title ?? '(no title)'}${suffix}`
}
