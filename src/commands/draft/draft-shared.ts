
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
