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

export { requireCredentials } from '../../session.js'

export const TASKS_ERROR_RULES: ApiErrorRule[] = [
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
