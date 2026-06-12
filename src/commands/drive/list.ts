import { authedRequest } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { type DriveFile, type DriveFolder, handleDriveError, requireCredentials } from './drive-shared.js'

interface DriveListResponse {
  object: string
  folder_uuid: string | null
  folders: DriveFolder[]
  files: DriveFile[]
}

/**
 * Render a drive listing into the CLI's human text (folders first, with a
 * trailing slash; then files with their size) and the newline-joined UUIDs used
 * by --quiet. Pure so it can be unit-tested.
 */
export function formatDriveList(response: DriveListResponse): { text: string; quietValue: string } {
  const folderLines = response.folders.map((f) => `${f.uuid}\t${f.name}/`)
  const fileLines = response.files.map((f) => `${f.uuid}\t${f.name}\t${f.file_size_bytes}`)
  const lines = [...folderLines, ...fileLines]
  const quietValue = [...response.folders, ...response.files].map((i) => i.uuid).join('\n')

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No folders or files here.',
    quietValue,
  }
}

export async function driveListCommand(folderUuid: string | undefined, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const query = folderUuid ? `?folder_uuid=${encodeURIComponent(folderUuid)}` : ''
    const response = await authedRequest<DriveListResponse>(`public_api/v1/drive/files${query}`)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...formatDriveList(response),
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'List',
      notFound: folderUuid ? `Folder '${folderUuid}' not found.` : undefined,
    })
  }
}
