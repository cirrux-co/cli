import { expect, test } from 'bun:test'
import {
  addressesPath,
  buildAddressUpdateBody,
  findAddressByEmail,
  formatAddressLine,
  type MailboxAddress,
} from './addresses.js'

function address(overrides: Partial<MailboxAddress> = {}): MailboxAddress {
  return {
    object: 'mailbox_address',
    uuid: 'addr-1',
    mailbox_uuid: 'mbx-1',
    address: 'newsletters@example.com',
    local_part: 'newsletters',
    domain: 'example.com',
    is_primary: false,
    deactivated_at: null,
    auto_created_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

test('addressesPath builds the collection and member paths, encoding segments', () => {
  expect(addressesPath('mbx-1')).toBe('public_api/v1/mailboxes/mbx-1/addresses')
  expect(addressesPath('mbx-1', 'addr-2')).toBe('public_api/v1/mailboxes/mbx-1/addresses/addr-2')
  expect(addressesPath('a/b', 'c d')).toBe('public_api/v1/mailboxes/a%2Fb/addresses/c%20d')
})

test('formatAddressLine lists the flags that apply', () => {
  expect(formatAddressLine(address())).toBe('addr-1\tnewsletters@example.com')
  expect(formatAddressLine(address({ is_primary: true }))).toBe('addr-1\tnewsletters@example.com\tprimary')
  expect(
    formatAddressLine(address({ deactivated_at: '2026-01-02T00:00:00.000Z', auto_created_at: '2026-01-01T00:00:00.000Z' })),
  ).toBe('addr-1\tnewsletters@example.com\tdeactivated,auto-created')
})

test('findAddressByEmail ignores case and surrounding space, but not a plus tag', () => {
  const list = [address({ uuid: 'a' }), address({ uuid: 'b', address: 'billing@example.com' })]
  expect(findAddressByEmail(list, ' Billing@Example.com ')?.uuid).toBe('b')
  expect(findAddressByEmail(list, 'newsletters+xyz@example.com')).toBeUndefined()
})

test('buildAddressUpdateBody maps flags to the request body', () => {
  expect(buildAddressUpdateBody({ deactivate: true })).toEqual({ deactivated: true })
  expect(buildAddressUpdateBody({ activate: true, primary: true })).toEqual({ deactivated: false, is_primary: true })
  expect(buildAddressUpdateBody({ primary: true })).toEqual({ is_primary: true })
})

test('buildAddressUpdateBody refuses flags that cannot be combined, or none at all', () => {
  expect(buildAddressUpdateBody({})).toHaveProperty('error')
  expect(buildAddressUpdateBody({ deactivate: true, activate: true })).toHaveProperty('error')
  expect(buildAddressUpdateBody({ deactivate: true, primary: true })).toHaveProperty('error')
})
