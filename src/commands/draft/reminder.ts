import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'
import { parseWhen, TimeParseError } from '../../time.js'

export interface ReminderOptions {
  remindAt?: string
  remindIfNoReply?: boolean
}

export interface ReminderFields {
  remind_at: string
  remind_condition: 'always' | 'if_no_reply'
}

/**
 * Pure: turns --remind-at / --remind-if-no-reply into the API's reminder fields,
 * or null when no reminder was asked for. Returns a discriminated union rather than
 * throwing, matching resolveLabelTarget and buildSnoozeBody.
 */
export function buildReminderFields(
  options: ReminderOptions,
  now?: Date,
): { ok: true; fields: ReminderFields | null } | { ok: false; message: string } {
  if (!options.remindAt) {
    // The condition alone says nothing without a time to attach it to; saying so
    // beats silently sending no reminder.
    if (options.remindIfNoReply) {
      return { ok: false, message: '--remind-if-no-reply needs --remind-at.' }
    }
    return { ok: true, fields: null }
  }

  try {
    return {
      ok: true,
      fields: {
        remind_at: parseWhen(options.remindAt, now),
        remind_condition: options.remindIfNoReply ? 'if_no_reply' : 'always',
      },
    }
  } catch (error) {
    if (error instanceof TimeParseError) return { ok: false, message: error.message }
    throw error
  }
}

/** Resolves the flags or exits with a usage error, then merges them into `body`. */
export function applyReminder(
  body: Record<string, unknown>,
  options: ReminderOptions & OutputOptions,
): void {
  const reminder = buildReminderFields(options)
  if (!reminder.ok) {
    outputError(reminder.message, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  if (reminder.fields) Object.assign(body, reminder.fields)
}
