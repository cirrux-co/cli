import { API_KEY_ENV, API_KEY_FLAG, API_KEY_PREFIX, API_KEYS_ADMIN_URL, apiKeyRefusal, looksLikeApiKey, resolveApiKey } from './api-key.js'
import { getActiveCredentials } from './config.js'
import { ExitCode } from './exit-codes.js'
import { outputError, type OutputOptions } from './output.js'

/** Exit with AUTH_REQUIRED unless the CLI has an API key or credentials for a workspace. */
export function requireCredentials(options: OutputOptions): void {
  if (!resolveApiKey() && !getActiveCredentials()) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: `Run 'cirrux login' first, or pass a workspace API key with ${API_KEY_FLAG} or ${API_KEY_ENV}.`,
      errorType: 'auth_required',
    })
  }
}

/**
 * Stop a command that cannot run with the given API key before it reaches the API.
 * Does nothing without a key. `path` is the command's name path, without the program name.
 */
export function guardApiKey(path: string[], options: OutputOptions): void {
  const apiKey = resolveApiKey()
  if (!apiKey) return

  if (!looksLikeApiKey(apiKey.key)) {
    outputError(`The value of ${apiKey.source} is not a Cirrux API key.`, {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: `API keys start with ${API_KEY_PREFIX}. A workspace admin creates them at ${API_KEYS_ADMIN_URL}.`,
      errorType: 'invalid_api_key',
    })
  }

  const refusal = apiKeyRefusal(path)
  if (refusal) {
    outputError(refusal, {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: `${apiKey.howToStop} to run it with your login ('cirrux login').`,
      errorType: 'api_key_unsupported',
    })
  }
}
