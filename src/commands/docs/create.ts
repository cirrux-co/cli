import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { type CirruxDocument, documentTitle, handleDocsError, requireCredentials } from './docs-shared.js'

export async function docsCreateCommand(options: OutputOptions & { title?: string }): Promise<void> {
  requireCredentials(options)

  try {
    const document = await authedRequest<CirruxDocument>('public_api/v1/documents', {
      method: 'POST',
      body: options.title === undefined ? {} : { title: options.title },
    })

    output(document as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Created ${documentTitle(document)} (${document.uuid})\n${document.url}`,
      quietValue: () => document.uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Create document' })
  }
}
