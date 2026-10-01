import { authedRequest } from '../../api.js'
import { deferred, output, type OutputOptions } from '../../output.js'
import {
  type DocumentListResponse,
  formatDocumentList,
  handleDocsError,
  requireCredentials,
} from './docs-shared.js'

export async function docsListCommand(
  options: OutputOptions & { query?: string; trashed?: boolean; limit?: string; cursor?: string },
): Promise<void> {
  requireCredentials(options)

  try {
    const params = new URLSearchParams()
    if (options.query) params.set('q', options.query)
    if (options.limit) params.set('limit', options.limit)
    if (options.cursor) params.set('cursor', options.cursor)
    const query = params.toString()
    const path = options.trashed ? 'public_api/v1/documents/trash' : 'public_api/v1/documents'

    const response = await authedRequest<DocumentListResponse>(`${path}${query ? `?${query}` : ''}`)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() =>
        formatDocumentList(response, options.trashed ? 'Trash is empty.' : 'No documents found.'),
      ),
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'List documents' })
  }
}
