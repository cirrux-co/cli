import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.cirrux')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')
const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

interface WorkspaceCredentials {
  workspace_uuid: string
  workspace_name: string
  access_token: string
  refresh_token: string
  session_uuid: string
  scopes?: string[]
  api_url: string
}

interface CredentialsFile {
  active_workspace?: string
  workspaces: Record<string, WorkspaceCredentials>
}

export function ensureConfigDir() {
  // Owner-only when the dir is created. An existing dir keeps the mode it has.
  mkdirSync(CONFIG_DIR, { recursive: true, mode: PRIVATE_DIR_MODE })
}

export function readCredentials(): CredentialsFile {
  ensureConfigDir()
  if (!existsSync(CREDENTIALS_FILE)) {
    return { workspaces: {} }
  }
  return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'))
}

export function writeCredentials(creds: CredentialsFile) {
  ensureConfigDir()
  // Owner-only when the file is created. An existing file keeps the mode it has.
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: PRIVATE_FILE_MODE })
}

export function getActiveCredentials(): WorkspaceCredentials | null {
  const creds = readCredentials()
  const activeUuid = creds.active_workspace
  if (!activeUuid) {
    const first = Object.values(creds.workspaces)[0]
    return first ?? null
  }
  return creds.workspaces[activeUuid] ?? null
}

export function saveWorkspaceCredentials(workspace: WorkspaceCredentials) {
  const creds = readCredentials()
  creds.workspaces[workspace.workspace_uuid] = workspace
  creds.active_workspace = workspace.workspace_uuid
  writeCredentials(creds)
}
