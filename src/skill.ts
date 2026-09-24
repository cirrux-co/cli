import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import skillContent from '../skills/cirrux/SKILL.md'
import { AGENTS, type Agent } from './agents.js'
import { CLI_VERSION } from './version.js'

export const SKILL_CONTENT = skillContent

/**
 * Present in every skill directory this CLI wrote. A directory without it is
 * somebody's own skill occupying our path, and is never written, replaced or
 * removed without `--force`.
 */
export const OWNERSHIP_MARKER = '.managed-by-cirrux-cli'

const SKILL_FILE = 'SKILL.md'
const OWNED_ENTRIES = new Set([SKILL_FILE, OWNERSHIP_MARKER])

/**
 * - `missing`: nothing there
 * - `current`: ours, and matches the bundled skill
 * - `stale`: ours, written by another CLI version
 * - `unmanaged`: something we did not write
 */
export type SkillState = 'missing' | 'current' | 'stale' | 'unmanaged'

/** The one real copy, in the cross-agent Agent Skills location. Codex reads it directly. */
export function sharedSkillDir(root: string): string {
  return join(root, '.agents', 'skills', 'cirrux')
}

/** Where `agent` needs its own link to the shared skill, or null when it reads the shared one. */
export function agentSkillDir(root: string, agent: Agent): string | null {
  return agent.skillLinkDir ? join(root, ...agent.skillLinkDir) : null
}

// Relative, so the link survives a moved or differently mounted home directory.
function linkTarget(root: string, linkDir: string): string {
  return relative(dirname(linkDir), sharedSkillDir(root))
}

export function inspectSkillDir(dir: string, expectedLinkTarget?: string): SkillState {
  const stat = lstatOrNull(dir)
  if (!stat) return 'missing'

  if (stat.isSymbolicLink()) {
    const target = readlinkSync(dir)
    if (expectedLinkTarget === undefined || target !== expectedLinkTarget) return 'unmanaged'
    return inspectSkillDir(resolve(dirname(dir), target))
  }

  if (!stat.isDirectory() || !isRegularFile(join(dir, OWNERSHIP_MARKER))) return 'unmanaged'

  const skillFile = join(dir, SKILL_FILE)
  if (!isRegularFile(skillFile)) return 'stale'
  return readFileSync(skillFile, 'utf-8') === SKILL_CONTENT ? 'current' : 'stale'
}

/** Whether `agent` can use the skill installed under `root`, as far as the filesystem says. */
export function agentSkillState(root: string, agent: Agent): SkillState {
  const linkDir = agentSkillDir(root, agent)
  if (!linkDir) return inspectSkillDir(sharedSkillDir(root))
  return inspectSkillDir(linkDir, linkTarget(root, linkDir))
}

export class SkillConflictError extends Error {
  constructor(public readonly paths: string[]) {
    super(`A skill not installed by the Cirrux CLI already exists at ${paths.join(', ')}.`)
    this.name = 'SkillConflictError'
  }
}

export interface SkillInstallResult {
  sharedDir: string
  links: { agent: Agent; dir: string; mode: 'link' | 'copy' }[]
}

/**
 * Write the shared skill under `root` and connect each of `agents` that needs
 * its own link. Refuses before writing anything when a path is occupied by a
 * skill we did not write, unless `force` is set.
 */
export function installSkill(options: { root: string; agents: Agent[]; force?: boolean }): SkillInstallResult {
  const { root, agents, force = false } = options
  const sharedDir = sharedSkillDir(root)
  const linkDirs = agents.flatMap((agent) => {
    const dir = agentSkillDir(root, agent)
    return dir ? [{ agent, dir }] : []
  })

  if (!force) {
    const conflicts = [
      inspectSkillDir(sharedDir) === 'unmanaged' ? sharedDir : null,
      ...linkDirs.map(({ dir }) => (inspectSkillDir(dir, linkTarget(root, dir)) === 'unmanaged' ? dir : null)),
    ].filter((dir): dir is string => dir !== null)
    if (conflicts.length > 0) throw new SkillConflictError(conflicts)
  }

  writeManagedSkill(sharedDir)
  const links = linkDirs.map(({ agent, dir }) => ({ agent, dir, mode: placeLink(dir, linkTarget(root, dir)) }))
  return { sharedDir, links }
}

