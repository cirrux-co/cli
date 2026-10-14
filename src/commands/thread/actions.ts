import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'
import { resolveLabelTarget, type LabelTargetOptions } from '../email/labels.js'

// The email verbs for a whole conversation. Which messages each one touches follows the web app
// (the server decides): archiving archives every message, flag stars the latest one, unread
// marks the last message received, and drafts are always left alone.
export type ThreadVerb =
  | 'archive'
  | 'unarchive'
  | 'trash'
  | 'untrash'
  | 'spam'
  | 'unspam'
  | 'read'
  | 'unread'
  | 'flag'
  | 'unflag'

export const THREAD_VERB_LABELS: Record<ThreadVerb, string> = {
  archive: 'Archived',
  unarchive: 'Moved to inbox',
  trash: 'Moved to trash',
  untrash: 'Restored from trash',
  spam: 'Marked as spam',
  unspam: 'Removed from spam',
  read: 'Marked as read',
  unread: 'Marked as unread',
  flag: 'Starred',
  unflag: 'Unstarred',
}

interface ThreadResponse {
  object: string
  uuid: string
  emails: { uuid: string }[]
}

export function threadActionPath(threadUuid: string, action: ThreadVerb | 'move' | 'labels'): string {
  return `public_api/v1/threads/${encodeURIComponent(threadUuid)}/${action}`
}

export function threadLabelPath(threadUuid: string, identifier: string): string {
  return `${threadActionPath(threadUuid, 'labels')}/${encodeURIComponent(identifier)}`
}

export function threadActionText(thread: ThreadResponse, prefix: string): string {
  const count = thread.emails.length
  return `${prefix} ${thread.uuid}\n  ${count} ${count === 1 ? 'message' : 'messages'}`
}

async function send(
  threadUuid: string,
  path: string,
  init: { method: 'POST' | 'DELETE'; body?: Record<string, unknown> },
  prefix: string,
  options: OutputOptions,
): Promise<void> {
  try {
    const thread = await authedRequest<ThreadResponse>(path, init)

    output(thread as unknown as Record<string, unknown>, {
      ...options,
      text: () => threadActionText(thread, prefix),
      quietValue: () => thread.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Update thread',
      scope: 'email',
      notFound: `Thread '${threadUuid}' not found.`,
    })
  }
}

export function threadVerbCommand(verb: ThreadVerb) {
  return async (threadUuid: string, options: OutputOptions): Promise<void> => {
    requireCredentials(options)
    await send(threadUuid, threadActionPath(threadUuid, verb), { method: 'POST', body: {} },
      `${THREAD_VERB_LABELS[verb]}:`, options)
  }
}

function labelTargetOrExit(options: LabelTargetOptions) {
  const target = resolveLabelTarget(options)
  if (!target.ok) {
    outputError(target.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }
  return target as Extract<ReturnType<typeof resolveLabelTarget>, { ok: true }>
}

function labelBody(target: { kind: 'type' | 'label_uuid'; value: string }): Record<string, unknown> {
  return target.kind === 'type' ? { type: target.value } : { label_uuid: target.value }
}

export async function threadMoveCommand(threadUuid: string, options: LabelTargetOptions): Promise<void> {
  requireCredentials(options)
  const target = labelTargetOrExit(options)
  await send(threadUuid, threadActionPath(threadUuid, 'move'), { method: 'POST', body: labelBody(target) },
    `Moved to '${target.value}':`, options)
}

export async function threadLabelsAddCommand(threadUuid: string, options: LabelTargetOptions): Promise<void> {
  requireCredentials(options)
  const target = labelTargetOrExit(options)
  await send(threadUuid, threadActionPath(threadUuid, 'labels'), { method: 'POST', body: labelBody(target) },
    `Added label '${target.value}':`, options)
}

export async function threadLabelsRemoveCommand(threadUuid: string, options: LabelTargetOptions): Promise<void> {
  requireCredentials(options)
  const target = labelTargetOrExit(options)
  await send(threadUuid, threadLabelPath(threadUuid, target.value), { method: 'DELETE' },
    `Removed label '${target.value}':`, options)
}
