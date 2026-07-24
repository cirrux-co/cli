import { test, expect } from 'bun:test'
import { deviceCodeEvent, loggedInEvent } from './auth.js'
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

test('deviceCodeEvent exposes only the fields an agent needs, not the secret device_code', () => {
  const event = deviceCodeEvent({
    device_code: 'SECRET-should-not-leak',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://cirrux.co/device',
    expires_in: 900,
    interval: 5,
  })
  expect(event).toEqual({
    event: 'device_code',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://cirrux.co/device',
    expires_in: 900,
  })
  expect(JSON.stringify(event)).not.toContain('SECRET-should-not-leak')
})

test('loggedInEvent includes workspace, user, and scopes when present', () => {
  const event = loggedInEvent(
    {
      workspace: { uuid: 'ws-1', name: 'Acme' },
      user: { uuid: 'u-1', username: 'you@acme.com', first_name: 'You', last_name: 'Acme' },
    },
    ['email.read', 'email.write'],
  )
  expect(event).toEqual({
    event: 'logged_in',
    workspace: { uuid: 'ws-1', name: 'Acme' },
    user: { uuid: 'u-1', username: 'you@acme.com', first_name: 'You', last_name: 'Acme' },
    scopes: ['email.read', 'email.write'],
  })
})

test('loggedInEvent omits user and scopes when absent', () => {
  const event = loggedInEvent({ workspace: { uuid: 'ws-1', name: 'Acme' } })
  expect(event).toEqual({ event: 'logged_in', workspace: { uuid: 'ws-1', name: 'Acme' } })
  expect('user' in event).toBe(false)
  expect('scopes' in event).toBe(false)
})
