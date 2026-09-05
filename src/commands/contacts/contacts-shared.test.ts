import { test, expect } from 'bun:test'
import {
  contactDisplayName,
  formatAddressbookList,
  formatContact,
  formatContactLine,
} from './contacts-shared.js'
import type { Contact, ContactEmail, ContactPhone } from './contacts-shared.js'

function email(address: string, types: string[] = []): ContactEmail {
  return { object: 'contact_email', uuid: `e-${address}`, email: address, types, preference: null }
}

function phone(number: string, types: string[] = []): ContactPhone {
  return { object: 'contact_phone', uuid: `p-${number}`, phone: number, types, preference: null }
}

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
    company: 'Acme Corp',
    title: null,
    role: null,
    notes: null,
    emails: [email('jane@acme.example')],
    phones: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: null,
    ...overrides,
  }
}

test('formatContactLine leads with the uuid so --json is not needed to pipe it', () => {
  expect(formatContactLine(contact())).toBe('c-1\tJane Acme\tAcme Corp\tjane@acme.example')
})

test('formatContactLine omits an absent company and email', () => {
  expect(formatContactLine(contact({ company: null, emails: [] }))).toBe('c-1\tJane Acme')
})

// An imported contact can have an address and nothing else; a blank line for it
// would tell the caller nothing.
test('contactDisplayName falls back through the name parts, then the company', () => {
  expect(contactDisplayName(contact({ name_formatted: null }))).toBe('Jane Acme')
  expect(contactDisplayName(contact({ name_formatted: null, name_given: null, name_family: null }))).toBe(
    'Acme Corp',
  )
})

test('contactDisplayName says so when there is nothing to show', () => {
  const nameless = contact({ name_formatted: null, name_given: null, name_family: null, company: null })

  expect(contactDisplayName(nameless)).toBe('(unnamed)')
  expect(formatContactLine(nameless)).toBe('c-1\t(unnamed)\tjane@acme.example')
})

// The company is already the display name here, so repeating it would render
// "Acme Corp   Acme Corp".
test('formatContactLine does not repeat the company it is already named after', () => {
  const companyOnly = contact({ name_formatted: null, name_given: null, name_family: null })

  expect(formatContactLine(companyOnly)).toBe('c-1\tAcme Corp\tjane@acme.example')
})

test('formatContact lists every email and phone with its types', () => {
  const detailed = contact({
    title: 'CTO',
    nickname: 'J',
    emails: [email('jane@acme.example', ['work']), email('jane@home.example', ['home'])],
    phones: [phone('+31 20 123 4567', ['work', 'voice'])],
    notes: 'Met at the conference',
  })

  expect(formatContact(detailed)).toBe(
    [
      'Jane Acme  (c-1)',
      'CTO, Acme Corp',
      'Nickname:    J',
      'Email:       jane@acme.example  (work)',
      'Email:       jane@home.example  (home)',
      'Phone:       +31 20 123 4567  (work, voice)',
      'Notes:       Met at the conference',
    ].join('\n'),
  )
})

test('formatContact drops the type suffix when there are none', () => {
  expect(formatContact(contact({ company: null }))).toBe(
    ['Jane Acme  (c-1)', 'Email:       jane@acme.example'].join('\n'),
  )
})

test('formatAddressbookList marks the default and emits uuids for --quiet', () => {
  const { text, quietValue } = formatAddressbookList({
    object: 'list',
    url: '/v1/addressbooks',
    has_more: false,
    data: [
      { object: 'addressbook', uuid: 'ab-1', mailbox_uuid: 'mb-1', name: 'Contacts', is_default: true, created_at: '', updated_at: null },
      { object: 'addressbook', uuid: 'ab-2', mailbox_uuid: 'mb-1', name: 'Work', is_default: false, created_at: '', updated_at: null },
    ],
  })

  expect(text.split('\n')).toEqual(['ab-1\tContacts\t(default)', 'ab-2\tWork'])
  expect(quietValue).toBe('ab-1\nab-2')
})

test('formatAddressbookList says so when there are none', () => {
  const { text } = formatAddressbookList({ object: 'list', url: '/v1/addressbooks', has_more: false, data: [] })

  expect(text).toBe('No addressbooks found.')
})
