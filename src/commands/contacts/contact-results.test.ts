import { test, expect } from 'bun:test'
import { formatContactResults } from './contacts-shared.js'
import type { Contact, ContactListResponse } from './contacts-shared.js'

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    object: 'contact',
    uuid: 'c-1',
    addressbook_uuid: 'ab-1',
    kind: 'individual',
    name_formatted: 'Jane Acme',
    name_given: 'Jane',
    name_family: 'Acme',
    name_additional: null,
    name_prefix: null,
    name_suffix: null,
    nickname: null,
    company: null,
    title: null,
    role: null,
    notes: null,
    emails: [],
    phones: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: null,
    ...overrides,
  }
}

function response(data: Contact[], extra: Partial<ContactListResponse> = {}): ContactListResponse {
  return { object: 'list', url: '/v1/search/contacts', query: 'jane', has_more: false, data, ...extra }
}

test('formatContactResults emits one line per contact and the uuids for --quiet', () => {
  const { text, quietValue } = formatContactResults(
    response([contact(), contact({ uuid: 'c-2', name_formatted: 'Bob Builder' })]),
  )

  expect(text.split('\n')).toEqual(['c-1\tJane Acme', 'c-2\tBob Builder'])
  expect(quietValue).toBe('c-1\nc-2')
})

test('formatContactResults says so when nothing matched', () => {
  const { text, quietValue } = formatContactResults(response([]))

  expect(text).toBe('No contacts matched the query.')
  expect(quietValue).toBe('')
})

// The footer has to stay out of --quiet, or piping it into another command
// feeds that command a sentence.
test('formatContactResults appends the cursor footer without polluting --quiet', () => {
  const { text, quietValue } = formatContactResults(
    response([contact()], { has_more: true, next_cursor: 'MjU' }),
  )

  expect(text).toContain('--- More results available (cursor: MjU) ---')
  expect(quietValue).toBe('c-1')
})

test('formatContactResults omits the footer when there is no cursor', () => {
  const { text } = formatContactResults(response([contact()], { has_more: true }))

  expect(text).not.toContain('More results available')
})

// list and search disagree about what an empty page means, and only about that.
test('formatContactResults takes the empty message from the caller', () => {
  expect(formatContactResults(response([]), 'This addressbook has no contacts.').text).toBe(
    'This addressbook has no contacts.',
  )
})
