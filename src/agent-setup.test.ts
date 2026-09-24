import { test, expect } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { offerQuestion, planAgentSetup } from './agent-setup.js'
import { AGENTS } from './agents.js'
import { installSkill, sharedSkillDir } from './skill.js'

const claude = AGENTS.find((agent) => agent.id === 'claude')!
const codex = AGENTS.find((agent) => agent.id === 'codex')!

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'cirrux-setup-'))
}

test('offers nothing without detected agents', () => {
  expect(planAgentSetup(tempRoot(), [])).toEqual({ kind: 'nothing_to_do' })
})

test('offers to connect detected agents, naming every path it writes', () => {
  const root = tempRoot()

  const plan = planAgentSetup(root, [claude, codex])

  expect(plan).toEqual({
    kind: 'offer',
    agents: [claude, codex],
    paths: [sharedSkillDir(root), join(root, '.claude', 'skills', 'cirrux')],
  })
})

test('does not ask again once connected, even when the skill is stale', () => {
  const root = tempRoot()
  installSkill({ root, agents: [claude] })
  writeFileSync(join(sharedSkillDir(root), 'SKILL.md'), 'previous release')

  expect(planAgentSetup(root, [claude])).toEqual({ kind: 'nothing_to_do' })
})

test('asks about an agent that was installed after the skill', () => {
  const root = tempRoot()
  installSkill({ root, agents: [codex] })

  expect(planAgentSetup(root, [claude, codex]).kind).toBe('offer')
})

test('reports a skill it did not write instead of offering to overwrite it', () => {
  const root = tempRoot()
  const dir = join(root, '.claude', 'skills', 'cirrux')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), 'written by an older release')

  expect(planAgentSetup(root, [claude])).toEqual({ kind: 'occupied', paths: [dir] })
})

test('the question names the agents and the paths', () => {
  const question = offerQuestion({
    kind: 'offer',
    agents: [claude, codex],
    paths: ['/x/.agents/skills/cirrux', '/x/.claude/skills/cirrux'],
  })

  expect(question).toBe(
    'Found Claude Code and Codex on this machine. Connect them to Cirrux?\n' +
      'This writes /x/.agents/skills/cirrux and links /x/.claude/skills/cirrux.',
  )
})
