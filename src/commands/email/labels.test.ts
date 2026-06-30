import { test, expect } from 'bun:test'
import { resolveLabelTarget } from './labels.js'

test('resolveLabelTarget returns type when only --type is set', () => {
  const result = resolveLabelTarget({ type: 'archive' })
  expect(result).toEqual({ ok: true, kind: 'type', value: 'archive' })
})

test('resolveLabelTarget returns label_uuid when only --label-uuid is set', () => {
  const result = resolveLabelTarget({ labelUuid: '00000000-0000-0000-0000-000000000001' })
  expect(result).toEqual({
    ok: true,
    kind: 'label_uuid',
    value: '00000000-0000-0000-0000-000000000001',
  })
})

test('resolveLabelTarget rejects when both flags are set', () => {
  const result = resolveLabelTarget({ type: 'archive', labelUuid: 'abc' })
  expect(result.ok).toBe(false)
  if (result.ok === false) {
    expect(result.message).toContain('not both')
  }
})

test('resolveLabelTarget rejects when neither flag is set', () => {
  const result = resolveLabelTarget({})
  expect(result.ok).toBe(false)
  if (result.ok === false) {
    expect(result.message).toContain('--type')
    expect(result.message).toContain('--label-uuid')
  }
})

test('resolveLabelTarget treats empty strings as unset', () => {
  const result = resolveLabelTarget({ type: '', labelUuid: '' })
  expect(result.ok).toBe(false)
})
