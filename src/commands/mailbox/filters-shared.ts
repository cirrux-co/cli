import { handleApiError } from '../../api-errors.js'
import { type OutputOptions } from '../../output.js'

export { requireCredentials } from './labels-shared.js'

export interface Filter {
  object: string
  uuid: string
  mailbox_uuid: string
  name: string
  description: string | null
  status: string
  priority: number
  stop_processing: boolean
  condition_ast: unknown
  actions: unknown[]
  match_count: number
  last_matched_at: string | null
  created_at: string
  updated_at: string | null
}

/** Map a failed filter API call to a clear message + exit code. */
export function handleFilterError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'filter management' })
}
