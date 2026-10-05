import { readFileSync } from 'node:fs'
import { authedRequest, authedRequestVoid } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  type DocumentContent,
  type DocumentContentThread,
  formatDocumentThread,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'
import { parseOccurrence } from './edit.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface BodyOptions extends OutputOptions {
  file?: string
}

interface AddOptions extends BodyOptions {
  on?: string
  occurrence?: string
  before?: string
  after?: string
}

function usage(message: string, options: OutputOptions, hint?: string): never {
  outputError(message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', ...(hint ? { hint } : {}) })
}

export function threadUuid(value: string, options: OutputOptions, name = 'comment'): string {
  if (UUID.test(value.trim())) return value.trim().toLowerCase()
  usage(`'${value}' is not a ${name} UUID.`, options, "Find it with 'cirrux docs read <document> --comments --json'.")
}

function body(argument: string | undefined, options: BodyOptions): string {
  if (argument !== undefined && options.file) usage('Give the comment as an argument or with --file, not both.', options)
  if (options.file) return readFileSync(options.file, 'utf-8')
  if (argument === undefined || argument.trim() === '') usage('The comment is empty.', options)
  return argument
}

/**
 * Your most recent message in a thread, which `comments edit` changes unless --message names another.
 * Null when the thread is not open (only open threads are listed) or has nothing of yours.
 */
export function latestOwnMessage(threads: DocumentContentThread[], thread: string): string | null {
  const found = threads.find((candidate) => candidate.uuid === thread)
  const mine = found?.messages.filter((message) => message.author?.self) ?? []
  return mine.length > 0 ? mine[mine.length - 1].uuid : null
}

async function writeComment(
  documentRef: string,
  path: string,
  requestBody: Record<string, unknown>,
  options: OutputOptions,
  action: string,
): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(documentRef, options)

  try {
    const thread = await authedRequest<DocumentContentThread>(`public_api/v1/documents/${uuid}/comments${path}`, {
      method: 'POST',
      body: requestBody,
    })
    output(thread as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatDocumentThread(thread),
      quietValue: () => thread.uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action, notFound: 'Document or comment not found.' })
  }
}

export async function docsCommentsAddCommand(ref: string, text: string | undefined, options: AddOptions) {
  const occurrence = parseOccurrence(options.occurrence)
  if (occurrence === null) usage('--occurrence is a number from 1, first or last.', options)
  if (options.on === undefined && (occurrence !== undefined || options.before || options.after)) {
    usage('--occurrence, --before and --after narrow the quote in --on.', options)
  }

  await writeComment(
    ref,
    '',
    {
      body: body(text, options),
      ...(options.on !== undefined ? { on: options.on } : {}),
      ...(occurrence !== undefined ? { occurrence } : {}),
      ...(options.before !== undefined ? { before: options.before } : {}),
      ...(options.after !== undefined ? { after: options.after } : {}),
    },
    options,
    'Comment',
  )
}

export async function docsCommentsReplyCommand(ref: string, thread: string, text: string | undefined, options: BodyOptions) {
  await writeComment(ref, `/${threadUuid(thread, options)}/replies`, { body: body(text, options) }, options, 'Reply')
}

export async function docsCommentsEditCommand(
  ref: string,
  thread: string,
  text: string | undefined,
  options: BodyOptions & { message?: string },
) {
  const threadId = threadUuid(thread, options)
  const replacement = body(text, options)
  let message = options.message ? threadUuid(options.message, options, 'message') : null

  if (!message) {
    requireCredentials(options)
    const uuid = resolveDocumentRef(ref, options)
    try {
      const content = await authedRequest<DocumentContent>(`public_api/v1/documents/${uuid}/content`)
      message = latestOwnMessage(content.threads, threadId)
    } catch (error) {
      handleDocsError(error, options, { action: 'Edit comment', notFound: 'Document not found.' })
    }
    if (!message) {
      usage('You have no message in that open comment to edit.', options, 'Name one with --message <uuid>.')
    }
  }

  await writeComment(ref, `/${threadId}/messages/${message}`, { body: replacement }, options, 'Edit comment')
}

export async function docsCommentsStatusCommand(ref: string, thread: string, status: 'resolved' | 'open', options: OutputOptions) {
  const action = status === 'resolved' ? 'Resolve comment' : 'Reopen comment'
  await writeComment(ref, `/${threadUuid(thread, options)}`, { status }, options, action)
}

export async function docsCommentsDeleteCommand(ref: string, thread: string, options: OutputOptions & { message?: string }) {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)
  const threadId = threadUuid(thread, options)
  const message = options.message ? threadUuid(options.message, options, 'message') : null
  const path = message ? `/${threadId}/messages/${message}` : `/${threadId}`

  try {
    await authedRequestVoid(`public_api/v1/documents/${uuid}/comments${path}`, { method: 'DELETE' })
    const deleted = message ?? threadId
    output(
      { deleted: true, uuid: deleted },
      {
        ...options,
        text: () => (message ? 'Deleted the message.' : 'Deleted the comment, its replies and its marks.'),
        quietValue: () => deleted,
      },
    )
  } catch (error) {
    handleDocsError(error, options, { action: 'Delete comment', notFound: 'Document or comment not found.' })
  }
}
