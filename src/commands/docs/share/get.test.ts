import { expect, test } from 'bun:test'
import { formatDocumentSharing } from './get.js'

test('formatDocumentSharing names the public link and its state, or says there is none', () => {
  const link = {
    object: 'document_public_link',
    uuid: 'l-1',
    document_uuid: 'd-1',
    token: 'abc',
    url: 'https://docs.cirrux.co/s/abc',
    status: 'ready',
    created_at: '2026-10-13T10:00:00.000Z',
    updated_at: '2026-10-13T10:00:00.000Z',
  }
  const grant = {
    object: 'drive_access',
    uuid: 'g-1',
    principal_type: 'user',
    principal_user_uuid: 'u-1',
    principal_email: null,
    role: 'editor',
    status: 'accepted',
  }

  expect(formatDocumentSharing({ object: 'document_sharing', document_uuid: 'd-1', accesses: [grant], public_link: link }))
    .toBe('Public link: https://docs.cirrux.co/s/abc (ready)\nGrants:\n  u-1\teditor\taccepted')
  expect(formatDocumentSharing({ object: 'document_sharing', document_uuid: 'd-1', accesses: [], public_link: null }))
    .toBe('Public link: none')
})
