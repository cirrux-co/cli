import { type ApiErrorRule } from '../api-errors.js'
import { ExitCode } from '../exit-codes.js'

// A rejected query is the caller's mistake, not a failure, so it exits 2 with
// the operator hint rather than the API's bare description.
export const SEARCH_ERROR_RULES: ApiErrorRule[] = [
  {
    errorCode: 'invalid_query',
    exitCode: ExitCode.USAGE_ERROR,
    hint: 'Every operator needs a value; filter by date with "after:YYYY-MM-DD before:YYYY-MM-DD".',
  },
]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface MailSearchOptions {
  mailboxUuid?: string
  label?: string
  limit?: string
  cursor?: string
}

// `--label` takes a uuid or a name. A uuid goes to the API as `label_uuid`; a name becomes a
// `label:` term in the query, which matches that label in every mailbox searched.
export function buildMailSearchParams(query: string, options: MailSearchOptions): URLSearchParams {
  const params = new URLSearchParams()
  const label = options.label?.trim()

  if (label && UUID_PATTERN.test(label)) {
    params.set('q', query)
    params.set('label_uuid', label)
  } else if (label) {
    const term = /\s/.test(label) ? `label:"${label}"` : `label:${label}`
    params.set('q', `${query} ${term}`)
  } else {
    params.set('q', query)
  }

  if (options.mailboxUuid) params.set('mailbox_uuid', options.mailboxUuid)
  if (options.limit) params.set('limit', options.limit)
  if (options.cursor) params.set('cursor', options.cursor)
  return params
}
