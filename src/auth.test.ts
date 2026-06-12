import { test, expect } from 'bun:test'
import { isHeadless } from './headless.js'

test('isHeadless is false on desktop platforms regardless of env', () => {
  expect(isHeadless('darwin', {})).toBe(false)
  expect(isHeadless('win32', {})).toBe(false)
  expect(isHeadless('darwin', { SSH_CONNECTION: '10.0.0.1 22 10.0.0.2 22' })).toBe(false)
})

test('isHeadless is true over SSH on Linux', () => {
  expect(isHeadless('linux', { SSH_CONNECTION: '10.0.0.1 22 10.0.0.2 22' })).toBe(true)
  expect(isHeadless('linux', { SSH_TTY: '/dev/pts/0' })).toBe(true)
})

test('isHeadless is true on Linux with no display server', () => {
  expect(isHeadless('linux', {})).toBe(true)
})

test('isHeadless is false on a Linux desktop with a display', () => {
  expect(isHeadless('linux', { DISPLAY: ':0' })).toBe(false)
  expect(isHeadless('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(false)
})
