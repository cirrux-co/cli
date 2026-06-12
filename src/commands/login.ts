import { login } from '../auth.js'

export async function loginCommand(options: { browser?: boolean } = {}): Promise<void> {
  try {
    // Commander negates `--no-browser` into `options.browser === false`.
    await login({ noBrowser: options.browser === false })
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
