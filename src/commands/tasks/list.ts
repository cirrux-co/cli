import { authedRequest } from '../../api.js'
import { deferred, output, type OutputOptions } from '../../output.js'
import {
  handleTasksError,
  requireCredentials,
  type Task,
  type TaskListListResponse,
  type TaskListResponse,
} from './tasks-shared.js'

export interface TasksListOptions extends OutputOptions {
  list?: string
  status?: string
  dueBefore?: string
  timezone?: string
  limit?: string
  cursor?: string
}

/** One list's tasks with --list, otherwise every list's. Only the filters passed are sent. */
export function tasksListPath(options: Omit<TasksListOptions, keyof OutputOptions>): string {
  const params = new URLSearchParams()
  if (options.status) params.set('status', options.status)
  if (options.dueBefore) params.set('due_before', options.dueBefore)
  if (options.timezone) params.set('timezone', options.timezone)
  if (options.limit) params.set('limit', options.limit)
  if (options.cursor) params.set('cursor', options.cursor)

  const base = options.list
    ? `public_api/v1/task_lists/${encodeURIComponent(options.list)}/tasks`
    : 'public_api/v1/tasks'
  const query = params.toString()

  return query ? `${base}?${query}` : base
}

const STATUS_MARKS: Record<Task['status'], string> = {
  needs_action: '[ ]',
  in_process: '[~]',
  completed: '[x]',
  cancelled: '[-]',
}

/**
 * One line per task: its uuid, a checkbox for its status, the title, when it is due and which list
 * it is on (by name, from `lists`, as every mailbox has a list called "Reminders").
 */
export function formatTaskList(
  response: TaskListResponse,
  listNames: Map<string, string>,
): { text: string; quietValue: string } {
  const lines = response.data.map((task) => {
    const due = task.due?.date ?? task.due?.date_time
    const markers = [due ? `due ${due}` : null, task.recurring ? 'repeats' : null].filter(Boolean).join(', ')
    const list = listNames.get(task.task_list_uuid)

    return [task.uuid, `${STATUS_MARKS[task.status]} ${task.title}`, markers || null, list ? `(${list})` : null]
      .filter(Boolean)
      .join('\t')
  })

  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return {
    text: response.data.length > 0 ? lines.join('\n') : 'No tasks found.',
    quietValue: response.data.map((task) => task.uuid).join('\n'),
  }
}

export async function tasksListCommand(options: TasksListOptions): Promise<void> {
  requireCredentials(options)

  try {
    const [response, lists] = await Promise.all([
      authedRequest<TaskListResponse>(tasksListPath(options)),
      authedRequest<TaskListListResponse>('public_api/v1/task_lists'),
    ])
    const listNames = new Map(lists.data.map((list) => [list.task_list_uuid, list.name]))

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatTaskList(response, listNames)),
    })
  } catch (error) {
    handleTasksError(error, options, {
      action: 'List tasks',
      notFound: options.list ? `Task list '${options.list}' not found.` : undefined,
    })
  }
}
