import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
import { buildSnoozeBody, threadSnoozePath, type SnoozeOptions } from '../email/snooze.js'
import { formatDate } from './list.js'

interface SnoozedThread {
  object: string
  uuid: string
  mailbox_uuid: string
  snooze_until: string | null
  snooze_condition: string | null
  emails: { uuid: string }[]
}

export function threadSnoozedText(thread: SnoozedThread): string {
  const count = thread.emails.length
  const plural = count === 1 ? 'message' : 'messages'

  if (!thread.snooze_until) {
    return `Snooze removed: ${thread.uuid}\n  ${count} ${plural}`
  }

  const suffix = thread.snooze_condition === 'if_no_reply' ? ' (unless they reply)' : ''
  return `Snoozed until ${formatDate(thread.snooze_until)}${suffix}: ${thread.uuid}\n  ${count} ${plural}`
}

export async function threadSnoozeCommand(uuid: string, options: SnoozeOptions): Promise<void> {
  requireCredentials(options)

  const built = buildSnoozeBody(options)
  if (!built.ok) {
    outputError(built.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  try {
    const thread = await authedRequest<SnoozedThread>(threadSnoozePath(uuid, 'snooze'), {
      method: 'POST',
      body: built.body,
    })

    output(thread as unknown as Record<string, unknown>, {
      ...options,
      text: () => threadSnoozedText(thread),
      quietValue: () => thread.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Snooze thread',
      scope: 'email',
      notFound: `Thread '${uuid}' not found.`,
    })
  }
}

export async function threadUnsnoozeCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const thread = await authedRequest<SnoozedThread>(threadSnoozePath(uuid, 'unsnooze'), {
      method: 'POST',
      body: {},
    })

    output(thread as unknown as Record<string, unknown>, {
      ...options,
      text: () => threadSnoozedText(thread),
      quietValue: () => thread.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Remove snooze',
      scope: 'email',
      notFound: `Thread '${uuid}' not found.`,
    })
  }
}
