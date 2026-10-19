
export interface Draft {
  object: 'draft'
  uuid: string
  mailbox_uuid: string
  thread_uuid: string
  in_reply_to_email_uuid: string | null
  from: { address: string; name: string | null }[]
  to: { address: string; name: string | null }[]
  cc: { address: string; name: string | null }[]
  bcc: { address: string; name: string | null }[]
  subject: string | null
  snippet: string | null
  body_html: string | null
  body_text: string | null
  labels: string[]
  created_at: string
  updated_at: string
}

export { requireCredentials } from '../../session.js'

function addresses(list: Draft['to']): string {
  return list.map((a) => a.address).join(', ')
}

/** The human-readable summary of a draft, under a heading such as 'Draft created'. */
export function draftSummary(draft: Draft, heading: string): string {
  const lines = [`${heading}: ${draft.uuid}`]
  if (draft.from.length > 0) lines.push(`  From: ${addresses(draft.from)}`)
  if (draft.subject) lines.push(`  Subject: ${draft.subject}`)
  if (draft.to.length > 0) lines.push(`  To: ${addresses(draft.to)}`)
  if (draft.cc.length > 0) lines.push(`  Cc: ${addresses(draft.cc)}`)
  if (draft.bcc.length > 0) lines.push(`  Bcc: ${addresses(draft.bcc)}`)
  if (draft.in_reply_to_email_uuid) lines.push(`  In reply to: ${draft.in_reply_to_email_uuid}`)
  return lines.join('\n')
}
