import { homedir } from 'node:os'
import { agentNames, detectAgents, type Agent } from './agents.js'
import { displayPath, describeConnections } from './commands/skill.js'
import { confirm } from './confirm.js'
import { agentSkillDir, agentSkillState, installSkill, sharedSkillDir } from './skill.js'

export type AgentSetupPlan =
  | { kind: 'nothing_to_do' }
  | { kind: 'occupied'; paths: string[] }
  | { kind: 'offer'; agents: Agent[]; paths: string[] }

/**
 * What an interactive login should do about the detected coding agents. A
 * stale skill counts as connected: the post-command refresh brings it up to
 * date without asking.
 */
export function planAgentSetup(root: string, detected: Agent[]): AgentSetupPlan {
  const states = detected.map((agent) => ({ agent, state: agentSkillState(root, agent) }))

  const occupied = states
    .filter(({ state }) => state === 'unmanaged')
    .map(({ agent }) => agentSkillDir(root, agent) ?? sharedSkillDir(root))
  if (occupied.length > 0) return { kind: 'occupied', paths: [...new Set(occupied)] }

  if (states.every(({ state }) => state === 'current' || state === 'stale')) return { kind: 'nothing_to_do' }

  const linkDirs = detected.map((agent) => agentSkillDir(root, agent)).filter((dir): dir is string => dir !== null)
  return { kind: 'offer', agents: detected, paths: [sharedSkillDir(root), ...linkDirs] }
}

export function offerQuestion(plan: Extract<AgentSetupPlan, { kind: 'offer' }>): string {
  const [shared, ...links] = plan.paths.map((path) => displayPath(path))
  const writes = links.length > 0 ? `${shared} and links ${links.join(', ')}` : shared
  const noun = plan.agents.length === 1 ? 'it' : 'them'
  return `Found ${agentNames(plan.agents)} on this machine. Connect ${noun} to Cirrux?\nThis writes ${writes}.`
}

/**
 * Run after a successful interactive login. Every outcome is a notice, never
 * an error: the login itself already succeeded.
 */
export async function offerAgentSetup(): Promise<void> {
  const root = homedir()
  const plan = planAgentSetup(root, detectAgents())

  if (plan.kind === 'nothing_to_do') return

  console.log('')
  if (plan.kind === 'occupied') {
    console.log(`A skill not installed by the Cirrux CLI is in the way at ${plan.paths.map((p) => displayPath(p)).join(', ')}.`)
    console.log('To replace it with the current Cirrux skill, run: cirrux skill install --force')
    return
  }

  if (!(await confirm(offerQuestion(plan), { defaultYes: true }))) {
    console.log('Skipped. Run `cirrux skill install` any time.')
    return
  }

  try {
    const result = installSkill({ root, agents: plan.agents })
    for (const line of describeConnections(result, plan.agents)) console.log(`✓ ${line}`)
    console.log('Start a new agent session to use it.')
  } catch (error) {
    console.log(`Could not connect: ${error instanceof Error ? error.message : String(error)}`)
    console.log('Run `cirrux doctor` to see what is wrong.')
  }
}
