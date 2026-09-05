import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type ContactListResponse,
  formatContactResults,
  handleContactError,
  requireCredentials,
} from './contacts-shared.js'

export async function contactsSearchCommand(
  query: string,
  options: OutputOptions & { addressbookUuid?: string; limit?: string; cursor?: string },
): Promise<void> {
  requireCredentials(options)

  try {
    const params = new URLSearchParams()
    params.set('q', query)
    if (options.addressbookUuid) params.set('addressbook_uuid', options.addressbookUuid)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)

    const response = await authedRequest<ContactListResponse>(
      `public_api/v1/search/contacts?${params.toString()}`,
    )

    const data: Record<string, unknown> = {
      object: response.object,
      query: response.query,
      has_more: response.has_more,
      ...(response.next_cursor ? { next_cursor: response.next_cursor } : {}),
      data: response.data,
    }

    output(data, { ...options, ...formatContactResults(response) })
  } catch (error) {
    handleContactError(error, options, {
      action: 'Search contacts',
      notFound: 'Addressbook not found.',
    })
  }
}
