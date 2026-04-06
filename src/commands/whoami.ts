import { apiRequest } from '../api.js'
import { getActiveCredentials } from '../config.js'

export async function whoamiCommand(): Promise<void> {
  const creds = getActiveCredentials()
  if (!creds) {
    console.error('Not logged in. Run `cirrux login` first.')
    process.exit(1)
  }

  try {
    const profile = await apiRequest<{
      user?: { uuid: string; username: string; first_name: string; last_name: string }
      workspace?: { uuid: string; name: string }
    }>('public_api/v1/user/profile', {
      token: creds.access_token,
    })

    if (profile.user) {
      console.log(`User: ${profile.user.first_name} ${profile.user.last_name} (${profile.user.username})`)
    }
    if (profile.workspace) {
      console.log(`Workspace: ${profile.workspace.name} (${profile.workspace.uuid})`)
    }
  } catch (error) {
    console.error('Failed to fetch profile:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
