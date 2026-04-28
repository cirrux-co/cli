import { test, expect } from 'bun:test'
import { TRANSITION_VERBS, VERB_LABELS, transitionPath } from './transitions.js'

test('every transition verb has a human-readable label', () => {
  for (const verb of TRANSITION_VERBS) {
    expect(VERB_LABELS[verb]).toBeTruthy()
  }
})

test('transitionPath builds the expected public API path for each verb', () => {
  expect(transitionPath('abc-123', 'archive')).toBe('public_api/v1/emails/abc-123/archive')
  expect(transitionPath('abc-123', 'untrash')).toBe('public_api/v1/emails/abc-123/untrash')
  expect(transitionPath('abc-123', 'move')).toBe('public_api/v1/emails/abc-123/move')
})

test('transitionPath URL-encodes the email uuid', () => {
  expect(transitionPath('weird/uuid with space', 'archive')).toBe(
    'public_api/v1/emails/weird%2Fuuid%20with%20space/archive',
  )
})
