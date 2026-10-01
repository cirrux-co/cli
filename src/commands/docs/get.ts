import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type CirruxDocument,
  formatDocument,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'

export async function docsGetCommand(ref: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const document = await authedRequest<CirruxDocument>(`public_api/v1/documents/${uuid}`)

    output(document as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatDocument(document),
      quietValue: () => document.uuid,
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Fetch document', notFound: 'Document not found.' })
  }
}
