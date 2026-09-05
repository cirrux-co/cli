import { handleApiError } from '../../api-errors.js'
import { type OutputOptions } from '../../output.js'

export interface Calendar {
  object: string
  uuid: string
  calendar_uuid: string
  mailbox_uuid: string
  name: string
  description: string | null
  color: string | null
  role: string
  can_write: boolean
  source: string
  position: number | null
  is_default: boolean
}

export interface CalendarListResponse {
  object: string
  url: string
  has_more: boolean
  data: Calendar[]
}

/** Exactly one of `date` (all-day) and `date_time` (timed) is present. */
export interface CalendarEventDate {
  date?: string
  date_time?: string
  time_zone?: string
}

export interface CalendarEventAttendee {
  email: string | null
  name: string | null
  calendar_address: string | null
  status: string
  role: string | null
  cutype: string | null
  response_comment: string | null
}

export interface CalendarEvent {
  object: string
  id: string
  event_uuid: string
  series_uuid: string | null
  series_group_uuid: string | null
  calendar_uuid: string
  recurrence_id: string | null
  is_exception: boolean
  status: string
  title: string | null
  description: string | null
  location: string | null
  url: string | null
  transparency: string | null
  all_day: boolean
  start: CalendarEventDate
  end: CalendarEventDate
  recurrence: string | null
  sequence: number
  organizer: { email: string | null; name: string | null; calendar_address: string | null } | null
  attendees: CalendarEventAttendee[]
  created_at: string
  updated_at: string
}

export interface CalendarEventListResponse {
  object: string
  url: string
  time_min: string
  time_max: string
  timezone: string
  has_more: boolean
  next_cursor?: string
  data: CalendarEvent[]
}

export { requireCredentials } from '../../session.js'

/**
 * Map a failed calendar API call to a clear message + exit code. Binds the
 * scope wording; the ladder itself lives in `api-errors.ts`.
 */
export function handleCalendarError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'calendar' })
}
