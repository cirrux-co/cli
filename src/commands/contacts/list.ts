import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type ContactListResponse,
  formatContactResults,
  handleContactError,
  requireCredentials,
} from './contacts-shared.js'

export async function contactsListCommand(
  addressbookUuid: string,
  options: OutputOptions & { limit?: string; cursor?: string },
): Promise<void> {
  requireCredentials(options)

  try {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)
    const query = params.toString()

    const response = await authedRequest<ContactListResponse>(
      `public_api/v1/addressbooks/${encodeURIComponent(addressbookUuid)}/contacts${query ? `?${query}` : ''}`,
    )

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...formatContactResults(response, 'This addressbook has no contacts.'),
    })
  } catch (error) {
    handleContactError(error, options, {
      action: 'List contacts',
      notFound: 'Addressbook not found.',
    })
  }
}
