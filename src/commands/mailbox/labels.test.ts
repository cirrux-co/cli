import { expect, test } from 'bun:test'
import { labelsPath } from './labels.js'

test('labelsPath builds the collection path', () => {
  expect(labelsPath('mbx-1')).toBe('public_api/v1/mailboxes/mbx-1/labels')
})

test('labelsPath builds the member path', () => {
  expect(labelsPath('mbx-1', 'lbl-2')).toBe('public_api/v1/mailboxes/mbx-1/labels/lbl-2')
})

test('labelsPath encodes path segments', () => {
  expect(labelsPath('a/b', 'c d')).toBe('public_api/v1/mailboxes/a%2Fb/labels/c%20d')
})
