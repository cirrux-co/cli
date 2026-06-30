import { ApiError, authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Email, summary } from './email-summary.js'
import { resolveLabelTarget, type LabelTargetOptions } from './labels.js'

export type TransitionVerb = 'archive' | 'unarchive' | 'trash' | 'untrash' | 'spam' | 'unspam'

export const TRANSITION_VERBS: TransitionVerb[] = [
  'archive',
  'unarchive',
  'trash',
  'untrash',
  'spam',
  'unspam',
]

export const VERB_LABELS: Record<TransitionVerb, string> = {
  archive: 'Archived',
  unarchive: 'Moved to inbox',
  trash: 'Moved to trash',
  untrash: 'Restored from trash',
  spam: 'Marked as spam',
  unspam: 'Removed from spam',
}

export function transitionPath(emailUuid: string, verb: TransitionVerb | 'move'): string {
  return `public_api/v1/emails/${encodeURIComponent(emailUuid)}/${verb}`
}

function ensureCreds(options: OutputOptions): void {
  const creds = getActiveCredentials()
  if (!creds) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }
}

function handleTransitionError(error: unknown, emailUuid: string, options: OutputOptions): never {
  if (error instanceof ApiError) {
    const description = error.description ?? error.body

    if (error.status === 404) {
      outputError(description || `Email '${emailUuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    if (error.status === 422) {
      outputError(description, {
        ...options,
        code: ExitCode.GENERAL_FAILURE,
        errorType: 'invalid_state',
      })
    }

    if (error.status === 400) {
      outputError(description, {
        ...options,
        code: ExitCode.GENERAL_FAILURE,
        errorType: 'invalid_body',
      })
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  outputError(`Failed to update email: ${message}`, {
    ...options,
    code: ExitCode.GENERAL_FAILURE,
    errorType: 'api_error',
  })
}

async function runTransition(
  emailUuid: string,
  verb: TransitionVerb,
  options: OutputOptions,
): Promise<void> {
  ensureCreds(options)

  try {
    const email = await authedRequest<Email>(
      transitionPath(emailUuid, verb),
      { method: 'POST', body: {} },
    )

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, `${VERB_LABELS[verb]}:`),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleTransitionError(error, emailUuid, options)
  }
}

export const emailArchiveCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'archive', options)

export const emailUnarchiveCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'unarchive', options)

export const emailTrashCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'trash', options)

export const emailUntrashCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'untrash', options)

export const emailSpamCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'spam', options)

export const emailUnspamCommand = (uuid: string, options: OutputOptions) =>
  runTransition(uuid, 'unspam', options)

export async function emailMoveCommand(
  emailUuid: string,
  options: LabelTargetOptions,
): Promise<void> {
  ensureCreds(options)

  const target = resolveLabelTarget(options)
  if (!target.ok) {
    outputError(target.message, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  try {
    const body = target.kind === 'type' ? { type: target.value } : { label_uuid: target.value }

    const email = await authedRequest<Email>(
      transitionPath(emailUuid, 'move'),
      { method: 'POST', body },
    )

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, `Moved to '${target.value}':`),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleTransitionError(error, emailUuid, options)
  }
}
