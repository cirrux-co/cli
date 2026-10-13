import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import {
  type DocumentSharing,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from '../docs-shared.js'

export async function docsShareGetCommand(ref: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  try {
    const sharing = await authedRequest<DocumentSharing>(`public_api/v1/documents/${uuid}/sharing`)

    output(sharing as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatDocumentSharing(sharing),
      quietValue: () => sharing.public_link?.url ?? '',
    })
  } catch (error) {
    handleDocsError(error, options, { action: 'Get sharing', notFound: 'Document not found.' })
  }
}

export function formatDocumentSharing(sharing: DocumentSharing): string {
  const lines = [
    sharing.public_link
      ? `Public link: ${sharing.public_link.url} (${sharing.public_link.status})`
      : 'Public link: none',
  ]
  if (sharing.accesses.length > 0) {
    lines.push('Grants:')
    for (const grant of sharing.accesses) {
      const who =
        grant.principal_type === 'workspace'
          ? 'workspace'
          : (grant.principal_user_uuid ?? grant.principal_email ?? grant.principal_type)
      lines.push(`  ${who}\t${grant.role}\t${grant.status}`)
    }
  }
  return lines.join('\n')
}
