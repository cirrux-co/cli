import { test, expect } from 'bun:test'
import { deletePath } from './delete.js'

test('deletePath builds the expected public API path', () => {
  expect(deletePath('abc-123')).toBe('public_api/v1/drafts/abc-123')
})

test('deletePath URL-encodes the draft uuid', () => {
  expect(deletePath('weird/uuid with space')).toBe(
    'public_api/v1/drafts/weird%2Fuuid%20with%20space',
  )
})
