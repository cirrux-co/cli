import { authedRequest } from '../../../api.js'
import { ExitCode } from '../../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../../output.js'
import { type DriveFolder, handleDriveError, requireCredentials } from '../drive-shared.js'

interface CreateFolderOptions extends OutputOptions {
  name?: string
  parent?: string
  color?: string
}

export async function driveFolderCreateCommand(options: CreateFolderOptions): Promise<void> {
  requireCredentials(options)

  if (!options.name) {
    outputError('Missing --name <name>.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Provide the folder name with --name.',
      errorType: 'usage_error',
    })
  }

  try {
    const folder = await authedRequest<DriveFolder>('public_api/v1/drive/folders', {
      method: 'POST',
      body: { name: options.name, parent_uuid: options.parent, color: options.color },
    })

    output(folder as unknown as Record<string, unknown>, {
      ...options,
      text: `Created folder ${folder.name} (${folder.uuid})`,
      quietValue: folder.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Create folder',
      notFound: options.parent ? `Parent folder '${options.parent}' not found.` : undefined,
    })
  }
}
