import { test, expect } from 'bun:test'
import { formatTaskListList } from './list.js'
import type { TaskList, TaskListListResponse } from '../tasks-shared.js'

function taskList(overrides: Partial<TaskList> = {}): TaskList {
  return {
    object: 'task_list',
    uuid: 'mc-1',
    task_list_uuid: 'list-1',
    mailbox_uuid: 'mb-1',
    mailbox_address: 'rick@example.com',
    name: 'Reminders',
    color: '#e8985e',
    role: 'owner',
    can_write: true,
    source: 'owned',
    position: 1,
    ...overrides,
  }
}

function response(data: TaskList[]): TaskListListResponse {
  return { object: 'list', url: '/v1/task_lists', has_more: false, data }
}

test('formatTaskListList lists the task list uuid, name, mailbox and role', () => {
  const { text, quietValue } = formatTaskListList(response([taskList()]))

  expect(text).toBe('list-1\tReminders\trick@example.com\t(owner)')
  expect(quietValue).toBe('list-1')
})

// Every mailbox gets a "Reminders" list, so the address is what tells two of them apart.
test('formatTaskListList keeps one line per mailbox, named by its address', () => {
  const { text } = formatTaskListList(
    response([taskList(), taskList({ task_list_uuid: 'list-2', mailbox_address: 'rick@other.example.com' })]),
  )

  expect(text.split('\n')).toEqual([
    'list-1\tReminders\trick@example.com\t(owner)',
    'list-2\tReminders\trick@other.example.com\t(owner)',
  ])
})

test('formatTaskListList drops the address column when the mailbox has no address', () => {
  const { text } = formatTaskListList(response([taskList({ mailbox_address: null, role: 'viewer' })]))

  expect(text).toBe('list-1\tReminders\t(viewer)')
})

test('formatTaskListList says so when there are none', () => {
  const { text, quietValue } = formatTaskListList(response([]))

  expect(text).toBe('No task lists found.')
  expect(quietValue).toBe('')
})
