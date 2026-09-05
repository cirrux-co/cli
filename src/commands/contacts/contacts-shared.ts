import { handleApiError } from '../../api-errors.js'
import { type OutputOptions } from '../../output.js'

export interface ContactEmail {
  object: string
  uuid: string
  email: string
  types: string[]
  preference: number | null
}

export interface ContactPhone {
  object: string
  uuid: string
  phone: string
  types: string[]
  preference: number | null
}

export interface Contact {
  object: string
  uuid: string
  addressbook_uuid: string
  kind: string
  name_formatted: string | null
  name_given: string | null
  name_family: string | null
  name_additional: string | null
  name_prefix: string | null
  name_suffix: string | null
  nickname: string | null
  company: string | null
  title: string | null
  role: string | null
  notes: string | null
  emails: ContactEmail[]
  phones: ContactPhone[]
  created_at: string
  updated_at: string | null
}

export interface Addressbook {
  object: string
  uuid: string
  mailbox_uuid: string
  name: string
  is_default: boolean
  created_at: string
  updated_at: string | null
}

export interface AddressbookListResponse {
  object: string
  url: string
  has_more: boolean
  data: Addressbook[]
}

export interface ContactListResponse {
  object: string
  url: string
  query?: string
  has_more: boolean
  next_cursor?: string
  data: Contact[]
}

export { requireCredentials } from '../../session.js'

/**
 * Map a failed contacts API call to a clear message + exit code. Binds the
 * scope wording; the ladder itself lives in `api-errors.ts`.
 */
export function handleContactError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'contacts' })
}

/**
 * The name to show for a contact. Falls back through the structured name parts
 * and then the company, because an imported contact can easily have an email
 * address and nothing else — printing a blank line for it would be useless.
 */
export function contactDisplayName(contact: Contact): string {
  const structured = [contact.name_given, contact.name_family].filter(Boolean).join(' ')

  return contact.name_formatted || structured || contact.company || '(unnamed)'
}

/**
 * Render an addressbook listing. The quiet value is the addressbook uuid, which
 * is what `contacts list` and `contacts search --addressbook-uuid` take.
 */
export function formatAddressbookList(response: AddressbookListResponse): {
  text: string
  quietValue: string
} {
  const lines = response.data.map((addressbook) => {
    const suffix = addressbook.is_default ? '\t(default)' : ''
    return `${addressbook.uuid}\t${addressbook.name}${suffix}`
  })

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No addressbooks found.',
    quietValue: response.data.map((addressbook) => addressbook.uuid).join('\n'),
  }
}

/** One contact per line, for search and list results. */
export function formatContactLine(contact: Contact): string {
  const parts = [contactDisplayName(contact)]
  if (contact.company && contact.company !== contactDisplayName(contact)) parts.push(contact.company)
  if (contact.emails[0]) parts.push(contact.emails[0].email)

  return `${contact.uuid}\t${parts.join('\t')}`
}

/** The multi-line detail view for a single contact. */
export function formatContact(contact: Contact): string {
  const lines = [`${contactDisplayName(contact)}  (${contact.uuid})`]

  const org = [contact.title, contact.company].filter(Boolean).join(', ')
  if (org) lines.push(org)
  if (contact.nickname) lines.push(`Nickname:    ${contact.nickname}`)

  for (const email of contact.emails) {
    lines.push(`Email:       ${email.email}${formatTypes(email.types)}`)
  }
  for (const phone of contact.phones) {
    lines.push(`Phone:       ${phone.phone}${formatTypes(phone.types)}`)
  }

  if (contact.notes) lines.push(`Notes:       ${contact.notes}`)

  return lines.join('\n')
}

/**
 * Render a page of contacts into the CLI's human text and the newline-joined
 * uuids used by --quiet. Shared by list and search, which differ only in what
 * "nothing here" means.
 */
export function formatContactResults(
  response: ContactListResponse,
  emptyMessage = 'No contacts matched the query.',
): { text: string; quietValue: string } {
  const lines = response.data.map(formatContactLine)
  // The footer is human text only — in --quiet it would be fed to whatever the
  // caller piped the uuids into.
  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return {
    text: response.data.length > 0 ? lines.join('\n') : emptyMessage,
    quietValue: response.data.map((contact) => contact.uuid).join('\n'),
  }
}

function formatTypes(types: string[]): string {
  return types.length > 0 ? `  (${types.join(', ')})` : ''
}
