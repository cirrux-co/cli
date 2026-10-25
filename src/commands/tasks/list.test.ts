import { test, expect } from 'bun:test'
import { formatTaskList, tasksListPath } from './list.js'
import type { Task, TaskListResponse } from './tasks-shared.js'

function task(overrides: Partial<Task> = {}): Task {
  return {
    object: 'task',
    uuid: 'task-1',
    task_list_uuid: 'list-1',
    title: 'Pay rent',
    notes: null,
    status: 'needs_action',
    due: { date: '2026-10-28' },
    completed_at: null,
    recurring: false,
    created_at: '2026-10-20T09:00:00.000Z',
    updated_at: '2026-10-20T09:00:00.000Z',
    ...overrides,
  }
}

function response(data: Task[], more?: string): TaskListResponse {
  return { object: 'list', url: '/v1/tasks', has_more: Boolean(more), next_cursor: more, data }
}

const names = new Map([['list-1', 'Reminders']])

test('tasksListPath reads every list unless --list names one', () => {
  expect(tasksListPath({})).toBe('public_api/v1/tasks')
  expect(tasksListPath({ list: 'list-1', status: 'all' })).toBe('public_api/v1/task_lists/list-1/tasks?status=all')
})

test('tasksListPath sends only the filters that were passed', () => {
  expect(tasksListPath({ dueBefore: '2026-10-30', limit: '10', cursor: 'abc' })).toBe(
    'public_api/v1/tasks?due_before=2026-10-30&limit=10&cursor=abc',
  )
})

test('formatTaskList shows a checkbox, the title, when it is due and its list', () => {
  const { text, quietValue } = formatTaskList(
    response([
      task(),
      task({ uuid: 'task-2', title: 'Call Jan', due: { date_time: '2026-10-30T08:00:00Z' }, recurring: true }),
      task({ uuid: 'task-3', title: 'Renew pass', status: 'completed', due: null }),
    ]),
    names,
  )

  expect(text.split('\n')).toEqual([
    'task-1\t[ ] Pay rent\tdue 2026-10-28\t(Reminders)',
    'task-2\t[ ] Call Jan\tdue 2026-10-30T08:00:00Z, repeats\t(Reminders)',
    'task-3\t[x] Renew pass\t(Reminders)',
  ])
  expect(quietValue).toBe('task-1\ntask-2\ntask-3')
})

test('formatTaskList points at the next page', () => {
  const { text } = formatTaskList(response([task()], 'NTA'), names)

  expect(text).toContain('More results available (cursor: NTA)')
})

test('formatTaskList says so when there are none', () => {
  expect(formatTaskList(response([]), names).text).toBe('No tasks found.')
})
