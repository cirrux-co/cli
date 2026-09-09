import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
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

export async function emailLabelsAddCommand(
  emailUuid: string,
  options: LabelTargetOptions,
): Promise<void> {
  requireCredentials(options)

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
      text: () => summary(email, `Added label '${target.value}':`),
      quietValue: () => email.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Update labels',
      scope: 'email',
      notFound: `Resource for email '${emailUuid}' not found.`,
    })
  }
}

export async function emailLabelsRemoveCommand(
  emailUuid: string,
  options: LabelTargetOptions,
): Promise<void> {
  requireCredentials(options)

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
      text: () => summary(email, `Removed label '${target.value}':`),
      quietValue: () => email.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Update labels',
      scope: 'email',
      notFound: `Resource for email '${emailUuid}' not found.`,
    })
  }
}
