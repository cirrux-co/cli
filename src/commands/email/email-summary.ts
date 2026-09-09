import { formatAddresses } from '../thread/list.js'

export interface EmailAttachment {
  object: string
  uuid: string
  filename: string
  content_type: string
  file_size_bytes: number
}

export interface Email {
  object: string
  uuid: string
  thread_uuid: string
  from: { name: string | null; address: string }[]
  to: { name: string | null; address: string }[]
  cc: { name: string | null; address: string }[] | null
  subject: string
  snippet: string | null
  read_at: string | null
  flagged_at: string | null
  date: string
  labels: string[]
  attachments: EmailAttachment[]
}

export function summary(email: Email, action: string): string {
  const from = formatAddresses(email.from)
  const subject = email.subject || '(no subject)'
  return `${action} ${email.uuid}\n  ${subject}\n  From: ${from}`
}
