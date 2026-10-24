import { test, expect } from 'bun:test'
import { buildTaskListBody } from './write.js'

test('create sends the name, and the colour and mailbox only when given', () => {
  expect(buildTaskListBody({ name: '  Groceries ' }, 'create')).toEqual({ body: { name: 'Groceries' } })
  expect(buildTaskListBody({ name: 'Groceries', color: '#4cb782', mailboxUuid: 'mb-1' }, 'create')).toEqual({
    body: { name: 'Groceries', color: '#4cb782', mailbox_uuid: 'mb-1' },
  })
})

test('create needs a name', () => {
  expect(buildTaskListBody({ color: '#4cb782' }, 'create')).toMatchObject({ error: 'A task list name is required.' })
  expect(buildTaskListBody({ name: '   ' }, 'create')).toMatchObject({ error: 'A task list name cannot be empty.' })
})

// A rename sends only what changes, so leaving out --color keeps the colour.
test('update sends only what was passed', () => {
  expect(buildTaskListBody({ color: '#eb5757' }, 'update')).toEqual({ body: { color: '#eb5757' } })
  expect(buildTaskListBody({ name: 'Errands', mailboxUuid: 'mb-2' }, 'update')).toEqual({
    body: { name: 'Errands', mailbox_uuid: 'mb-2' },
  })
})

test('update with neither a name nor a colour is a usage error', () => {
  expect(buildTaskListBody({ mailboxUuid: 'mb-2' }, 'update')).toMatchObject({ error: 'Nothing to change.' })
})
