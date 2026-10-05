import { authedRequest, authedRequestVoid } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { threadUuid } from './comments.js'
import { type DocumentContent, formatDocumentContent, handleDocsError, requireCredentials, resolveDocumentRef } from './docs-shared.js'

/** Accept or reject a suggestion, and print the document after it. */
export async function docsSuggestionsDecideCommand(
  ref: string,
  suggestion: string,
  decision: 'accept' | 'reject',
  options: OutputOptions,
) {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)
  const thread = threadUuid(suggestion, options, 'suggestion')
  const action = decision === 'accept' ? 'Accept suggestion' : 'Reject suggestion'

  try {
    const content = await authedRequest<DocumentContent>(`public_api/v1/documents/${uuid}/suggestions/${thread}/${decision}`, {
      method: 'POST',
    })
    output(content as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatDocumentContent(content),
      quietValue: () => String(content.revision),
    })
  } catch (error) {
    handleDocsError(error, options, { action, notFound: 'Document or suggestion not found.' })
  }
}

export async function docsSuggestionsWithdrawCommand(ref: string, suggestion: string, options: OutputOptions) {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)
  const thread = threadUuid(suggestion, options, 'suggestion')

  try {
    await authedRequestVoid(`public_api/v1/documents/${uuid}/suggestions/${thread}`, { method: 'DELETE' })
    output(
      { withdrawn: true, uuid: thread },
      { ...options, text: () => 'Withdrew the suggestion. What it changed is back as it was.', quietValue: () => thread },
    )
  } catch (error) {
    handleDocsError(error, options, { action: 'Withdraw suggestion', notFound: 'Document or suggestion not found.' })
  }
}
