import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type CirruxDocument,
  documentTitle,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'

export async function docsRenameCommand(ref: string, title: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const document = await authedRequest<CirruxDocument>(`public_api/v1/documents/${uuid}`, {
      method: 'POST',
      body: { title },
    })

    output(document as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Renamed to ${documentTitle(document)} (${document.uuid})`,
      quietValue: () => document.uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Rename document', notFound: 'Document not found.' })
  }
}
