import { test, expect } from 'bun:test'
import { buildTaskBody, dueBody } from './write.js'

test('a bare date is a day, anything else a time handed over as typed', () => {
  expect(dueBody('2026-10-30')).toEqual({ date: '2026-10-30' })
  expect(dueBody('2026-10-30T09:00')).toEqual({ date_time: '2026-10-30T09:00' })
  expect(dueBody('2026-10-30T09:00', 'America/New_York')).toEqual({
    date_time: '2026-10-30T09:00',
    time_zone: 'America/New_York',
  })
})

test('create needs a title and sends only what was passed', () => {
  expect(buildTaskBody({ title: ' Pay rent ', due: '2026-11-01' }, 'create')).toEqual({
    body: { title: 'Pay rent', due: { date: '2026-11-01' } },
  })
  expect(buildTaskBody({ notes: 'x' }, 'create')).toMatchObject({ error: 'A task title is required.' })
  expect(buildTaskBody({ title: '  ' }, 'create')).toMatchObject({ error: 'A task title cannot be empty.' })
})

// --no-due arrives as due: false, and clears the due date with an explicit null.
test('update sends a null due date for --no-due', () => {
  expect(buildTaskBody({ due: false }, 'update')).toEqual({ body: { due: null } })
})

test('update with nothing to change is a usage error', () => {
  expect(buildTaskBody({}, 'update')).toMatchObject({ error: 'Nothing to change.' })
})
