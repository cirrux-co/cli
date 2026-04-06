import { getActiveCredentials, readCredentials, writeCredentials } from '../config.js'

export function logoutCommand(): void {
  const active = getActiveCredentials()
  if (!active) {
    console.log('Not logged in.')
    return
  }

  const creds = readCredentials()
  delete creds.workspaces[active.workspace_uuid]
  creds.active_workspace = undefined
  writeCredentials(creds)

  console.log(`Logged out of ${active.workspace_name}.`)
}
