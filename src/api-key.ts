// A workspace API key, given with --api-key or in CIRRUX_API_KEY (the flag wins), used in place of a
// login. While one is given, every request uses it, even when the CLI is also logged in.
//
// A key belongs to a workspace, not a person, so the public API serves it only the mail endpoints
// (see the backend's Auth::Scopes::API_KEY_SCOPES and PublicApiBaseController#require_user!).
// The CLI refuses the other commands before they reach the API, so the user learns why up front
// instead of from a bare 403. Keep this list in step with the backend.

export const API_KEY_ENV = 'CIRRUX_API_KEY'
export const API_KEY_PREFIX = 'cxk_'
export const API_KEYS_ADMIN_URL = 'https://admin.cirrux.co/api-keys'

export const API_KEY_COMMANDS = 'mailbox, thread, email, draft and attachment'

const KEY_NOUNS = new Set(['mailbox', 'thread', 'email', 'draft', 'attachment'])
const LOCAL_COMMANDS = new Set(['login', 'logout', 'whoami', 'doctor', 'skill', 'help'])
const PERSON_ONLY = new Set(['mailbox addresses create', 'mailbox addresses update', 'mailbox addresses delete'])

export const API_KEY_FLAG = '--api-key'

export interface ApiKey {
  key: string
  /** Where it came from, for messages: `--api-key` or `CIRRUX_API_KEY`. */
  source: string
  /** What to do to stop using it and fall back to the login, as a sentence fragment. */
  howToStop: string
}

let explicitApiKey: string | undefined

export function setExplicitApiKey(value: string | undefined): void {
  explicitApiKey = value?.trim() || undefined
}

export function apiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[API_KEY_ENV]?.trim() || undefined
}

export function resolveApiKey(
  env: NodeJS.ProcessEnv = process.env,
  explicit: string | undefined = explicitApiKey,
): ApiKey | null {
  const fromEnv = apiKeyFromEnv(env)
  if (explicit) {
    const howToStop = fromEnv ? `Leave out ${API_KEY_FLAG} and unset ${API_KEY_ENV}` : `Leave out ${API_KEY_FLAG}`
    return { key: explicit, source: API_KEY_FLAG, howToStop }
  }
  if (fromEnv) return { key: fromEnv, source: API_KEY_ENV, howToStop: `Unset ${API_KEY_ENV}` }
  return null
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX)
}

/** Why a command cannot run with an API key, or null when it can. `path` excludes the program name. */
export function apiKeyRefusal(path: string[]): string | null {
  const [noun] = path
  if (!noun || LOCAL_COMMANDS.has(noun)) return null

  const command = path.join(' ')
  if (PERSON_ONLY.has(command)) {
    return `\`cirrux ${command}\` can't run with an API key: changing a mailbox's addresses needs a signed-in person.`
  }
  if (KEY_NOUNS.has(noun)) return null

  return `\`cirrux ${command}\` can't run with an API key: a workspace API key only reaches mail (the ${API_KEY_COMMANDS} commands).`
}

/**
 * Said by login and logout, whose effect a key in the environment hides for as long as it is set.
 * A key given with --api-key only lasts the one command, so it needs no warning.
 */
export function apiKeyStillInUseNotice(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!apiKeyFromEnv(env)) return null
  return `Note: ${API_KEY_ENV} is set, so commands keep using that API key until you unset it.`
}
