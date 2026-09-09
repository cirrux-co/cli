import { authedRequest } from '../api.js'
import { getActiveCredentials } from '../config.js'
import { ExitCode } from '../exit-codes.js'
import { output, outputError, type OutputOptions } from '../output.js'
import { CLI_VERSION } from '../version.js'

// Goes through the same path as the website's feedback button: POST /api/feedback
// emails the team at help@cirrux.co. Agents running inside Claude Code are tagged
// via the X-Cirrux-Co-Author header (added automatically by api.ts), so the team
// can tell agent feedback from a human's.
//
// There is deliberately no `email` field here: that is the reply address a person
// types into the web feedback form, and the CLI has no such field. The backend
// stamps the signed-in sender (name, username and mailbox address) onto the email
// itself, so the team can always reply.
export const FEEDBACK_PATH = 'api/feedback'

export function buildFeedbackBody({
  message,
  version,
}: {
  message: string
  version: string
}): Record<string, unknown> {
  return {
    message,
    url: '',
    client_version: version,
    app: 'Cirrux CLI',
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export async function feedbackCommand(
  message: string | undefined,
  options: OutputOptions,
): Promise<void> {
  if (!getActiveCredentials()) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }

  let text = message?.trim() ?? ''
  if (!text && !process.stdin.isTTY) {
    text = (await readStdin()).trim()
  }

  if (!text) {
    outputError('No feedback message provided.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Pass a message: cirrux feedback "your feedback" (or pipe it on stdin).',
      errorType: 'usage_error',
    })
  }

  try {
    await authedRequest(FEEDBACK_PATH, {
      method: 'POST',
      body: buildFeedbackBody({ message: text, version: CLI_VERSION }),
    })

    output(
      { success: true },
      {
        ...options,
        text: () => 'Thanks! Your feedback has been sent to the Cirrux team.',
        quietValue: () => 'ok',
      },
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    outputError(`Failed to send feedback: ${detail}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
