import { accessSync, constants, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

/**
 * The machine an agent is detected on. Injectable so detection is testable
 * against a temp directory instead of the developer's real home.
 */
export interface AgentEnv {
  home: string
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
}

export function defaultAgentEnv(): AgentEnv {
  return { home: homedir(), env: process.env, platform: process.platform }
}

export interface Agent {
  id: 'claude' | 'codex'
  name: string
  detect: (agentEnv: AgentEnv) => boolean
  /**
   * Where this agent needs its own link to the shared skill, relative to the
   * install root, or null when it reads `.agents/skills/` directly.
   */
  skillLinkDir: string[] | null
}

export const AGENTS: Agent[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    detect: (agentEnv) => isDirectory(join(agentEnv.home, '.claude')) || findBinary('claude', agentEnv) !== null,
    skillLinkDir: ['.claude', 'skills', 'cirrux'],
  },
  {
    id: 'codex',
    name: 'Codex',
    detect: (agentEnv) => isDirectory(codexHome(agentEnv)) || findBinary('codex', agentEnv) !== null,
    skillLinkDir: null,
  },
]

export function detectAgents(agentEnv: AgentEnv = defaultAgentEnv()): Agent[] {
  return AGENTS.filter((agent) => agent.detect(agentEnv))
}

export function agentNames(agents: Agent[]): string {
  const names = agents.map((agent) => agent.name)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function codexHome(agentEnv: AgentEnv): string {
  const fromEnv = agentEnv.env.CODEX_HOME?.trim()
  return fromEnv ? fromEnv : join(agentEnv.home, '.codex')
}

// ~/.local/bin is where both agents' own installers put the binary, and it is
// often missing from PATH in a non-login shell.
export function findBinary(name: string, agentEnv: AgentEnv): string | null {
  const dirs = [...(agentEnv.env.PATH ?? '').split(delimiter), join(agentEnv.home, '.local', 'bin')]
  const extensions =
    agentEnv.platform === 'win32' ? ['', ...(agentEnv.env.PATHEXT ?? '.EXE;.CMD').split(';')] : ['']

  for (const dir of dirs) {
    if (!dir) continue
    for (const extension of extensions) {
      const candidate = join(dir, name + extension)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}
