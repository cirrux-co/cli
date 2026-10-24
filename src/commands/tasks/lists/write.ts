import { authedRequest, authedRequestVoid } from '../../../api.js'
import { confirm } from '../../../confirm.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import { handleTasksError, requireCredentials, type TaskList } from '../tasks-shared.js'

export interface TaskListWriteOptions extends OutputOptions {
  name?: string
  color?: string
  mailboxUuid?: string
}

type Body = Record<string, string>

/**
 * The request body for a create or rename, or the usage error to print instead. Only what was
 * passed is sent, so a rename that leaves out --color keeps the colour.
 */
export function buildTaskListBody(
  options: Pick<TaskListWriteOptions, 'name' | 'color' | 'mailboxUuid'>,
  mode: 'create' | 'update',
): { body: Body } | { error: string; hint: string } {
  const body: Body = {}
  const name = options.name?.trim()

  if (options.name !== undefined) {
    if (!name) return { error: 'A task list name cannot be empty.', hint: 'Pass --name "<name>".' }
    body.name = name
  }
  if (options.color !== undefined) body.color = options.color
  if (options.mailboxUuid !== undefined) body.mailbox_uuid = options.mailboxUuid

  if (mode === 'create' && !body.name) {
    return { error: 'A task list name is required.', hint: 'Pass --name "<name>".' }
  }
  if (mode === 'update' && body.name === undefined && body.color === undefined) {
    return { error: 'Nothing to change.', hint: 'Pass --name and/or --color.' }
  }

  return { body }
}

function bodyOrExit(options: TaskListWriteOptions, mode: 'create' | 'update'): Body {
  const result = buildTaskListBody(options, mode)
  if ('error' in result) {
    outputError(result.error, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', hint: result.hint })
  }

  return result.body
}

function describe(list: TaskList): string {
  return [list.task_list_uuid, list.name, list.mailbox_address].filter(Boolean).join('\t')
}

export async function tasksListsCreateCommand(options: TaskListWriteOptions): Promise<void> {
  requireCredentials(options)
  const body = bodyOrExit(options, 'create')

  try {
    const list = await authedRequest<TaskList>('public_api/v1/task_lists', { method: 'POST', body })

    output(list as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Created task list ${describe(list)}`,
      quietValue: () => list.task_list_uuid,
    })
  } catch (error) {
    handleTasksError(error, options, { action: 'Create task list', notFound: 'Mailbox not found.' })
  }
}

export async function tasksListsUpdateCommand(taskListUuid: string, options: TaskListWriteOptions): Promise<void> {
  requireCredentials(options)
  const body = bodyOrExit(options, 'update')

  try {
    const list = await authedRequest<TaskList>(`public_api/v1/task_lists/${encodeURIComponent(taskListUuid)}`, {
      method: 'POST',
      body,
    })

    output(list as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Updated task list ${describe(list)}`,
      quietValue: () => list.task_list_uuid,
    })
  } catch (error) {
    handleTasksError(error, options, {
      action: 'Update task list',
      notFound: `Task list '${taskListUuid}' not found.`,
    })
  }
}

/** Deleting a list takes every task on it, for everyone it is shared with, so it confirms first. */
export async function tasksListsDeleteCommand(
  taskListUuid: string,
  options: OutputOptions & { yes?: boolean },
): Promise<void> {
  requireCredentials(options)

  if (!options.yes && !(await confirm(`Delete task list ${taskListUuid} and every task on it?`))) {
    outputError('Cancelled.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'not_confirmed',
      hint: 'Pass --yes to delete without confirming.',
    })
  }

  try {
    await authedRequestVoid(`public_api/v1/task_lists/${encodeURIComponent(taskListUuid)}`, { method: 'DELETE' })

    output(
      { task_list_uuid: taskListUuid, deleted: true },
      { ...options, text: () => `Deleted task list ${taskListUuid}`, quietValue: () => taskListUuid },
    )
  } catch (error) {
    handleTasksError(error, options, {
      action: 'Delete task list',
      notFound: `Task list '${taskListUuid}' not found.`,
    })
  }
}
