import { authedRequest } from '../api.js'
import { getActiveCredentials } from '../config.js'
import { ExitCode } from '../exit-codes.js'
import { output, outputError, type OutputOptions } from '../output.js'
import { CLI_VERSION } from '../version.js'

// Goes through the same path as the website's feedback button: POST /api/feedback
// emails the team at help@cirrux.co. Agents running inside Claude Code are tagged
// via the X-Cirrux-Co-Author header (added automatically by api.ts), so the team
// can tell agent feedback from a human's.
export const FEEDBACK_PATH = 'api/feedback'

export function buildFeedbackBody({
  message,
  email,
  version,
}: {
  message: string
  email: string
  version: string
}): Record<string, unknown> {
  return {
    message,
    email,
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

  // Best-effort: attach the signed-in address so the team can reply. Failing to
  // resolve it never blocks the feedback from going out.
  let email = ''
  try {
    const profile = await authedRequest<{ user?: { username?: string } }>(
      'public_api/v1/user/profile',
    )
    email = profile.user?.username ?? ''
  } catch {
    // Non-fatal — send the feedback without a reply-to address.
  }

  try {
    await authedRequest(FEEDBACK_PATH, {
      method: 'POST',
      body: buildFeedbackBody({ message: text, email, version: CLI_VERSION }),
    })

    output(
      { success: true },
      {
        ...options,
        text: 'Thanks! Your feedback has been sent to the Cirrux team.',
        quietValue: 'ok',
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
