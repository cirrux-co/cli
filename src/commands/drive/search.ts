import { authedRequest } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { deferred, output, type OutputOptions } from '../../output.js'
import { SEARCH_ERROR_RULES } from '../search-shared.js'
import { DRIVE_ERROR_RULES, requireCredentials } from './drive-shared.js'

export interface DriveSearchItem {
  object: 'drive_file' | 'drive_folder'
  uuid: string
  name: string
  url: string
  path: { root: 'my_drive' | 'shared_with_me'; folders: { uuid: string; name: string }[] }
}

export interface DriveSearchResponse {
  object: string
  query: string
  has_more: boolean
  next_cursor: string | null
  data: DriveSearchItem[]
}

export interface DriveSearchOptions extends OutputOptions {
  folder?: string
  limit?: string
  cursor?: string
}

const ROOT_LABELS = { my_drive: 'My Drive', shared_with_me: 'Shared with me' } as const

/** Where an item sits, as the Drive app names it: "My Drive / Clients / Acme". */
export function drivePath(item: DriveSearchItem): string {
  return [ROOT_LABELS[item.path.root], ...item.path.folders.map((folder) => folder.name)].join(' / ')
}

/**
 * One line per item: uuid, name (a folder with a trailing slash, as `drive list` writes it), where it
 * sits, and its link in the Drive app. Pure so it can be unit-tested.
 */
export function formatDriveSearch(response: DriveSearchResponse): { text: string; quietValue: string } {
  const lines = response.data.map((item) => {
    const name = item.object === 'drive_folder' ? `${item.name}/` : item.name
    return `${item.uuid}\t${name}\t${drivePath(item)}\t${item.url}`
  })
  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return {
    text: response.data.length > 0 ? lines.join('\n') : 'No files or folders matched the query.',
    quietValue: response.data.map((item) => item.uuid).join('\n'),
  }
}

export function buildDriveSearchParams(query: string, options: DriveSearchOptions): URLSearchParams {
  const params = new URLSearchParams({ q: query })
  if (options.folder) params.set('folder_uuid', options.folder)
  if (options.limit) params.set('limit', options.limit)
  if (options.cursor) params.set('cursor', options.cursor)
  return params
}

export async function driveSearchCommand(query: string, options: DriveSearchOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<DriveSearchResponse>(
      `public_api/v1/drive/search?${buildDriveSearchParams(query, options).toString()}`,
    )

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatDriveSearch(response)),
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Search',
      scope: 'Drive',
      notFound: options.folder ? `Folder '${options.folder}' not found.` : undefined,
      rules: [...SEARCH_ERROR_RULES, ...DRIVE_ERROR_RULES],
    })
  }
}
