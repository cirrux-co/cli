import { authedRequest, authedRequestVoid } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { formatTaskLine } from './list.js'
import { handleTasksError, requireCredentials, type Task } from './tasks-shared.js'

export interface TaskWriteOptions extends OutputOptions {
  list?: string
  title?: string
  notes?: string
  /** A date, a time, or false for --no-due. */
  due?: string | false
  timezone?: string
}

type Body = Record<string, unknown>

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A `--due` value as the API's due object: a bare date is a day, anything else a time, handed over
 * as typed. A time without an offset is wall-clock time in --timezone, or in the user's own zone,
 * which the server applies.
 */
export function dueBody(due: string, timezone?: string): Body {
  if (DATE_ONLY.test(due)) return { date: due }

  return timezone ? { date_time: due, time_zone: timezone } : { date_time: due }
}

/** The body for a create or an update, or the usage error to print instead. */
export function buildTaskBody(
  options: Pick<TaskWriteOptions, 'title' | 'notes' | 'due' | 'timezone'>,
  mode: 'create' | 'update',
): { body: Body } | { error: string; hint: string } {
  const body: Body = {}

  if (options.title !== undefined) {
    const title = options.title.trim()
    if (!title) return { error: 'A task title cannot be empty.', hint: 'Pass --title "<title>".' }
    body.title = title
  }
  if (options.notes !== undefined) body.notes = options.notes
  if (options.due === false) body.due = null
  else if (options.due !== undefined) body.due = dueBody(options.due, options.timezone)

  if (mode === 'create' && body.title === undefined) {
    return { error: 'A task title is required.', hint: 'Pass --title "<title>".' }
  }
  if (mode === 'update' && Object.keys(body).length === 0) {
    return { error: 'Nothing to change.', hint: 'Pass --title, --notes, --due or --no-due.' }
  }

  return { body }
}

function bodyOrExit(options: TaskWriteOptions, mode: 'create' | 'update'): Body {
  const result = buildTaskBody(options, mode)
  if ('error' in result) {
    outputError(result.error, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', hint: result.hint })
  }

  return result.body
}

function taskPath(taskUuid: string): string {
  return `public_api/v1/tasks/${encodeURIComponent(taskUuid)}`
}

function printTask(task: Task, verb: string, options: OutputOptions): void {
  output(task as unknown as Record<string, unknown>, {
    ...options,
    text: () => `${verb} ${formatTaskLine(task)}`,
    quietValue: () => task.uuid,
  })
}

export async function tasksCreateCommand(options: TaskWriteOptions): Promise<void> {
  requireCredentials(options)
  const body = bodyOrExit(options, 'create')
  const list = options.list ?? ''

  try {
    const task = await authedRequest<Task>(`public_api/v1/task_lists/${encodeURIComponent(list)}/tasks`, {
      method: 'POST',
      body,
    })
    printTask(task, 'Created', options)
  } catch (error) {
    handleTasksError(error, options, { action: 'Create task', notFound: `Task list '${list}' not found.` })
  }
}

async function postTask(
  taskUuid: string,
  body: Body,
  { verb, action }: { verb: string; action: string },
  options: OutputOptions,
): Promise<void> {
  try {
    const task = await authedRequest<Task>(taskPath(taskUuid), { method: 'POST', body })
    printTask(task, verb, options)
  } catch (error) {
    handleTasksError(error, options, { action, notFound: `Task '${taskUuid}' not found.` })
  }
}

export async function tasksUpdateCommand(taskUuid: string, options: TaskWriteOptions): Promise<void> {
  requireCredentials(options)
  await postTask(taskUuid, bodyOrExit(options, 'update'), { verb: 'Updated', action: 'Update task' }, options)
}

export async function tasksCompleteCommand(taskUuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  await postTask(taskUuid, { status: 'completed' }, { verb: 'Completed', action: 'Complete task' }, options)
}

export async function tasksReopenCommand(taskUuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  await postTask(taskUuid, { status: 'needs_action' }, { verb: 'Reopened', action: 'Reopen task' }, options)
}

export async function tasksDeleteCommand(taskUuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(taskPath(taskUuid), { method: 'DELETE' })
    output({ uuid: taskUuid, deleted: true }, {
      ...options,
      text: () => `Deleted task ${taskUuid}`,
      quietValue: () => taskUuid,
    })
  } catch (error) {
    handleTasksError(error, options, { action: 'Delete task', notFound: `Task '${taskUuid}' not found.` })
  }
}
