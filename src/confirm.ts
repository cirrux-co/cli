import { createInterface } from 'node:readline/promises'

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
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    const answer = (await rl.question(`${question} ${options.defaultYes ? '[Y/n]' : '[y/N]'} `)).trim()
    if (answer === '') return options.defaultYes ?? false
    return /^y(es)?$/i.test(answer)
  } finally {
    rl.close()
  }
}
