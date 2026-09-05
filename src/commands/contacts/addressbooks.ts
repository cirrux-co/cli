import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type AddressbookListResponse,
  formatAddressbookList,
  handleContactError,
  requireCredentials,
} from './contacts-shared.js'

export async function contactsAddressbooksCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<AddressbookListResponse>('public_api/v1/addressbooks')

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...formatAddressbookList(response),
    })
  } catch (error) {
    handleContactError(error, options, { action: 'List addressbooks' })
  }
}
