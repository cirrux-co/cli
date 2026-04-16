import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import skillContent from '../../skills/cirrux/SKILL.md'
import { ExitCode } from '../exit-codes.js'
import { output, outputError, type OutputOptions } from '../output.js'

export const SKILL_CONTENT = skillContent

export function resolveSkillPath(options: { project?: boolean; cwd?: string; home?: string }): string {
  const base = options.project ? (options.cwd ?? process.cwd()) : (options.home ?? homedir())
  return resolve(base, '.claude', 'skills', 'cirrux', 'SKILL.md')
}

export class SkillConflictError extends Error {
  constructor(public readonly path: string) {
    super(`Skill already installed at ${path}.`)
    this.name = 'SkillConflictError'
  }
}

export function writeSkillFile(target: string, options: { force?: boolean } = {}): void {
  if (existsSync(target) && !options.force) {
    throw new SkillConflictError(target)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, skillContent)
}

export async function installSkillCommand(
  options: OutputOptions & { project?: boolean; force?: boolean },
): Promise<void> {
  const target = resolveSkillPath(options)

  try {
    writeSkillFile(target, { force: options.force })
  } catch (error) {
    if (error instanceof SkillConflictError) {
      outputError(error.message, {
        ...options,
        code: ExitCode.CONFLICT,
        hint: 'Pass --force to overwrite.',
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

  const scope = options.project ? 'project' : 'user'
  output(
    { status: 'installed', scope, path: target },
    {
      ...options,
      text: `Installed Cirrux skill (${scope}-scoped) at ${target}`,
      quietValue: target,
    },
  )
}

export function printSkillCommand(options: OutputOptions): void {
  if (options.json) {
    output(
      { content: skillContent },
      {
        ...options,
        text: skillContent,
        quietValue: skillContent,
      },
    )
    return
  }

  process.stdout.write(skillContent)
  if (!skillContent.endsWith('\n')) process.stdout.write('\n')
}
