import { createInterface } from 'node:readline/promises'

/**
 * Ask before doing something whose blast radius reaches other people.
 *
 * Deliberately the only prompt in the CLI. Deleting a calendar event emails
 * every guest a cancellation, which is not undoable the way trashing a file is,
 * so it gets a confirmation the other mutations do not need.
 *
 * Non-interactive callers (scripts, agents) never see a prompt: without a TTY
 * this returns false, and the command tells them to pass `--yes`. That is
 * principle 4 — never block on input that cannot arrive.
 */
export async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    const answer = await rl.question(`${question} [y/N] `)
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}
