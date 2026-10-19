import { authedRequest } from '../../api.js'
import { type ApiErrorRule, handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { parseAddress, readMarkdownInput } from './create.js'
import { type Draft, draftSummary, requireCredentials } from './draft-shared.js'

export interface DraftUpdateOptions extends OutputOptions {
  markdown?: string
  subject?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  clearCc?: boolean
  clearBcc?: boolean
}

export const DRAFT_UPDATE_ERROR_RULES: ApiErrorRule[] = [
  {
    errorCode: 'already_scheduled',
    exitCode: ExitCode.CONFLICT,
    reason: 'the draft is scheduled to send, or is being sent.',
    hint: 'Cancel the scheduled send in the app first, then update the draft.',
  },
  {
    errorCode: 'not_a_draft',
    exitCode: ExitCode.USAGE_ERROR,
    reason: 'that email is not a draft (it may already have been sent).',
    hint: "To write a new message, use 'cirrux draft create'.",
  },
]

export function updatePath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}`
}

/**
 * Pure: the usage error for a flag combination, or null when it is fine. An
 * update without a single change is refused here rather than by the API.
 */
export function draftUpdateUsageError(options: DraftUpdateOptions): string | null {
  if (options.cc?.length && options.clearCc) {
    return '--cc and --clear-cc are mutually exclusive.'
  }
  if (options.bcc?.length && options.clearBcc) {
    return '--bcc and --clear-bcc are mutually exclusive.'
  }

  const changes =
    options.markdown !== undefined ||
    options.subject !== undefined ||
    Boolean(options.to?.length) ||
    Boolean(options.cc?.length) ||
    Boolean(options.bcc?.length) ||
    Boolean(options.clearCc) ||
    Boolean(options.clearBcc)
  if (!changes) {
    return 'Nothing to update. Pass at least one of --markdown, --subject, --to, --cc, --bcc, --clear-cc or --clear-bcc.'
  }

  return null
}

/**
 * Pure: the PATCH /v1/drafts/:uuid body. Only what was passed is sent, so the
 * server leaves every other field as it is. A recipient flag replaces that
 * whole field; a clear flag empties it.
 */
export function buildDraftUpdateBody(options: DraftUpdateOptions, markdown?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  if (markdown !== undefined) body.markdown = markdown
  if (options.subject !== undefined) body.subject = options.subject
  if (options.to?.length) body.to = options.to.map(parseAddress)

  if (options.clearCc) body.cc = []
  else if (options.cc?.length) body.cc = options.cc.map(parseAddress)

  if (options.clearBcc) body.bcc = []
  else if (options.bcc?.length) body.bcc = options.bcc.map(parseAddress)

  return body
}

export async function draftUpdateCommand(uuid: string, options: DraftUpdateOptions): Promise<void> {
  const usageError = draftUpdateUsageError(options)
  if (usageError) {
    outputError(usageError, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: "Try 'cirrux draft update <uuid> --markdown body.md'.",
      errorType: 'usage_error',
    })
  }

  requireCredentials(options)

  const markdown = options.markdown !== undefined ? await readMarkdownInput(options.markdown, options) : undefined
  const body = buildDraftUpdateBody(options, markdown)

  try {
    const draft = await authedRequest<Draft>(updatePath(uuid), { method: 'PATCH', body })

    output(draft as unknown as Record<string, unknown>, {
      ...options,
      text: () => draftSummary(draft, 'Draft updated'),
      quietValue: () => draft.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Update draft',
      scope: 'email',
      notFound: `Draft '${uuid}' not found.`,
      rules: DRAFT_UPDATE_ERROR_RULES,
    })
  }
}
