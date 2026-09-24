import { test, expect } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentNames, detectAgents, findBinary, type AgentEnv } from './agents.js'

function emptyMachine(): AgentEnv {
  return { home: mkdtempSync(join(tmpdir(), 'cirrux-agents-')), env: { PATH: '' }, platform: 'darwin' }
}

function installBinary(dir: string, name: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), '#!/bin/sh\n')
  chmodSync(join(dir, name), 0o755)
}

test('detects nothing on a machine without agents', () => {
  expect(detectAgents(emptyMachine())).toEqual([])
})

test('detects Claude Code by its config directory', () => {
  const machine = emptyMachine()
  mkdirSync(join(machine.home, '.claude'))

  expect(detectAgents(machine).map((agent) => agent.id)).toEqual(['claude'])
})

test('detects Codex by CODEX_HOME', () => {
  const machine = emptyMachine()
  const codexHome = join(machine.home, 'somewhere', 'codex')
  mkdirSync(codexHome, { recursive: true })

  expect(detectAgents({ ...machine, env: { CODEX_HOME: codexHome } }).map((agent) => agent.id)).toEqual(['codex'])
})

test('detects an agent by its binary on PATH or in ~/.local/bin', () => {
  const machine = emptyMachine()
  const bin = join(machine.home, 'bin')
  installBinary(bin, 'codex')
  installBinary(join(machine.home, '.local', 'bin'), 'claude')

  expect(detectAgents({ ...machine, env: { PATH: bin } }).map((agent) => agent.id)).toEqual(['claude', 'codex'])
})

test('findBinary ignores a file that is not executable', () => {
  const machine = emptyMachine()
  const bin = join(machine.home, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'claude'), '')

  expect(findBinary('claude', { ...machine, env: { PATH: bin } })).toBeNull()
})

test('agentNames reads as a sentence', () => {
  const machine = emptyMachine()
  mkdirSync(join(machine.home, '.claude'))
  mkdirSync(join(machine.home, '.codex'))

  expect(agentNames(detectAgents(machine))).toBe('Claude Code and Codex')
  expect(agentNames(detectAgents(machine).slice(0, 1))).toBe('Claude Code')
})
