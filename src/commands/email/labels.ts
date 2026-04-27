import { ApiError, authedRequest } from '../../api.js'
import { getActiveCredentials } from '../../config.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Email, summary } from './email-summary.js'

export type LabelTargetOptions = OutputOptions & {
  type?: string
  labelUuid?: string
}

export type LabelTarget =
  | { ok: true; kind: 'type'; value: string }
  | { ok: true; kind: 'label_uuid'; value: string }
  | { ok: false; message: string }

export function resolveLabelTarget(options: LabelTargetOptions): LabelTarget {
  const hasType = typeof options.type === 'string' && options.type.length > 0
  const hasUuid = typeof options.labelUuid === 'string' && options.labelUuid.length > 0

  if (hasType && hasUuid) {
    return { ok: false, message: 'Pass either --type or --label-uuid, not both.' }
  }
  if (!hasType && !hasUuid) {
    return { ok: false, message: 'Pass either --type <type> or --label-uuid <uuid>.' }
  }
  if (hasType) {
    return { ok: true, kind: 'type', value: options.type as string }
  }
  return { ok: true, kind: 'label_uuid', value: options.labelUuid as string }
}

export function parseApiErrorDescription(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error_description?: unknown }
    if (typeof parsed.error_description === 'string') {
      return parsed.error_description
    }
    return null
  } catch {
    return null
  }
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

function handleLabelMutationError(
  error: unknown,
  emailUuid: string,
  options: OutputOptions,
): never {
  if (error instanceof ApiError) {
    const description = parseApiErrorDescription(error.body) ?? error.body

    if (error.status === 404) {
      outputError(description || `Resource for email '${emailUuid}' not found.`, {
        ...options,
        code: ExitCode.NOT_FOUND,
        errorType: 'not_found',
      })
    }

    if (error.status === 422) {
      outputError(description, {
        ...options,
        code: ExitCode.GENERAL_FAILURE,
        errorType: 'invalid_value',
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
  outputError(`Failed to update labels: ${message}`, {
    ...options,
    code: ExitCode.GENERAL_FAILURE,
    errorType: 'api_error',
  })
}

export async function emailLabelsAddCommand(
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
    const body = target.kind === 'type'
      ? { type: target.value }
      : { label_uuid: target.value }

    const email = await authedRequest<Email>(
      `public_api/v1/emails/${encodeURIComponent(emailUuid)}/labels`,
      { method: 'POST', body },
    )

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, `Added label '${target.value}':`),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleLabelMutationError(error, emailUuid, options)
  }
}

export async function emailLabelsRemoveCommand(
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
    const email = await authedRequest<Email>(
      `public_api/v1/emails/${encodeURIComponent(emailUuid)}/labels/${encodeURIComponent(target.value)}`,
      { method: 'DELETE' },
    )

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: summary(email, `Removed label '${target.value}':`),
      quietValue: email.uuid,
    })
  } catch (error) {
    handleLabelMutationError(error, emailUuid, options)
  }
}
