import { handleApiError } from '../../api-errors.js'
import { authedRequest, authedRequestVoid } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { requireCredentials } from '../../session.js'

export interface MailboxAddress {
  object: string
  uuid: string
  mailbox_uuid: string
  address: string
  local_part: string
  domain: string
  is_primary: boolean
  deactivated_at: string | null
  auto_created_at: string | null
  created_at: string
}

interface MailboxAddressesResponse {
  object: string
  url: string
  has_more: boolean
  data: MailboxAddress[]
}

interface AddressUpdateOptions extends OutputOptions {
  deactivate?: boolean
  activate?: boolean
  primary?: boolean
}

export function addressesPath(mailboxUuid: string, addressUuid?: string): string {
  const base = `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/addresses`
  return addressUuid ? `${base}/${encodeURIComponent(addressUuid)}` : base
}

export function formatAddressLine(a: MailboxAddress): string {
  const flags = [
    a.is_primary && 'primary',
    a.deactivated_at && 'deactivated',
    a.auto_created_at && 'auto-created',
  ].filter(Boolean)
  return [a.uuid, a.address, flags.join(',')].join('\t').trimEnd()
}

/** The address with this email, ignoring case. Plus tags are not addresses, so they never match. */
export function findAddressByEmail(addresses: MailboxAddress[], email: string): MailboxAddress | undefined {
  const wanted = email.trim().toLowerCase()
  return addresses.find((a) => a.address.toLowerCase() === wanted)
}

export type AddressUpdateBody = { deactivated?: boolean; is_primary?: true }

/** The request body for the flags passed, or an error message when they cannot be combined. */
export function buildAddressUpdateBody(
  options: Pick<AddressUpdateOptions, 'deactivate' | 'activate' | 'primary'>,
): AddressUpdateBody | { error: string } {
  if (options.deactivate && options.activate) return { error: 'Pass --deactivate or --activate, not both.' }
  if (options.deactivate && options.primary) {
    return { error: 'An address cannot be made primary and deactivated at the same time.' }
  }

  const body: AddressUpdateBody = {}
  if (options.deactivate) body.deactivated = true
  if (options.activate) body.deactivated = false
  if (options.primary) body.is_primary = true
  if (Object.keys(body).length === 0) return { error: 'Nothing to change.' }
  return body
}

function handleAddressError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, {
    ...context,
    scope: 'address management',
    rules: [
      {
        status: 403,
        errorCode: 'forbidden',
        exitCode: ExitCode.AUTH_REQUIRED,
        hint: 'Ask a workspace admin to make the change, or to let members manage their own addresses.',
      },
    ],
  })
}

/**
 * Accepts the address's UUID or the email address itself. An email is looked up
 * in the mailbox's address list, since the API addresses an alias by UUID only.
 */
async function resolveAddressUuid(mailboxUuid: string, address: string, options: OutputOptions): Promise<string> {
  if (!address.includes('@')) return address

  const response = await authedRequest<MailboxAddressesResponse>(addressesPath(mailboxUuid))
  const found = findAddressByEmail(response.data, address)
  if (!found) {
    outputError(`'${address}' is not an address of mailbox '${mailboxUuid}'.`, {
      ...options,
      code: ExitCode.NOT_FOUND,
      errorType: 'not_found',
      hint: `Run 'cirrux mailbox addresses list ${mailboxUuid}' to see its addresses.`,
    })
  }
  return found.uuid
}

export async function mailboxAddressesListCommand(mailboxUuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<MailboxAddressesResponse>(addressesPath(mailboxUuid))

    output(
      { object: response.object, data: response.data },
      {
        ...options,
        text: () =>
          response.data.length > 0 ? response.data.map(formatAddressLine).join('\n') : 'No addresses found.',
        quietValue: () => response.data.map((a) => a.uuid).join('\n'),
      },
    )
  } catch (error) {
    handleAddressError(error, options, {
      action: 'List addresses',
      notFound: `Mailbox '${mailboxUuid}' not found.`,
    })
  }
}

export async function mailboxAddressesCreateCommand(
  mailboxUuid: string,
  address: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    const created = await authedRequest<MailboxAddress>(addressesPath(mailboxUuid), {
      method: 'POST',
      body: { address },
    })

    output(created as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Added ${created.address} (${created.uuid})`,
      quietValue: () => created.uuid,
    })
  } catch (error) {
    handleAddressError(error, options, {
      action: 'Add address',
      notFound: `Mailbox '${mailboxUuid}' not found.`,
    })
  }
}

export async function mailboxAddressesUpdateCommand(
  mailboxUuid: string,
  address: string,
  options: AddressUpdateOptions,
): Promise<void> {
  requireCredentials(options)

  const body = buildAddressUpdateBody(options)
  if ('error' in body) {
    outputError(body.error, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
      hint: 'Pass --deactivate, --activate and/or --primary.',
    })
  }

  try {
    const addressUuid = await resolveAddressUuid(mailboxUuid, address, options)
    const updated = await authedRequest<MailboxAddress>(addressesPath(mailboxUuid, addressUuid), {
      method: 'POST',
      body,
    })

    output(updated as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Updated ${formatAddressLine(updated)}`,
      quietValue: () => updated.uuid,
    })
  } catch (error) {
    handleAddressError(error, options, { action: 'Update address', notFound: `Address '${address}' not found.` })
  }
}

export async function mailboxAddressesDeleteCommand(
  mailboxUuid: string,
  address: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    const addressUuid = await resolveAddressUuid(mailboxUuid, address, options)
    await authedRequestVoid(addressesPath(mailboxUuid, addressUuid), { method: 'DELETE' })

    output(
      { uuid: addressUuid, deleted: true },
      { ...options, text: () => `Deleted address ${address}`, quietValue: () => addressUuid },
    )
  } catch (error) {
    handleAddressError(error, options, { action: 'Delete address', notFound: `Address '${address}' not found.` })
  }
}
