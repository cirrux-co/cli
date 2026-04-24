import { authedRequest } from '../api.js'
import { getActiveCredentials } from '../config.js'
import { ExitCode } from '../exit-codes.js'
import { output, outputError, type OutputOptions } from '../output.js'

export async function whoamiCommand(options: OutputOptions): Promise<void> {
  const creds = getActiveCredentials()
  if (!creds) {
    outputError('Not logged in.', {
      ...options,
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
      errorType: 'auth_required',
    })
  }

  try {
    const profile = await authedRequest<{
      user?: { uuid: string; username: string; first_name: string; last_name: string }
      workspace?: { uuid: string; name: string }
    }>('public_api/v1/user/profile')

    const data: Record<string, unknown> = {}
    const lines: string[] = []

    if (profile.user) {
      data.user_uuid = profile.user.uuid
      data.username = profile.user.username
      data.first_name = profile.user.first_name
      data.last_name = profile.user.last_name
      lines.push(`User: ${profile.user.first_name} ${profile.user.last_name} (${profile.user.username})`)
    }

    if (profile.workspace) {
      data.workspace_uuid = profile.workspace.uuid
      data.workspace_name = profile.workspace.name
      lines.push(`Workspace: ${profile.workspace.name} (${profile.workspace.uuid})`)
    }

    if (creds.scopes && creds.scopes.length > 0) {
      data.scopes = creds.scopes
      lines.push(`Scopes: ${creds.scopes.join(', ')}`)
    }

    output(data, {
      ...options,
      text: lines.join('\n'),
      quietValue: profile.user?.username,
    })
  } catch (error) {
    outputError(`Failed to fetch profile: ${error instanceof Error ? error.message : error}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'api_error',
    })
  }
}
