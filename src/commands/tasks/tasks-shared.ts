import { handleApiError, type ApiErrorRule } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { type OutputOptions } from '../../output.js'

/** One mailbox's entry for a task list. `task_list_uuid` is what every task command takes. */
export interface TaskList {
  object: string
  uuid: string
  task_list_uuid: string
  mailbox_uuid: string
  mailbox_address: string | null
  name: string
  color: string | null
  role: string
  can_write: boolean
  source: string
  position: number | null
}

export interface TaskListListResponse {
  object: string
  url: string
  has_more: boolean
  data: TaskList[]
}

/** Exactly one of `date` (an all-day due date) and `date_time` (a UTC instant) is present. */
export interface TaskDue {
  date?: string
  date_time?: string
}

export interface Task {
  object: string
  uuid: string
  task_list_uuid: string
  title: string
  notes: string | null
  status: 'needs_action' | 'in_process' | 'completed' | 'cancelled'
  due: TaskDue | null
  completed_at: string | null
  recurring: boolean
  created_at: string
  updated_at: string
}

export interface TaskListResponse {
  object: string
  url: string
  has_more: boolean
  next_cursor?: string
  data: Task[]
}

export { requireCredentials } from '../../session.js'

export const TASKS_ERROR_RULES: ApiErrorRule[] = [
  {
    errorCode: 'not_authorized',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'you have read-only access to this task list.',
    hint: "Run 'cirrux tasks lists list' to see which lists have can_write set.",
  },
  {
    errorCode: 'recurring_task',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'this task repeats, and only its title and notes can be changed here.',
    hint: 'Complete or delete it in a reminders app.',
  },
  {
    errorCode: 'not_owner',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'only the owner of this task list can delete it.',
  },
  {
    errorCode: 'holds_events',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'this task list is also a calendar with events, and deleting it would delete them too.',
    hint: 'Delete it from the calendar app instead.',
  },
  {
    errorCode: 'mailbox_uuid_required',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'this task list is in more than one of your mailboxes.',
    hint: "Pass --mailbox-uuid <uuid> to say which one (see 'cirrux tasks lists list').",
  },
  {
    status: 402,
    errorCode: 'subscription_required',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'this workspace needs a subscription to create task lists.',
  },
]

/**
 * Map a failed tasks API call to a clear message + exit code. Task access is its own grant
 * (`tasks.*`), so a session that only has calendar access is told to log in again for tasks.
 */
export function handleTasksError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'tasks', rules: TASKS_ERROR_RULES })
}
