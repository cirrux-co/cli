// What `cirrux login --scopes` may ask for: the cirrux-cli client's ceiling on the server
// (workspaces/backend/app/features/auth/clients.rb). The server refuses anything else too; checking
// here first means a typo fails before a browser opens, with the list to pick from.
export const LOGIN_SCOPES = [
  'user.profile',
  'email.read',
  'email.write',
  'email.send',
  'drive.read',
  'drive.create',
  'drive.update',
  'drive.delete',
  'calendar.read',
  'calendar.write',
  'tasks.read',
  'tasks.write',
  'contacts.read',
  'contacts.write',
  'docs.read',
  'docs.comment',
  'docs.write',
] as const

export class InvalidLoginScopesError extends Error {
  constructor(readonly invalid: string[]) {
    const problem =
      invalid.length === 0
        ? '--scopes needs at least one scope.'
        : `Unknown scope${invalid.length === 1 ? '' : 's'}: ${invalid.join(', ')}.`
    super(`${problem} Valid scopes: ${LOGIN_SCOPES.join(', ')}.`)
  }
}

/** Comma- or space-separated, as typed. Undefined when nothing was asked for. */
export function parseLoginScopes(input: string | undefined): string[] | undefined {
  if (input === undefined) return undefined

  const scopes = [...new Set(input.split(/[\s,]+/).filter((scope) => scope.length > 0))]
  if (scopes.length === 0) throw new InvalidLoginScopesError([])

  const known = new Set<string>(LOGIN_SCOPES)
  const invalid = scopes.filter((scope) => !known.has(scope))
  if (invalid.length > 0) throw new InvalidLoginScopesError(invalid)

  return scopes
}

/**
 * The scope a refused request needed, from the server's `insufficient_scope` description
 * ("Required scope: drive.update", or "drive.update or drive.delete"): the first one named.
 */
export function requiredScopeFrom(description: string | undefined): string | undefined {
  return description?.match(/Required scope: ([\w.]+)/)?.[1]
}
