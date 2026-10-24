import { authedRequest } from '../../../api.js'
import { deferred, output, type OutputOptions } from '../../../output.js'
import { handleTasksError, requireCredentials, type TaskListListResponse } from '../tasks-shared.js'

/**
 * Render a task list listing into the CLI's human text and the newline-joined list UUIDs used by
 * --quiet. The quiet value is `task_list_uuid`, not `uuid`, because that is what the task commands
 * take. The mailbox address is on the line for the same reason as in `calendar list`: every mailbox
 * has a list called "Reminders".
 */
export function formatTaskListList(response: TaskListListResponse): { text: string; quietValue: string } {
  const lines = response.data.map((list) => {
    const columns = [list.task_list_uuid, list.name, list.mailbox_address, `(${list.role})`]

    return columns.filter(Boolean).join('\t')
  })

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No task lists found.',
    quietValue: response.data.map((list) => list.task_list_uuid).join('\n'),
  }
}

export async function tasksListsListCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<TaskListListResponse>('public_api/v1/task_lists')

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatTaskListList(response)),
    })
  } catch (error) {
    handleTasksError(error, options, { action: 'List task lists' })
  }
}
