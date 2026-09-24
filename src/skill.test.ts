import { test, expect } from 'bun:test'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENTS } from './agents.js'
import {
  OWNERSHIP_MARKER,
  SKILL_CONTENT,
  SkillConflictError,
  agentSkillState,
  inspectSkillDir,
  installSkill,
  refreshSkill,
  sharedSkillDir,
  uninstallSkill,
} from './skill.js'

const claude = AGENTS.find((agent) => agent.id === 'claude')!
const codex = AGENTS.find((agent) => agent.id === 'codex')!

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'cirrux-skill-'))
}

function claudeDir(root: string): string {
  return join(root, '.claude', 'skills', 'cirrux')
}

function writeOldSkill(dir: string, content: string, options: { managed: boolean }) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), content)
  if (options.managed) writeFileSync(join(dir, OWNERSHIP_MARKER), '')
}

test('SKILL_CONTENT includes the required frontmatter', () => {
  expect(SKILL_CONTENT.startsWith('---\n')).toBe(true)
  expect(SKILL_CONTENT).toContain('name: cirrux')
  expect(SKILL_CONTENT).toMatch(/^description: /m)
})

test('SKILL_CONTENT documents the core command tree', () => {
  expect(SKILL_CONTENT).toContain('cirrux login')
  expect(SKILL_CONTENT).toContain('cirrux mailbox list')
  expect(SKILL_CONTENT).toContain('cirrux thread get')
  expect(SKILL_CONTENT).toContain('cirrux email content')
  expect(SKILL_CONTENT).toContain('cirrux attachment download')
})

test('installSkill writes one shared copy and links Claude Code to it with a relative symlink', () => {
  const root = tempRoot()

  const result = installSkill({ root, agents: [claude, codex] })

  expect(result.sharedDir).toBe(join(root, '.agents', 'skills', 'cirrux'))
  expect(readFileSync(join(result.sharedDir, 'SKILL.md'), 'utf-8')).toBe(SKILL_CONTENT)
  expect(existsSync(join(result.sharedDir, OWNERSHIP_MARKER))).toBe(true)

  expect(lstatSync(claudeDir(root)).isSymbolicLink()).toBe(true)
  expect(readlinkSync(claudeDir(root))).toBe(join('..', '..', '.agents', 'skills', 'cirrux'))
  expect(readFileSync(join(claudeDir(root), 'SKILL.md'), 'utf-8')).toBe(SKILL_CONTENT)

  // Codex reads the shared location; it gets no copy of its own.
  expect(result.links.map((link) => link.agent.id)).toEqual(['claude'])
  expect(agentSkillState(root, claude)).toBe('current')
  expect(agentSkillState(root, codex)).toBe('current')
})

test('installSkill is idempotent', () => {
  const root = tempRoot()
  installSkill({ root, agents: [claude] })

  const result = installSkill({ root, agents: [claude] })

  expect(result.links[0]!.mode).toBe('link')
  expect(agentSkillState(root, claude)).toBe('current')
})

test('installSkill refuses a skill it did not write, and writes nothing', () => {
  const root = tempRoot()
  writeOldSkill(claudeDir(root), 'my own cirrux notes', { managed: false })

  expect(() => installSkill({ root, agents: [claude] })).toThrow(SkillConflictError)

  expect(readFileSync(join(claudeDir(root), 'SKILL.md'), 'utf-8')).toBe('my own cirrux notes')
  expect(existsSync(sharedSkillDir(root))).toBe(false)
})

test('installSkill refuses a symlink that points somewhere else', () => {
  const root = tempRoot()
  const elsewhere = join(root, 'elsewhere')
  writeOldSkill(elsewhere, 'mine', { managed: true })
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true })
  symlinkSync(elsewhere, claudeDir(root))

  expect(() => installSkill({ root, agents: [claude] })).toThrow(SkillConflictError)
})

test('installSkill --force turns a skill written by an older release into a link', () => {
  const root = tempRoot()
  writeOldSkill(claudeDir(root), 'old release content', { managed: false })

  installSkill({ root, agents: [claude], force: true })

  expect(lstatSync(claudeDir(root)).isSymbolicLink()).toBe(true)
  expect(agentSkillState(root, claude)).toBe('current')
})

test('installSkill --force keeps a directory holding other files, writing the skill into it', () => {
  const root = tempRoot()
  writeOldSkill(claudeDir(root), 'old', { managed: false })
  writeFileSync(join(claudeDir(root), 'notes.md'), 'keep me')

  const result = installSkill({ root, agents: [claude], force: true })

  expect(result.links[0]!.mode).toBe('copy')
  expect(readFileSync(join(claudeDir(root), 'notes.md'), 'utf-8')).toBe('keep me')
  expect(agentSkillState(root, claude)).toBe('current')
})

test('inspectSkillDir tells stale from current from unmanaged', () => {
  const root = tempRoot()
  expect(inspectSkillDir(join(root, 'nothing'))).toBe('missing')

  writeOldSkill(join(root, 'stale'), 'older version', { managed: true })
  expect(inspectSkillDir(join(root, 'stale'))).toBe('stale')

  writeOldSkill(join(root, 'current'), SKILL_CONTENT, { managed: true })
  expect(inspectSkillDir(join(root, 'current'))).toBe('current')

  writeOldSkill(join(root, 'hand'), SKILL_CONTENT, { managed: false })
  expect(inspectSkillDir(join(root, 'hand'))).toBe('unmanaged')
})

test('a planted directory in the marker name does not confer ownership', () => {
  const root = tempRoot()
  const dir = join(root, 'planted')
  mkdirSync(join(dir, OWNERSHIP_MARKER), { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), SKILL_CONTENT)

  expect(inspectSkillDir(dir)).toBe('unmanaged')
})

test('refreshSkill rewrites a stale managed copy and reports it', () => {
  const root = tempRoot()
  installSkill({ root, agents: [claude] })
  writeFileSync(join(sharedSkillDir(root), 'SKILL.md'), 'what the previous release shipped')

  expect(refreshSkill({ root })).toBe(true)

  expect(readFileSync(join(sharedSkillDir(root), 'SKILL.md'), 'utf-8')).toBe(SKILL_CONTENT)
  expect(agentSkillState(root, claude)).toBe('current')
  expect(refreshSkill({ root })).toBe(false)
})

test('refreshSkill never touches a skill it did not write', () => {
  const root = tempRoot()
  writeOldSkill(sharedSkillDir(root), 'hand written', { managed: false })

  expect(refreshSkill({ root })).toBe(false)
  expect(readFileSync(join(sharedSkillDir(root), 'SKILL.md'), 'utf-8')).toBe('hand written')
})

test('refreshSkill installs nothing when the skill is not installed', () => {
  const root = tempRoot()

  expect(refreshSkill({ root })).toBe(false)
  expect(existsSync(sharedSkillDir(root))).toBe(false)
})

test('uninstallSkill removes what it installed and leaves the rest', () => {
  const root = tempRoot()
  installSkill({ root, agents: [claude] })

  const result = uninstallSkill({ root })

  expect(result.removed.sort()).toEqual([claudeDir(root), sharedSkillDir(root)].sort())
  expect(existsSync(claudeDir(root))).toBe(false)
  expect(existsSync(sharedSkillDir(root))).toBe(false)

  writeOldSkill(claudeDir(root), 'mine', { managed: false })
  expect(uninstallSkill({ root })).toEqual({ removed: [], kept: [claudeDir(root)] })
  expect(existsSync(claudeDir(root))).toBe(true)
})
