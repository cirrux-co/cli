import { expect, test } from 'bun:test'
import { userAgentFor } from './user-agent.js'

const base = { version: '0.49.0', release: '', arch: 'arm64', node: '22.16.0' }

test('names the CLI, its version and the operating system the way a browser would', () => {
  expect(userAgentFor({ ...base, platform: 'darwin', release: '25.1.0', macOSVersion: '26.1' })).toBe(
    'Cirrux-CLI/0.49.0 (Macintosh; Mac OS X 26_1; arm64) Node/22.16.0',
  )
  expect(userAgentFor({ ...base, platform: 'linux', arch: 'x64' })).toBe('Cirrux-CLI/0.49.0 (Linux; x64) Node/22.16.0')
  expect(userAgentFor({ ...base, platform: 'win32', release: '10.0.22631', arch: 'x64' })).toBe(
    'Cirrux-CLI/0.49.0 (Windows NT 10.0; x64) Node/22.16.0',
  )
})

test('a Mac whose version could not be read still says it is a Mac', () => {
  expect(userAgentFor({ ...base, platform: 'darwin', release: '25.1.0' })).toBe(
    'Cirrux-CLI/0.49.0 (Macintosh; arm64) Node/22.16.0',
  )
})

test('an unfamiliar platform still says what it is', () => {
  expect(userAgentFor({ ...base, platform: 'freebsd' })).toBe('Cirrux-CLI/0.49.0 (freebsd; arm64) Node/22.16.0')
})
