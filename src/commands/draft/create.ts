import { readFileSync } from 'node:fs'
import { authedRequest } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Draft, ensureCreds, handleDraftError } from './draft-shared.js'

export interface DraftCreateOptions extends OutputOptions {
  mailboxUuid?: string
  file?: string
  inReplyTo?: string
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

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function draftCreateCommand(options: DraftCreateOptions): Promise<void> {
  ensureCreds(options)

  if (!options.mailboxUuid) {
    outputError('--mailbox-uuid is required.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  const mime = await readMimeInput(options)

  const body: Record<string, unknown> = {
    mailbox_uuid: options.mailboxUuid,
    body_format: 'mime',
    mime,
  }
  if (options.inReplyTo) {
    body.in_reply_to_email_uuid = options.inReplyTo
  }

  try {
    const draft = await authedRequest<Draft>('public_api/v1/drafts', {
      method: 'POST',
      body,
    })

    output(draft as unknown as Record<string, unknown>, {
      ...options,
      text: summary(draft),
      quietValue: draft.uuid,
    })
  } catch (error) {
    handleDraftError(error, 'Failed to create draft', options)
  }
}

function summary(draft: Draft): string {
  const lines = [`Draft created: ${draft.uuid}`]
  if (draft.subject) lines.push(`  Subject: ${draft.subject}`)
  if (draft.to.length > 0) {
    lines.push(`  To: ${draft.to.map((a) => a.address).join(', ')}`)
  }
  if (draft.in_reply_to_email_uuid) {
    lines.push(`  In reply to: ${draft.in_reply_to_email_uuid}`)
  }
  return lines.join('\n')
}
