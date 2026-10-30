import { readFileSync } from 'node:fs'
import { authedRequest, authedRequestVoid } from '../../api.js'
import { confirmDeleteOrExit } from '../../confirm.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Contact, formatContact, handleContactError, requireCredentials } from './contacts-shared.js'

export interface ContactWriteOptions extends OutputOptions {
  name?: string
  given?: string
  family?: string
  additional?: string
  prefix?: string
  suffix?: string
  nickname?: string
  company?: string
  title?: string
  role?: string
  notes?: string
  kind?: string
  /** A date, or false for --no-birthday. */
  birthday?: string | false
  email?: string[]
  phone?: string[]
  /** A JSON file with the whole body, or - for stdin. */
  fromJson?: string
}

type Body = Record<string, unknown>
type Built = { body: Body } | { error: string; hint: string }

/** Each scalar flag and the field it sets. An empty string clears the field. */
export const SCALAR_FLAGS = {
  name: 'name_formatted',
  given: 'name_given',
  family: 'name_family',
  additional: 'name_additional',
  prefix: 'name_prefix',
  suffix: 'name_suffix',
  nickname: 'nickname',
  company: 'company',
  title: 'title',
  role: 'role',
  notes: 'notes',
  kind: 'kind',
} as const satisfies Partial<Record<keyof ContactWriteOptions, string>>

const FIELD_FLAGS = [...Object.keys(SCALAR_FLAGS), 'birthday', 'email', 'phone'] as const

const TYPE_PREFIX = /^([A-Za-z][A-Za-z0-9_-]*(?:,[A-Za-z][A-Za-z0-9_-]*)*):(.+)$/
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_DAY = /^(?:--)?(\d{2}-\d{2})$/

/**
 * `work:jane@acme.example` or `mobile,voice:+31 6 1234 5678` as a list entry with types, and a value
 * without a prefix as one without. Only a prefix of plain words counts, so a phone number like
 * `+31:...` or an address with a colon later on is never cut up.
 */
export function parseTypedValue(raw: string, key: 'email' | 'phone'): Body {
  const match = TYPE_PREFIX.exec(raw.trim())
  if (!match) return { [key]: raw.trim() }

  return { [key]: match[2].trim(), types: match[1].split(',') }
}

/** `1980-03-14`, or a day without a year as `03-14` or `--03-14`. */
export function birthdayValue(raw: string): string | null {
  const value = raw.trim()
  if (FULL_DATE.test(value)) return value

  const monthDay = MONTH_DAY.exec(value)
  return monthDay ? `--${monthDay[1]}` : null
}

/**
 * A repeated --email/--phone replaces the whole list; `--email ""` clears it. The empty entries are
 * dropped, so a list of only empty strings is the empty list.
 */
function listBody(values: string[], key: 'email' | 'phone'): Body[] {
  return values.filter((value) => value.trim() !== '').map((value) => parseTypedValue(value, key))
}

/** The body for a create or an update from the field flags, or the usage error to print instead. */
export function buildContactBody(options: ContactWriteOptions, mode: 'create' | 'update'): Built {
  const body: Body = {}

  for (const [flag, field] of Object.entries(SCALAR_FLAGS)) {
    const value = options[flag as keyof typeof SCALAR_FLAGS]
    if (value !== undefined) body[field] = value.trim() === '' ? null : value.trim()
  }

  if (options.birthday === false) body.birthday = null
  else if (options.birthday !== undefined) {
    const birthday = birthdayValue(options.birthday)
    if (!birthday) {
      return { error: `"${options.birthday}" is not a birthday.`, hint: 'Pass YYYY-MM-DD, or MM-DD without a year.' }
    }
    body.birthday = birthday
  }

  if (options.email) body.emails = listBody(options.email, 'email')
  if (options.phone) body.phones = listBody(options.phone, 'phone')

  if (mode === 'create' && !['name_formatted', 'name_given', 'name_family', 'company'].some((f) => body[f])) {
    if (!(body.emails as Body[] | undefined)?.length) {
      return {
        error: 'A contact needs a name, a company or an email address.',
        hint: 'Pass --given and --family, --name, --company or --email.',
      }
    }
  }
  if (mode === 'update' && Object.keys(body).length === 0) {
    return { error: 'Nothing to change.', hint: 'Pass a field to change, or --from-json with the contact.' }
  }

  return { body }
}

