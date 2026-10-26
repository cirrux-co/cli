import { test, expect } from 'bun:test'
import { commanderExitCode, ExitCode } from './exit-codes.js'

test('a parse error is a usage error', () => {
  expect(commanderExitCode({ exitCode: 1 })).toBe(ExitCode.USAGE_ERROR)
})

test('help and version still exit 0', () => {
  expect(commanderExitCode({ exitCode: 0 })).toBe(ExitCode.SUCCESS)
})
