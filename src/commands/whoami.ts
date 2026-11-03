import { ApiError, authedRequest } from '../api.js'
import { handleApiError } from '../api-errors.js'
import { API_KEY_COMMANDS, type ApiKey, resolveApiKey } from '../api-key.js'
import { getActiveCredentials } from '../config.js'
import { output, type OutputOptions } from '../output.js'
import { requireCredentials } from '../session.js'

interface Workspace {
  uuid: string
  name: string
}

export async function whoamiCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  const apiKey = resolveApiKey()
  if (apiKey) {
    await apiKeyWhoami(apiKey, options)
  } else {
    await loginWhoami(options)
  }
}

// A key is not a person, so all there is to say is which workspace it belongs to, which it can only
// read with the workspace.read permission, and what it can be used for.
async function apiKeyWhoami(apiKey: ApiKey, options: OutputOptions): Promise<void> {
  let workspace: Workspace | null = null
  try {
    workspace = await authedRequest<Workspace>('public_api/v1/workspace')
  } catch (error) {
    const keyAcceptedWithoutWorkspaceRead = error instanceof ApiError && error.errorCode === 'insufficient_scope'
    if (!keyAcceptedWithoutWorkspaceRead) handleApiError(error, options, { action: 'Fetch workspace' })
  }

  output(
    {
      auth: 'api_key',
      api_key_source: apiKey.source,
      ...(workspace ? { workspace_uuid: workspace.uuid, workspace_name: workspace.name } : {}),
    },
    {
      ...options,
      text: () =>
        [
          `API key from ${apiKey.source}`,
          workspace
            ? `Workspace: ${workspace.name} (${workspace.uuid})`
            : 'Workspace: not readable (the key does not have the workspace.read permission)',
          `Works with: the ${API_KEY_COMMANDS} commands`,
        ].join('\n'),
      quietValue: () => '',
    },
  )
}

async function loginWhoami(options: OutputOptions): Promise<void> {
  const creds = getActiveCredentials()!

  try {
    const profile = await authedRequest<{
      user?: { uuid: string; username: string; first_name: string; last_name: string }
      workspace?: Workspace
    }>('public_api/v1/user/profile')

    const data: Record<string, unknown> = { auth: 'login' }

    if (profile.user) {
      data.user_uuid = profile.user.uuid
      data.username = profile.user.username
      data.first_name = profile.user.first_name
      data.last_name = profile.user.last_name
    }

    if (profile.workspace) {
      data.workspace_uuid = profile.workspace.uuid
      data.workspace_name = profile.workspace.name
    }

    if (creds.scopes && creds.scopes.length > 0) {
      data.scopes = creds.scopes
    }

    output(data, {
      ...options,
      text: () => {
        const lines: string[] = []
        if (profile.user) {
          lines.push(`User: ${profile.user.first_name} ${profile.user.last_name} (${profile.user.username})`)
        }
        if (profile.workspace) {
          lines.push(`Workspace: ${profile.workspace.name} (${profile.workspace.uuid})`)
        }
        if (creds.scopes && creds.scopes.length > 0) {
          lines.push(`Scopes: ${creds.scopes.join(', ')}`)
        }
        return lines.join('\n')
      },
      quietValue: () => profile.user?.username ?? '',
    })
  } catch (error) {
    handleApiError(error, options, { action: 'Fetch profile' })
  }
}
