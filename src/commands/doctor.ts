import { homedir } from 'node:os'
import { AGENTS, detectAgents, type Agent } from '../agents.js'
import { ApiError, AuthRefreshFailedError, authedRequest } from '../api.js'
import { API_KEY_COMMANDS, API_KEY_PREFIX, API_KEYS_ADMIN_URL, type ApiKey, looksLikeApiKey, resolveApiKey } from '../api-key.js'
import { getActiveCredentials } from '../config.js'
import { ExitCode } from '../exit-codes.js'
import { output, type OutputOptions } from '../output.js'
import { agentSkillDir, agentSkillState, sharedSkillDir, type SkillState } from '../skill.js'
import { cachedLatestVersion, compareVersions } from '../update-check.js'
import { CLI_VERSION } from '../version.js'
import { displayPath } from './skill.js'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface DoctorCheck {
  name: string
  status: CheckStatus
  message: string
  hint?: string
}

export function versionCheck(current: string, latest: string | null): DoctorCheck {
  const name = 'CLI version'
  if (current === 'dev') return { name, status: 'pass', message: 'Development build' }
  if (latest && compareVersions(latest, current) > 0) {
    return { name, status: 'warn', message: `${current}, ${latest} is available`, hint: 'Run: brew upgrade cirrux' }
  }
  return { name, status: 'pass', message: current }
}

export type SignInResult =
  | { state: 'signed_in'; username: string; workspace: string }
  | { state: 'signed_out' }
  | { state: 'expired' }
  | { state: 'unreachable'; reason: string }
  | { state: 'api_key'; source: string; howToStop: string; workspace: string | null }
  | { state: 'api_key_rejected'; source: string }
  | { state: 'api_key_malformed'; source: string }

export function signInCheck(result: SignInResult): DoctorCheck {
  const name = 'Signed in'
  switch (result.state) {
    case 'api_key':
      return {
        name,
        status: 'pass',
        message: `API key from ${result.source}${result.workspace ? ` (${result.workspace})` : ''}`,
        hint: `It works with the ${API_KEY_COMMANDS} commands. ${result.howToStop} for the rest.`,
      }
    case 'api_key_rejected':
      return {
        name,
        status: 'fail',
        message: `The API key from ${result.source} was not accepted`,
        hint: `A workspace admin can issue a new one at ${API_KEYS_ADMIN_URL}`,
      }
    case 'api_key_malformed':
      return {
        name,
        status: 'fail',
        message: `The value of ${result.source} is not a Cirrux API key`,
        hint: `API keys start with ${API_KEY_PREFIX}`,
      }
    case 'signed_in':
      return { name, status: 'pass', message: `${result.username} (${result.workspace})` }
    case 'signed_out':
      return { name, status: 'fail', message: 'Not signed in', hint: 'Run: cirrux login' }
    case 'expired':
      return { name, status: 'fail', message: 'Session expired', hint: 'Run: cirrux login' }
    case 'unreachable':
      return { name, status: 'warn', message: `Could not reach Cirrux: ${result.reason}` }
  }
}

export function agentCheck(agent: Agent, state: SkillState, skillDir: string): DoctorCheck {
  const name = agent.name
  switch (state) {
    case 'current':
      return { name, status: 'pass', message: 'Connected' }
    case 'stale':
      return {
        name,
        status: 'warn',
        message: 'Connected, but the skill does not match this CLI version',
        hint: 'Run: cirrux skill install',
      }
    case 'missing':
      return { name, status: 'fail', message: 'Not connected', hint: 'Run: cirrux skill install' }
    case 'unmanaged':
      return {
        name,
        status: 'fail',
        message: `${displayPath(skillDir)} holds a skill the Cirrux CLI did not install (or an older release did)`,
        hint: 'To replace it, run: cirrux skill install --force',
      }
  }
}

export function agentChecks(root: string, detected: Agent[]): DoctorCheck[] {
  if (detected.length === 0) {
    const looked = AGENTS.map((agent) => agent.name).join(', ')
    return [{ name: 'Coding agents', status: 'pass', message: `None detected (looked for ${looked})` }]
  }
  return detected.map((agent) =>
    agentCheck(agent, agentSkillState(root, agent), agentSkillDir(root, agent) ?? sharedSkillDir(root)),
  )
}

async function checkApiKey({ key, source, howToStop }: ApiKey): Promise<SignInResult> {
  if (!looksLikeApiKey(key)) return { state: 'api_key_malformed', source }
  try {
    const workspace = await authedRequest<{ name: string }>('public_api/v1/workspace')
    return { state: 'api_key', source, howToStop, workspace: workspace.name }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { state: 'api_key_rejected', source }
    // Accepted, only without the workspace.read permission.
    if (error instanceof ApiError && error.errorCode === 'insufficient_scope') {
      return { state: 'api_key', source, howToStop, workspace: null }
    }
    return { state: 'unreachable', reason: error instanceof Error ? error.message : String(error) }
  }
}

async function checkSignIn(): Promise<SignInResult> {
  const apiKey = resolveApiKey()
  if (apiKey) return checkApiKey(apiKey)
  if (!getActiveCredentials()) return { state: 'signed_out' }
  try {
    const profile = await authedRequest<{ user?: { username: string }; workspace?: { name: string } }>(
      'public_api/v1/user/profile',
    )
    return { state: 'signed_in', username: profile.user?.username ?? '?', workspace: profile.workspace?.name ?? '?' }
  } catch (error) {
    if (error instanceof AuthRefreshFailedError) return { state: 'expired' }
    if (error instanceof ApiError && error.status === 401) return { state: 'expired' }
    return { state: 'unreachable', reason: error instanceof Error ? error.message : String(error) }
  }
}

const STATUS_ICONS: Record<CheckStatus, string> = { pass: '✓', warn: '!', fail: '✗' }

export function formatChecks(checks: DoctorCheck[]): string {
  const width = Math.max(...checks.map((check) => check.name.length))
  return checks
    .flatMap((check) => {
      const line = `${STATUS_ICONS[check.status]} ${check.name.padEnd(width)}  ${check.message}`
      return check.hint ? [line, `  ${' '.repeat(width)}  ${check.hint}`] : [line]
    })
    .join('\n')
}

export async function doctorCommand(options: OutputOptions): Promise<void> {
  const checks = [
    versionCheck(CLI_VERSION, cachedLatestVersion()),
    signInCheck(await checkSignIn()),
    ...agentChecks(homedir(), detectAgents()),
  ]
  const healthy = checks.every((check) => check.status !== 'fail')

  output(
    { status: healthy ? 'ok' : 'issues', checks },
    {
      ...options,
      text: () => formatChecks(checks),
      quietValue: () => (healthy ? 'ok' : 'issues'),
    },
  )
  if (!healthy) process.exitCode = ExitCode.GENERAL_FAILURE
}
