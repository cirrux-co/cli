import { test, expect } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  SKILL_CONTENT,
  SkillConflictError,
  resolveSkillPath,
  writeSkillFile,
} from './install-skill.js'

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

test('resolveSkillPath returns a user-scoped path by default', () => {
  const path = resolveSkillPath({ home: '/fake/home' })
  expect(path).toBe('/fake/home/.claude/skills/cirrux/SKILL.md')
})

test('resolveSkillPath returns a project-scoped path when --project is passed', () => {
  const path = resolveSkillPath({ project: true, cwd: '/fake/project' })
  expect(path).toBe('/fake/project/.claude/skills/cirrux/SKILL.md')
})

test('writeSkillFile creates the skill and any missing parent directories', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cirrux-skill-'))
  const target = resolveSkillPath({ home: tmp })

  writeSkillFile(target)

  expect(existsSync(target)).toBe(true)
  expect(readFileSync(target, 'utf-8')).toBe(SKILL_CONTENT)
})

test('writeSkillFile throws SkillConflictError when the target exists without --force', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cirrux-skill-'))
  const target = resolveSkillPath({ home: tmp })
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, 'existing content')

  expect(() => writeSkillFile(target)).toThrow(SkillConflictError)
  expect(readFileSync(target, 'utf-8')).toBe('existing content')
})

test('writeSkillFile overwrites an existing skill when --force is passed', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cirrux-skill-'))
  const target = resolveSkillPath({ home: tmp })
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, 'existing content')

  writeSkillFile(target, { force: true })

  expect(readFileSync(target, 'utf-8')).toBe(SKILL_CONTENT)
})
