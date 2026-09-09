import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type Contact,
  formatContact,
  handleContactError,
  requireCredentials,
} from './contacts-shared.js'

export async function contactsGetCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const contact = await authedRequest<Contact>(
      `public_api/v1/contacts/${encodeURIComponent(uuid)}`,
    )

    output(contact as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatContact(contact),
      quietValue: () => contact.uuid,
    })
  } catch (error) {
    handleContactError(error, options, { action: 'Fetch contact', notFound: 'Contact not found.' })
  }
}
