import { authedRequest } from '../../api.js'
import { deferred, output, type OutputOptions } from '../../output.js'
import {
  handleTasksError,
  requireCredentials,
  type Task,
  type TaskList,
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

/**
 * What to call each task list on a task's line: its name, and its mailbox too when another list has
 * the same name, which every mailbox's "Reminders" does. A list linked into several mailboxes is
 * named by the first.
 */
export function taskListLabels(lists: TaskList[]): Map<string, string> {
  const first = new Map<string, TaskList>()
  for (const list of lists) if (!first.has(list.task_list_uuid)) first.set(list.task_list_uuid, list)

  const nameCounts = new Map<string, number>()
  for (const list of first.values()) nameCounts.set(list.name, (nameCounts.get(list.name) ?? 0) + 1)

  return new Map(
    [...first.values()].map((list) => {
      const shared = (nameCounts.get(list.name) ?? 0) > 1 && list.mailbox_address
      return [list.task_list_uuid, shared ? `${list.name}, ${list.mailbox_address}` : list.name]
    }),
  )
}

const STATUS_MARKS: Record<Task['status'], string> = {
  needs_action: '[ ]',
  in_process: '[~]',
  completed: '[x]',
  cancelled: '[-]',
}

/** One task as the CLI prints it everywhere: uuid, checkbox, title, when it is due, and its list. */
export function formatTaskLine(task: Task, listName?: string): string {
  const due = task.due?.date ?? task.due?.date_time
  const markers = [due ? `due ${due}` : null, task.recurring ? 'repeats' : null].filter(Boolean).join(', ')

  return [task.uuid, `${STATUS_MARKS[task.status]} ${task.title}`, markers || null, listName ? `(${listName})` : null]
    .filter(Boolean)
    .join('\t')
}

/**
 * One line per task: its uuid, a checkbox for its status, the title, when it is due and which list
 * it is on (by name, from `lists`, as every mailbox has a list called "Reminders").
 */
export function formatTaskList(
  response: TaskListResponse,
  listNames: Map<string, string>,
): { text: string; quietValue: string } {
  const lines = response.data.map((task) => formatTaskLine(task, listNames.get(task.task_list_uuid)))

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
    const listNames = taskListLabels(lists.data)

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