function writeManagedSkill(dir: string): void {
  if (lstatOrNull(dir)?.isSymbolicLink()) unlinkSync(dir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, SKILL_FILE), SKILL_CONTENT)
  writeFileSync(join(dir, OWNERSHIP_MARKER), '')
}

function placeLink(linkDir: string, target: string): 'link' | 'copy' {
  const stat = lstatOrNull(linkDir)
  if (stat?.isSymbolicLink()) {
    if (readlinkSync(linkDir) === target) return 'link'
    unlinkSync(linkDir)
  } else if (stat?.isDirectory()) {
    // A directory holding anything beyond what we write is kept, and the skill
    // is written into it: replacing it would take the extra files with it.
    if (!readdirSync(linkDir).every((entry) => OWNED_ENTRIES.has(entry))) {
      writeManagedSkill(linkDir)
      return 'copy'
    }
    rmSync(linkDir, { recursive: true })
  } else if (stat) {
    unlinkSync(linkDir)
  }

  mkdirSync(dirname(linkDir), { recursive: true })
  try {
    symlinkSync(target, linkDir, 'dir')
    return 'link'
  } catch {
    // Windows without Developer Mode cannot create symlinks.
    writeManagedSkill(linkDir)
    return 'copy'
  }
}

export interface SkillUninstallResult {
  removed: string[]
  /** Paths holding a skill we did not write, left alone. */
  kept: string[]
}

export function uninstallSkill(options: { root: string }): SkillUninstallResult {
  const { root } = options
  const result: SkillUninstallResult = { removed: [], kept: [] }

  for (const agent of AGENTS) {
    const dir = agentSkillDir(root, agent)
    if (dir) removeIfOwned(dir, linkTarget(root, dir), result)
  }
  removeIfOwned(sharedSkillDir(root), undefined, result)
  return result
}

function removeIfOwned(dir: string, expectedLinkTarget: string | undefined, result: SkillUninstallResult): void {
  const stat = lstatOrNull(dir)
  if (!stat) return

  if (stat.isSymbolicLink() && expectedLinkTarget !== undefined && readlinkSync(dir) === expectedLinkTarget) {
    unlinkSync(dir)
    result.removed.push(dir)
  } else if (stat.isDirectory() && isRegularFile(join(dir, OWNERSHIP_MARKER))) {
    rmSync(dir, { recursive: true })
    result.removed.push(dir)
  } else {
    result.kept.push(dir)
  }
}

/**
 * Bring every skill copy we own under `root` up to the bundled content, so an
 * upgraded CLI never leaves agents reading instructions for the old one.
 * Creates nothing: an uninstalled skill stays uninstalled. Reports whether
 * anything was rewritten.
 */
export function refreshSkill(options: { root: string }): boolean {
  const { root } = options
  const copies = [
    sharedSkillDir(root),
    ...AGENTS.map((agent) => agentSkillDir(root, agent)).filter((dir): dir is string => dir !== null),
  ]

  let refreshed = false
  for (const dir of copies) {
    // Links resolve to the shared copy, which is refreshed in its own right.
    if (lstatOrNull(dir)?.isSymbolicLink()) continue
    if (inspectSkillDir(dir) === 'stale') {
      writeManagedSkill(dir)
      refreshed = true
    }
  }
  return refreshed
}

/**
 * Runs after every command. Never fails one: a skill we cannot refresh is
 * reported by `cirrux doctor`, not by whatever command happened to run. The
 * notice is for a person at a terminal only; an agent reading stderr has no
 * use for it.
 */
export function refreshSkillAfterUpgrade(root: string = homedir()): void {
  try {
    if (refreshSkill({ root }) && process.stderr.isTTY) {
      process.stderr.write(`Updated the Cirrux agent skill to match this CLI (${CLI_VERSION}).\n`)
    }
  } catch {}
}

function lstatOrNull(path: string) {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

function isRegularFile(path: string): boolean {
  return lstatOrNull(path)?.isFile() ?? false
}
