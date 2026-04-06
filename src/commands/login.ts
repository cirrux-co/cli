import { login } from '../auth.js'

export async function loginCommand(): Promise<void> {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
