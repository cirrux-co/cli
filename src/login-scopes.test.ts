import { expect, test } from 'bun:test'
import { InvalidLoginScopesError, parseLoginScopes, requiredScopeFrom } from './login-scopes.js'

test('no --scopes asks for nothing in particular', () => {
  expect(parseLoginScopes(undefined)).toBeUndefined()
})

test('takes comma- and space-separated scopes, once each', () => {
  expect(parseLoginScopes('drive.create, drive.read drive.create')).toEqual(['drive.create', 'drive.read'])
})

test('refuses an unknown scope before a browser opens, naming the valid ones', () => {
  expect(() => parseLoginScopes('drive.create,drive.everything')).toThrow(InvalidLoginScopesError)
  expect(() => parseLoginScopes('drive.everything')).toThrow(/Unknown scope: drive\.everything\. Valid scopes: user\.profile/)
})

test('refuses an empty list', () => {
  expect(() => parseLoginScopes(' , ')).toThrow(/--scopes needs at least one scope/)
})

test('reads the scope a refused request needed', () => {
  expect(requiredScopeFrom('Required scope: drive.update')).toBe('drive.update')
  expect(requiredScopeFrom('Required scope: drive.update or drive.delete')).toBe('drive.update')
  expect(requiredScopeFrom(undefined)).toBeUndefined()
})
