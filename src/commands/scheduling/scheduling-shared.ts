import { handleApiError, type ApiErrorRule } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { type OutputOptions } from '../../output.js'

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export interface HoursRange {
  start: string
  end: string
}

export type Availability =
  | { type: 'recurring'; hours: Partial<Record<Weekday, HoursRange[]>> }
  | { type: 'windows'; windows: { start: string; end: string }[] }
  | { type: 'slots'; slots: { start: string }[] }

export interface SchedulingPageHost {
  user_uuid: string
  mailbox_uuid: string
  booking_calendar_uuid: string
  availability_calendar_uuids: string[]
}

export interface SchedulingPage {
  object: string
  uuid: string
  url: string
  slug: string
  title: string
  description: string | null
  location: string | null
  duration_minutes: number
  timezone: string
  active: boolean
  hold_times: boolean
  minimum_notice_minutes: number
  booking_window_days: number
  availability: Availability
  hosts: SchedulingPageHost[]
  created_at: string
  updated_at: string
}

export interface SchedulingPageListResponse {
  object: string
  url: string
  has_more: boolean
  data: SchedulingPage[]
}

export interface SlotListResponse {
  object: string
  url: string
  has_more: boolean
  timezone: string
  data: { start: string; end: string }[]
}

export { requireCredentials } from '../../session.js'

export const SCHEDULING_ERROR_RULES: ApiErrorRule[] = [
  {
    status: 403,
    errorCode: 'forbidden',
    exitCode: ExitCode.AUTH_REQUIRED,
    hint: (error) =>
      error.apiKeySource
        ? "A scheduling page belongs to a person, so it needs a login, not an API key. Run 'cirrux login'."
        : "Changing a page takes write access to the calendar it books into: see can_write in 'cirrux calendar list'.",
  },
  {
    errorCode: 'slug_taken',
    exitCode: ExitCode.CONFLICT,
    hint: 'Pick another --slug. Leave it out when creating to get one made from the title.',
  },
  {
    status: 402,
    errorCode: 'subscription_required',
    exitCode: ExitCode.USAGE_ERROR,
  },
]

/**
 * Map a failed scheduling page call to a clear message and exit code. Pages share the calendar
 * scopes, so a session without them is told to log in again for calendar access.
 */
export function handleSchedulingError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'calendar', rules: SCHEDULING_ERROR_RULES })
}
