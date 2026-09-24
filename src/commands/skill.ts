import { homedir } from 'node:os'
import { AGENTS, detectAgents, type Agent } from '../agents.js'
import { ExitCode } from '../exit-codes.js'
import { output, outputError, type OutputOptions } from '../output.js'
import {
  installSkill,
  SKILL_CONTENT,
  SkillConflictError,
  uninstallSkill,
  type SkillInstallResult,
} from '../skill.js'

type ScopeOptions = { project?: boolean }

function resolveScope(options: ScopeOptions) {
  return options.project
    ? { scope: 'project' as const, root: process.cwd() }
    : { scope: 'user' as const, root: homedir() }
}

/** Shows `path` relative to the home directory, the way a user would type it. */
export function displayPath(path: string, home: string = homedir()): string {
  return path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

/** One line per agent: how it reaches the skill. */
export function describeConnections(result: SkillInstallResult, agents: Agent[]): string[] {
  return agents.map((agent) => {
    const link = result.links.find((l) => l.agent.id === agent.id)
    if (!link) return `${agent.name}: reads ${displayPath(result.sharedDir)}`
    const verb = link.mode === 'link' ? 'linked' : 'copied to'
    return `${agent.name}: ${verb} ${displayPath(link.dir)}`
  })
}

export function skillInstallCommand(options: OutputOptions & ScopeOptions & { force?: boolean }): void {
  const { scope, root } = resolveScope(options)
  // A project skill is checked in for whoever clones the repo, so it links
  // every agent rather than just the ones on this machine.
  const agents = scope === 'project' ? AGENTS : detectAgents()

  let result: SkillInstallResult
  try {
    result = installSkill({ root, agents, force: options.force })
  } catch (error) {
    if (error instanceof SkillConflictError) {
      const paths = error.paths.map((path) => displayPath(path)).join(', ')
      outputError(`A skill not installed by the Cirrux CLI is already at ${paths}.`, {
        ...options,
        code: ExitCode.CONFLICT,
        hint: 'Pass --force to replace it.',
        errorType: 'conflict',
      })
    }
    const message = error instanceof Error ? error.message : String(error)
    outputError(`Failed to install skill: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'io_error',
    })
  }

  output(
    {
      status: 'installed',
      scope,
      path: result.sharedDir,
      agents: agents.map((agent) => {
        const link = result.links.find((l) => l.agent.id === agent.id)
        return { id: agent.id, name: agent.name, path: link?.dir ?? result.sharedDir, mode: link?.mode ?? 'shared' }
      }),
    },
    {
      ...options,
      text: () => {
        const lines = [`Installed the Cirrux skill (${scope}-scoped) at ${displayPath(result.sharedDir)}`]
        if (agents.length === 0) {
          lines.push(
            'No coding agents detected. Codex and other Agent Skills tools read this location;',
            'run this again after installing Claude Code to link it there too.',
          )
        } else {
          lines.push(...describeConnections(result, agents).map((line) => `  ${line}`))
          lines.push('Start a new agent session to use it.')
        }
        return lines.join('\n')
      },
      quietValue: () => result.sharedDir,
    },
  )
}

export function skillUninstallCommand(options: OutputOptions & ScopeOptions): void {
  const { scope, root } = resolveScope(options)

  let result: ReturnType<typeof uninstallSkill>
  try {
    result = uninstallSkill({ root })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    outputError(`Failed to uninstall skill: ${message}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'io_error',
    })
  }

  output(
    { status: result.removed.length > 0 ? 'uninstalled' : 'not_installed', scope, ...result },
    {
      ...options,
      text: () => {
        const lines =
          result.removed.length > 0
            ? result.removed.map((path) => `Removed ${displayPath(path)}`)
            : [`The Cirrux skill is not installed (${scope}-scoped).`]
        for (const path of result.kept) {
          lines.push(`Left ${displayPath(path)} alone: it was not installed by the Cirrux CLI.`)
        }
        return lines.join('\n')
      },
      quietValue: () => result.removed.join('\n'),
    },
  )
}

export function skillPrintCommand(options: OutputOptions): void {
  if (options.json) {
    output(
      { content: SKILL_CONTENT },
      {
        ...options,
        text: () => SKILL_CONTENT,
        quietValue: () => SKILL_CONTENT,
      },
    )
    return
  }

  process.stdout.write(SKILL_CONTENT)
  if (!SKILL_CONTENT.endsWith('\n')) process.stdout.write('\n')
}
