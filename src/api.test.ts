import { test, expect, beforeEach } from 'bun:test'
import { resolveCoAuthor, setExplicitCoAuthor } from './api.js'

beforeEach(() => {
  setExplicitCoAuthor(undefined)
})

test('explicit value wins over env vars', () => {
  expect(
    resolveCoAuthor({ CIRRUX_CO_AUTHOR: 'env-name', CLAUDECODE: '1' }, 'flag-name'),
  ).toBe('flag-name')
})

test('CIRRUX_CO_AUTHOR is used when no explicit value', () => {
  expect(resolveCoAuthor({ CIRRUX_CO_AUTHOR: 'env-name', CLAUDECODE: '1' })).toBe('env-name')
})

test('CLAUDECODE=1 auto-sets co-author to "claude"', () => {
  expect(resolveCoAuthor({ CLAUDECODE: '1' })).toBe('claude')
})

test('CLAUDECODE values other than "1" are ignored', () => {
  expect(resolveCoAuthor({ CLAUDECODE: '0' })).toBeUndefined()
  expect(resolveCoAuthor({ CLAUDECODE: 'true' })).toBeUndefined()
})

test('returns undefined when nothing is set', () => {
  expect(resolveCoAuthor({})).toBeUndefined()
})

test('whitespace-only values are treated as unset', () => {
  expect(resolveCoAuthor({ CIRRUX_CO_AUTHOR: '   ' }, '  ')).toBeUndefined()
})

test('setExplicitCoAuthor trims and clears on empty', () => {
  setExplicitCoAuthor('  alice  ')
  expect(resolveCoAuthor({})).toBe('alice')

  setExplicitCoAuthor('')
  expect(resolveCoAuthor({})).toBeUndefined()

  setExplicitCoAuthor(undefined)
  expect(resolveCoAuthor({})).toBeUndefined()
})
