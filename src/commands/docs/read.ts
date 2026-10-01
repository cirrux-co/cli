import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import {
  type DocumentContent,
  formatDocumentContent,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'

interface DocsReadOptions extends OutputOptions {
  comments?: boolean
}

export async function docsReadCommand(ref: string, options: DocsReadOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const content = await authedRequest<DocumentContent>(`public_api/v1/documents/${uuid}/content`)

    output(content as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatDocumentContent(content, { comments: options.comments }),
      quietValue: () => String(content.revision),
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Read document', notFound: 'Document not found.' })
  }
}
