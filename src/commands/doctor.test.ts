import { test, expect } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENTS } from '../agents.js'
import { installSkill } from '../skill.js'
import { agentChecks, formatChecks, signInCheck, versionCheck } from './doctor.js'

const claude = AGENTS.find((agent) => agent.id === 'claude')!
const codex = AGENTS.find((agent) => agent.id === 'codex')!

test('versionCheck warns when a newer release is known', () => {
  expect(versionCheck('0.38.0', '0.39.0')).toMatchObject({ status: 'warn', hint: 'Run: brew upgrade cirrux' })
  expect(versionCheck('0.38.0', '0.38.0').status).toBe('pass')
  expect(versionCheck('0.38.0', null).status).toBe('pass')
})

test('signInCheck fails with a login hint when signed out or expired', () => {
  expect(signInCheck({ state: 'signed_out' })).toMatchObject({ status: 'fail', hint: 'Run: cirrux login' })
  expect(signInCheck({ state: 'expired' })).toMatchObject({ status: 'fail', hint: 'Run: cirrux login' })
  expect(signInCheck({ state: 'unreachable', reason: 'offline' }).status).toBe('warn')
  expect(signInCheck({ state: 'signed_in', username: 'rick', workspace: 'Cirrux' }).message).toBe('rick (Cirrux)')
})

test('agentChecks passes with no agents detected', () => {
  const checks = agentChecks(mkdtempSync(join(tmpdir(), 'cirrux-doctor-')), [])

  expect(checks).toHaveLength(1)
  expect(checks[0]!.status).toBe('pass')
})

test('agentChecks reports each detected agent', () => {
  const root = mkdtempSync(join(tmpdir(), 'cirrux-doctor-'))
  installSkill({ root, agents: [codex] })

  const checks = agentChecks(root, [claude, codex])

  expect(checks.map((check) => [check.name, check.status])).toEqual([
    ['Claude Code', 'fail'],
    ['Codex', 'pass'],
  ])
  expect(checks[0]!.hint).toBe('Run: cirrux skill install')
})

test('formatChecks aligns the names and indents hints under the message', () => {
  const text = formatChecks([
    { name: 'CLI version', status: 'pass', message: '0.38.0' },
    { name: 'Codex', status: 'fail', message: 'Not connected', hint: 'Run: cirrux skill install' },
  ])

  expect(text).toBe(
    '✓ CLI version  0.38.0\n' + '✗ Codex        Not connected\n' + '               Run: cirrux skill install',
  )
})
