import { expect, test } from 'bun:test'
import { resolveMoveDestination } from './drive-shared.js'

test('resolveMoveDestination resolves --to to the target folder UUID', () => {
  expect(resolveMoveDestination({ to: 'f-1' })).toEqual({ ok: true, value: 'f-1' })
})

test('resolveMoveDestination resolves --root to null', () => {
  expect(resolveMoveDestination({ root: true })).toEqual({ ok: true, value: null })
})

test('resolveMoveDestination rejects passing both --to and --root', () => {
  const result = resolveMoveDestination({ to: 'f-1', root: true })
  expect(result.ok).toBe(false)
})

test('resolveMoveDestination rejects passing neither --to nor --root', () => {
  const result = resolveMoveDestination({})
  expect(result.ok).toBe(false)
})
