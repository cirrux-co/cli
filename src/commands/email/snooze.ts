import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
import { parseWhen, TimeParseError } from '../../time.js'
import { formatDate } from '../thread/list.js'
import { type Email, summary } from './email-summary.js'

export interface SnoozeOptions extends OutputOptions {
  until?: string
  ifNoReply?: boolean
}

export interface SnoozeBody extends Record<string, unknown> {
  until: string
  condition: 'always' | 'if_no_reply'
}

export function snoozePath(uuid: string, verb: 'snooze' | 'unsnooze'): string {
  return `public_api/v1/emails/${encodeURIComponent(uuid)}/${verb}`
}

export function threadSnoozePath(uuid: string, verb: 'snooze' | 'unsnooze'): string {
  return `public_api/v1/threads/${encodeURIComponent(uuid)}/${verb}`
}

/**
 * Pure, so the flag handling is unit-testable without a network. Returns a
 * discriminated union rather than throwing, matching `resolveLabelTarget`.
 */
export function buildSnoozeBody(
  options: SnoozeOptions,
  now?: Date,
): { ok: true; body: SnoozeBody } | { ok: false; message: string } {
  if (!options.until || options.until.trim().length === 0) {
    return { ok: false, message: 'A wake-up time is required. Pass --until "tomorrow 9am".' }
  }

  try {
    return {
      ok: true,
      body: {
        until: parseWhen(options.until, now),
        condition: options.ifNoReply ? 'if_no_reply' : 'always',
      },
    }
  } catch (error) {
    if (error instanceof TimeParseError) return { ok: false, message: error.message }
    throw error
  }
}

/** "Snoozed until Thu, Aug 20, 2026, 09:00" — the wake-up is the thing worth echoing. */
export function snoozedText(email: Email, until: string, condition: SnoozeBody['condition']): string {
  const suffix = condition === 'if_no_reply' ? ' (unless they reply)' : ''
  return summary(email, `Snoozed until ${formatDate(until)}${suffix}:`)
}

export async function emailSnoozeCommand(uuid: string, options: SnoozeOptions): Promise<void> {
  requireCredentials(options)

  const built = buildSnoozeBody(options)
  if (!built.ok) {
    outputError(built.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  try {
    const email = await authedRequest<Email>(snoozePath(uuid, 'snooze'), {
      method: 'POST',
      body: built.body,
    })

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: () => snoozedText(email, built.body.until, built.body.condition),
      quietValue: () => email.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Snooze email',
      scope: 'email',
      notFound: `Email '${uuid}' not found.`,
    })
  }
}

export async function emailUnsnoozeCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const email = await authedRequest<Email>(snoozePath(uuid, 'unsnooze'), {
      method: 'POST',
      body: {},
    })

    output(email as unknown as Record<string, unknown>, {
      ...options,
      text: () => summary(email, 'Snooze removed:'),
      quietValue: () => email.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Remove snooze',
      scope: 'email',
      notFound: `Email '${uuid}' not found.`,
    })
  }
}
