import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { type Email, summary } from '../email/email-summary.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { parseWhen, TimeParseError } from '../../time.js'
import { type Draft, draftSummary, requireCredentials } from './draft-shared.js'
import { buildReminderFields, type ReminderOptions } from './reminder.js'

export interface SendOptions extends OutputOptions, ReminderOptions {
  at?: string
}

export function sendPath(uuid: string): string {
  return `public_api/v1/drafts/${encodeURIComponent(uuid)}/send`
}

/**
 * Pure: turns --at and the reminder flags into the send request body, or a usage error.
 * `--at` schedules the send for later (the API returns the scheduled draft); omitted, the
 * draft sends now. Mirrors buildReminderFields' discriminated-union shape.
 */
export function buildSendBody(
  options: SendOptions,
  now?: Date,
): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  const reminder = buildReminderFields(options, now)
  if (!reminder.ok) return { ok: false, message: reminder.message }

  const body: Record<string, unknown> = {}
  if (reminder.fields) Object.assign(body, reminder.fields)

  if (options.at) {
    try {
      body.send_at = parseWhen(options.at, now)
    } catch (error) {
      if (error instanceof TimeParseError) return { ok: false, message: error.message }
      throw error
    }
  }

  return { ok: true, body }
}

export async function draftSendCommand(uuid: string, options: SendOptions): Promise<void> {
  requireCredentials(options)

  const built = buildSendBody(options)
  if (!built.ok) {
    outputError(built.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
    return
  }

  try {
    const result = await authedRequest<Email | Draft>(sendPath(uuid), { method: 'POST', body: built.body })
    const scheduled = (result as { object?: string }).object === 'draft'

    output(result as unknown as Record<string, unknown>, {
      ...options,
      text: () => (scheduled ? draftSummary(result as Draft, 'Scheduled draft') : summary(result as Email, 'Sent draft')),
      quietValue: () => (result as { uuid: string }).uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: options.at ? 'Schedule draft' : 'Send draft',
      scope: 'email',
      notFound: `Draft '${uuid}' not found.`,
    })
  }
}
