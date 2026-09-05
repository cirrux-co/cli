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
