import { test, expect } from 'bun:test'
import { type Signature, signatureLines, signaturesPath } from './signatures.js'

test('signaturesPath builds the mailbox-scoped signatures path', () => {
  expect(signaturesPath('mbx-1')).toBe('public_api/v1/mailboxes/mbx-1/signatures')
})

test('signaturesPath escapes the mailbox uuid', () => {
  expect(signaturesPath('a/b')).toBe('public_api/v1/mailboxes/a%2Fb/signatures')
})

function signature(overrides: Partial<Signature>): Signature {
  return {
    object: 'signature',
    uuid: 'sig-1',
    mailbox_uuid: 'mbx-1',
    name: 'Work',
    mode: 'rich',
    is_default: false,
    position: 0,
    html: '<p>Kind regards</p>',
    created_at: '2026-11-10T09:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

test('signatureLines marks the default, which a draft gets unless told otherwise', () => {
  const lines = signatureLines([
    signature({ uuid: 'sig-1', name: 'Work', is_default: true }),
    signature({ uuid: 'sig-2', name: 'Personal', mode: 'html' }),
  ])

  expect(lines).toBe('sig-1\tdefault\trich\tWork\nsig-2\t-\thtml\tPersonal')
})

test('signatureLines says so when there are none', () => {
  expect(signatureLines([])).toBe('No signatures found.')
})
