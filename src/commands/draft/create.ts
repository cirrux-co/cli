import { readFileSync } from 'node:fs'
import { authedRequest } from '../../api.js'
import { type ApiErrorRule, handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { applyReminder, type ReminderOptions } from './reminder.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Draft, draftSummary, requireCredentials } from './draft-shared.js'

export interface DraftCreateOptions extends OutputOptions, ReminderOptions {
  mailboxUuid?: string
  file?: string
  markdown?: string
  subject?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  inReplyTo?: string
  // Commander's `--no-quote-original` negation: defaults to true, set to false
  // when the flag is passed. Only meaningful for a markdown reply.
  quoteOriginal?: boolean
  replyAll?: boolean
  forward?: string
  from?: string
}

// A reply has to live in its parent's mailbox, because that is where the thread
// is. The API's description already names the right mailbox.
export const DRAFT_CREATE_ERROR_RULES: ApiErrorRule[] = [
  {
    errorCode: 'mailbox_mismatch',
    exitCode: ExitCode.USAGE_ERROR,
    hint: "Pass the parent's mailbox as --mailbox-uuid. 'cirrux email get <email-uuid>' shows it.",
  },
]

export interface DraftAddress {
  address: string
  name?: string
}

// Commander option collector for repeatable --to/--cc/--bcc flags.
export function collectAddress(value: string, previous: string[]): string[] {
  return [...previous, value]
}

// Accepts `Name <addr>` or just `addr`. Display name parsing is intentionally
// minimal — angle-bracket form is the standard, anything else is treated as a
// bare address.
export function parseAddress(input: string): DraftAddress {
  const trimmed = input.trim()
  const match = trimmed.match(/^(.*?)\s*<\s*([^>]+)\s*>$/)
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '').trim()
    const address = match[2].trim()
    return name.length > 0 ? { address, name } : { address }
  }
  return { address: trimmed }
}

// A MIME draft carries its own From/To/Cc/Subject headers, so these flags have
// nothing to act on there. Saying so beats silently dropping them.
const MARKDOWN_ONLY_FLAGS: [keyof DraftCreateOptions, string][] = [
  ['replyAll', '--reply-all'],
  ['forward', '--forward'],
  ['from', '--from'],
]

/**
 * Pure: the usage error for a flag combination the API would reject or silently
 * ignore, or null when the combination is fine.
 */
export function draftCreateUsageError(options: DraftCreateOptions): string | null {
  if (options.file && options.markdown) {
    return '--file and --markdown are mutually exclusive.'
  }

  if (!options.markdown) {
    const used = MARKDOWN_ONLY_FLAGS.filter(([key]) => Boolean(options[key])).map(([, flag]) => flag)
    if (used.length > 0) {
      return `Only a --markdown draft takes ${used.join(', ')}: a MIME draft carries its own headers.`
    }
  }

  if (options.forward && options.inReplyTo) {
    return '--forward and --in-reply-to are mutually exclusive.'
  }

  if (options.replyAll && !options.inReplyTo) {
    return '--reply-all needs --in-reply-to.'
  }

  return null
}

/**
 * Pure: the POST /v1/drafts body for already-read content. `content` is the
 * markdown when --markdown is set, and the MIME message otherwise. Reminder
 * fields are merged in separately by applyReminder.
 */
export function buildDraftCreateBody(options: DraftCreateOptions, content: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mailbox_uuid: options.mailboxUuid,
  }

  if (options.markdown) {
    body.body_format = 'markdown'
    body.markdown = content
    if (options.subject) body.subject = options.subject
    if (options.to?.length) body.to = options.to.map(parseAddress)
    if (options.cc?.length) body.cc = options.cc.map(parseAddress)
    if (options.bcc?.length) body.bcc = options.bcc.map(parseAddress)
    if (options.from) body.from = options.from
    if (options.replyAll) body.reply_all = true
    if (options.forward) body.forward_email_uuid = options.forward
    // Default is to quote (server-side); only send the opt-out. Quoting only
    // applies when this is a reply (--in-reply-to).
    if (options.quoteOriginal === false) body.quote_original = false
  } else {
    body.body_format = 'mime'
    body.mime = content
  }

  if (options.inReplyTo) {
    body.in_reply_to_email_uuid = options.inReplyTo
  }

  return body
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** The --markdown body: the file at `path`, or stdin when `path` is `-`. */
export async function readMarkdownInput(path: string, options: OutputOptions): Promise<string> {
  if (path !== '-') return readFileSync(path, 'utf-8')

  if (process.stdin.isTTY) {
    outputError('--markdown - reads the body from stdin, but nothing was piped in.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Pipe the markdown in, or pass a file path to --markdown.',
      errorType: 'usage_error',
    })
  }

  return readStdin()
}

export async function readMimeInput(options: DraftCreateOptions): Promise<string> {
  if (options.file) {
    return readFileSync(options.file, 'utf-8')
  }

  if (process.stdin.isTTY) {
    outputError('No MIME content provided. Pass --file <path> or pipe MIME on stdin.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: "Try 'cirrux draft create --mailbox-uuid <uuid> --file message.eml'.",
      errorType: 'usage_error',
    })
  }

  return readStdin()
}

export async function draftCreateCommand(options: DraftCreateOptions): Promise<void> {
  const usageError = draftCreateUsageError(options)
  if (usageError) {
    outputError(usageError, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  requireCredentials(options)

  if (!options.mailboxUuid) {
    outputError('--mailbox-uuid is required.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  const content = options.markdown
    ? await readMarkdownInput(options.markdown, options)
    : await readMimeInput(options)
  const body = buildDraftCreateBody(options, content)

  applyReminder(body, options)

  try {
    const draft = await authedRequest<Draft>('public_api/v1/drafts', {
      method: 'POST',
      body,
    })

    output(draft as unknown as Record<string, unknown>, {
      ...options,
      text: () => draftSummary(draft, 'Draft created'),
      quietValue: () => draft.uuid,
    })
  } catch (error) {
    handleApiError(error, options, { action: 'Create draft', scope: 'email', rules: DRAFT_CREATE_ERROR_RULES })
  }
}
