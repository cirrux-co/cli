import { ApiError } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

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

export function requireCredentials(options: OutputOptions): void {
  if (!getActiveCredentials()) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }
}

/**
 * Map a failed calendar API call to a clear message + exit code. A 403
 * `insufficient_scope` is the common one: every session created before the
 * calendar scopes existed lacks them, so the fix is to log in again.
 */
export function handleCalendarError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  if (error instanceof ApiError) {
    if (error.status === 403 && error.body.includes('insufficient_scope')) {
      outputError('Your session is missing calendar permissions.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        hint: "Run 'cirrux login' again to grant calendar access.",
        errorType: 'insufficient_scope',
      })
    }

    if (error.status === 404) {
      outputError(context.notFound ?? 'Not found.', {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    if (error.status === 403) {
      outputError('You do not have permission to perform this action.', {
        ...options,
        code: ExitCode.AUTH_REQUIRED,
        errorType: 'forbidden',
      })
    }

    if (error.status === 422) {
      outputError(`${context.action} failed: ${error.description ?? 'the request was rejected.'}`, {
        ...options,
        code: ExitCode.USAGE_ERROR,
        errorType: 'invalid_range',
      })
    }

    if (error.status === 429) {
      const waitSeconds = error.retryAfterMs !== undefined ? Math.ceil(error.retryAfterMs / 1000) : undefined
      outputError(`${context.action} failed: rate limit exceeded.`, {
        ...options,
        code: ExitCode.RATE_LIMITED,
        errorType: 'rate_limited',
        hint: waitSeconds
          ? `Wait ${waitSeconds}s before retrying, or slow the request rate.`
          : 'Wait a moment before retrying, or slow the request rate.',
      })
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  outputError(`${context.action} failed: ${message}`, {
    ...options,
    code: ExitCode.GENERAL_FAILURE,
    errorType: 'api_error',
  })
}
