import { createInterface } from 'node:readline/promises'
import { ExitCode } from './exit-codes.js'
import { outputError, type OutputOptions } from './output.js'

/**
 * Ask a yes/no question on the terminal.
 *
 * There are two prompts in the CLI, and they should stay rare. Deleting a
 * calendar event emails every guest a cancellation, which is not undoable the
 * way trashing a file is, so it confirms first. An interactive login offers to
 * connect the coding agents it finds, which writes into the user's home
 * directory.
 *
 * Non-interactive callers (scripts, agents) never see a prompt: without a TTY
 * this returns false, and the caller decides what that means (the delete tells
 * them to pass `--yes`). That is principle 4: never block on input that cannot
 * arrive. `defaultYes` only changes what an empty answer at a terminal means.
 */
export async function confirm(question: string, options: { defaultYes?: boolean } = {}): Promise<boolean> {
  if (!canPrompt()) return false

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    const answer = (await rl.question(`${question} ${options.defaultYes ? '[Y/n]' : '[y/N]'} `)).trim()
    if (answer === '') return options.defaultYes ?? false
    return /^y(es)?$/i.test(answer)
  } finally {
    rl.close()
  }
}

function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/**
 * Why a command that needs a yes did not go ahead. Without a terminal nobody was asked, so it must
 * not say "Cancelled.": the caller has to pass `--yes`, which the hint says.
 */
export function confirmationRefusal(interactive: boolean): { message: string; errorType: string } {
  return interactive
    ? { message: 'Cancelled.', errorType: 'not_confirmed' }
    : {
        message: 'Not deleted: this needs confirmation, and there is no terminal to ask in.',
        errorType: 'confirmation_required',
      }
}

/** Asks `question` at a terminal and exits 2 unless the answer is yes. */
export async function confirmDeleteOrExit(question: string, options: OutputOptions): Promise<void> {
  if (await confirm(question)) return

  const refusal = confirmationRefusal(canPrompt())
  outputError(refusal.message, {
    ...options,
    code: ExitCode.USAGE_ERROR,
    errorType: refusal.errorType,
    hint: 'Pass --yes to delete without confirming.',
  })
}