/** Whether any field flag was passed, which --from-json may not be combined with. */
export function usesFieldFlags(options: ContactWriteOptions): boolean {
  return FIELD_FLAGS.some((flag) => options[flag as keyof ContactWriteOptions] !== undefined)
}

/** A --from-json document, which must be one JSON object. */
export function parseJsonBody(json: string): Built {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { error: 'The --from-json input is not valid JSON.', hint: 'Pass a JSON object, such as `contacts get --json` prints.' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'The --from-json input must be one JSON object.', hint: 'Pass the contact, such as `contacts get --json` prints.' }
  }

  return { body: parsed as Body }
}

async function readJsonInput(source: string): Promise<string> {
  if (source !== '-') return readFileSync(source, 'utf-8')

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function usageOrExit(result: Built, options: OutputOptions): Body {
  if ('error' in result) {
    outputError(result.error, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', hint: result.hint })
  }

  return result.body
}

async function bodyOrExit(options: ContactWriteOptions, mode: 'create' | 'update'): Promise<Body> {
  if (options.fromJson === undefined) return usageOrExit(buildContactBody(options, mode), options)

  if (usesFieldFlags(options)) {
    usageOrExit(
      { error: '--from-json cannot be combined with field flags.', hint: 'Put every change in the JSON, or use only flags.' },
      options,
    )
  }
  return usageOrExit(parseJsonBody(await readJsonInput(options.fromJson)), options)
}

function contactPath(uuid: string): string {
  return `public_api/v1/contacts/${encodeURIComponent(uuid)}`
}

function printContact(contact: Contact, verb: string, options: OutputOptions): void {
  output(contact as unknown as Record<string, unknown>, {
    ...options,
    text: () => `${verb}\n${formatContact(contact)}`,
    quietValue: () => contact.uuid,
  })
}

export async function contactsCreateCommand(addressbookUuid: string, options: ContactWriteOptions): Promise<void> {
  requireCredentials(options)
  const body = await bodyOrExit(options, 'create')

  try {
    const contact = await authedRequest<Contact>(
      `public_api/v1/addressbooks/${encodeURIComponent(addressbookUuid)}/contacts`,
      { method: 'POST', body },
    )
    printContact(contact, 'Created', options)
  } catch (error) {
    handleContactError(error, options, { action: 'Create contact', notFound: 'Addressbook not found.' })
  }
}

export async function contactsUpdateCommand(uuid: string, options: ContactWriteOptions): Promise<void> {
  requireCredentials(options)
  const body = await bodyOrExit(options, 'update')

  try {
    const contact = await authedRequest<Contact>(contactPath(uuid), { method: 'POST', body })
    printContact(contact, 'Updated', options)
  } catch (error) {
    handleContactError(error, options, { action: 'Update contact', notFound: 'Contact not found.' })
  }
}

export async function contactsDeleteCommand(uuid: string, options: OutputOptions & { yes?: boolean }): Promise<void> {
  requireCredentials(options)
  if (!options.yes) await confirmDeleteOrExit(`Delete contact ${uuid}? This can't be undone.`, options)

  try {
    await authedRequestVoid(contactPath(uuid), { method: 'DELETE' })
    output({ uuid, deleted: true }, {
      ...options,
      text: () => `Deleted contact ${uuid}`,
      quietValue: () => uuid,
    })
  } catch (error) {
    handleContactError(error, options, { action: 'Delete contact', notFound: 'Contact not found.' })
  }
}
