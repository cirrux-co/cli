import { handleApiError } from '../../api-errors.js'
import { type OutputOptions } from '../../output.js'

export interface Label {
  object: string
  uuid: string
  name: string
  type: string
  color: string | null
  description: string | null
  is_visible: boolean
  position: number
}

export { requireCredentials } from '../../session.js'

/** Map a failed label API call to a clear message + exit code. */
export function handleLabelError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'label management' })
}
