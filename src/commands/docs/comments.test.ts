import { expect, test } from 'bun:test'
import { latestOwnMessage } from './comments.js'
import { type DocumentContentThread, formatDocumentThread } from './docs-shared.js'

const ME = { self: true, first_name: 'Ada', last_name: 'Lovelace', display_name: 'Ada Lovelace' }
const SAM = { self: false, first_name: 'Sam', last_name: 'Jansen', display_name: 'Sam Jansen' }

function message(uuid: string, author: typeof ME, body = 'text\n') {
  return { uuid, author, body, created_at: '2026-10-01T10:00:00.000Z', edited_at: null }
}

function thread(overrides: Partial<DocumentContentThread> = {}): DocumentContentThread {
  return {
    uuid: 't-1',
    kind: 'comment',
    ref: null,
    status: 'open',
    placement: 'attached',
    quote: 'Monday',
    suggested_text: null,
    suggested_format: null,
    author: ME,
    created_at: '2026-10-01T10:00:00.000Z',
    messages: [message('m-1', ME), message('m-2', SAM), message('m-3', ME), message('m-4', SAM)],
    ...overrides,
  }
}

test('latestOwnMessage picks your most recent message in the thread', () => {
  expect(latestOwnMessage([thread()], 't-1')).toBe('m-3')
  expect(latestOwnMessage([thread({ messages: [message('m-2', SAM)] })], 't-1')).toBeNull()
  expect(latestOwnMessage([thread()], 'other')).toBeNull()
})

test('formatDocumentThread says when a comment is closed', () => {
  const resolved = thread({ status: 'resolved', messages: [message('m-1', ME, 'Is **Monday** firm?\n')] })
  expect(formatDocumentThread(resolved)).toBe('Comment by you on "Monday" (t-1, resolved)\n  You: Is **Monday** firm?')
})
