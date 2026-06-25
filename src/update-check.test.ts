import { test, expect, spyOn } from 'bun:test'
import { compareVersions, printUpdateNotice } from './update-check.js'

test('compareVersions returns 0 for equal versions', () => {
  expect(compareVersions('0.12.1', '0.12.1')).toBe(0)
})

test('compareVersions returns negative when the first version is older', () => {
  expect(compareVersions('0.10.0', '0.12.1')).toBeLessThan(0)
  expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0)
  expect(compareVersions('0.9.99', '0.10.0')).toBeLessThan(0)
})

test('compareVersions returns positive when the first version is newer', () => {
  expect(compareVersions('0.12.1', '0.10.0')).toBeGreaterThan(0)
  expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
})

test('compareVersions handles missing components as zero', () => {
  expect(compareVersions('1', '1.0.0')).toBe(0)
  expect(compareVersions('1.2', '1.2.0')).toBe(0)
})

test('printUpdateNotice writes to stderr, not stdout, so it never pollutes machine-readable output', () => {
  const logSpy = spyOn(console, 'log').mockImplementation(() => {})
  const errSpy = spyOn(console, 'error').mockImplementation(() => {})

  printUpdateNotice('0.28.0', '0.29.0')

  expect(logSpy).not.toHaveBeenCalled()
  expect(errSpy).toHaveBeenCalledTimes(1)
  expect(errSpy.mock.calls[0][0]).toContain('Update available: 0.28.0 → 0.29.0')

  logSpy.mockRestore()
  errSpy.mockRestore()
})
