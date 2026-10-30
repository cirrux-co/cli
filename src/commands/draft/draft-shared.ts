
export interface DraftAttachment {
  uuid: string
  filename: string | null
  content_type: string
  file_size_bytes: number
}

export interface Draft {
  object: 'draft'
  uuid: string
  mailbox_uuid: string
  thread_uuid: string
  in_reply_to_email_uuid: string | null
  from: { address: string; name: string | null }[]
  to: { address: string; name: string | null }[]
  /** Left out of the response when the draft has none. */
  cc?: { address: string; name: string | null }[]
  bcc?: { address: string; name: string | null }[]
  subject: string | null
  snippet: string | null
  body_html: string | null
  body_text: string | null
  labels: string[]
  attachments: DraftAttachment[]
  /** Set when the draft is scheduled to send later rather than being a plain draft. */
  send_at?: string | null
  created_at: string
  updated_at: string
}

export { requireCredentials } from '../../session.js'

function addresses(list: NonNullable<Draft['cc']>): string {
  return list.map((a) => a.address).join(', ')
}

/** The human-readable summary of a draft, under a heading such as 'Draft created'. */
export function draftSummary(draft: Draft, heading: string): string {
  const lines = [`${heading}: ${draft.uuid}`]
  if (draft.from.length > 0) lines.push(`  From: ${addresses(draft.from)}`)
  if (draft.subject) lines.push(`  Subject: ${draft.subject}`)
  if (draft.to.length > 0) lines.push(`  To: ${addresses(draft.to)}`)
  if (draft.cc?.length) lines.push(`  Cc: ${addresses(draft.cc)}`)
  if (draft.bcc?.length) lines.push(`  Bcc: ${addresses(draft.bcc)}`)
  if (draft.in_reply_to_email_uuid) lines.push(`  In reply to: ${draft.in_reply_to_email_uuid}`)
  if (draft.send_at) lines.push(`  Scheduled to send: ${draft.send_at}`)
  // With uuids, which is what --remove-attachment takes.
  for (const attachment of draft.attachments ?? []) {
    lines.push(`  Attachment: ${attachment.filename ?? 'attachment'} (${attachment.uuid})`)
  }
  return lines.join('\n')
}
