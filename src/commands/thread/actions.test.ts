import { test, expect } from 'bun:test'
import { THREAD_VERB_LABELS, threadActionPath, threadActionText, threadLabelPath } from './actions.js'

test('every thread verb has a human-readable label', () => {
  for (const label of Object.values(THREAD_VERB_LABELS)) {
    expect(label).toBeTruthy()
  }
})

test('threadActionPath builds the public API path for a verb, move and labels', () => {
  expect(threadActionPath('abc', 'archive')).toBe('public_api/v1/threads/abc/archive')
  expect(threadActionPath('abc', 'flag')).toBe('public_api/v1/threads/abc/flag')
  expect(threadActionPath('abc', 'move')).toBe('public_api/v1/threads/abc/move')
})

test('threadLabelPath URL-encodes the thread and the label identifier', () => {
  expect(threadLabelPath('a/b', 'label uuid')).toBe('public_api/v1/threads/a%2Fb/labels/label%20uuid')
})

test('threadActionText names the thread and counts its messages', () => {
  const thread = { object: 'thread', uuid: 'abc', emails: [{ uuid: '1' }, { uuid: '2' }] }
  expect(threadActionText(thread, 'Archived:')).toBe('Archived: abc\n  2 messages')
  expect(threadActionText({ ...thread, emails: [{ uuid: '1' }] }, 'Starred:')).toBe('Starred: abc\n  1 message')
})
