import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { authedRequest } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  DRIVE_SIMPLE_ROUTE_MAX_BYTES,
  type DriveFile,
  handleDriveError,
  requireCredentials,
} from './drive-shared.js'

interface UploadOptions extends OutputOptions {
  file?: string
  name?: string
  contentType?: string
}

export async function driveUploadCommand(
  folderUuid: string | undefined,
  options: UploadOptions,
): Promise<void> {
  requireCredentials(options)

  if (!options.file) {
    outputError('Missing --file <path>.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Provide the file to upload with --file.',
      errorType: 'usage_error',
    })
  }

  let buffer: Buffer
  try {
    buffer = readFileSync(options.file)
  } catch (error) {
    return outputError(`Cannot read file '${options.file}': ${error instanceof Error ? error.message : String(error)}`, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  if (buffer.length === 0) {
    outputError('File is empty.', { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  if (buffer.length > DRIVE_SIMPLE_ROUTE_MAX_BYTES) {
    outputError('File is too large (100 MB max for the CLI). Use the web app for larger files.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'file_too_large',
    })
  }

  const name = options.name ?? basename(options.file)
  const contentType = options.contentType ?? 'application/octet-stream'

  try {
    const file = await authedRequest<DriveFile>('public_api/v1/drive/files', {
      method: 'POST',
      body: {
        folder_uuid: folderUuid,
        name,
        content_type: contentType,
        data: buffer.toString('base64'),
      },
    })

    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: `Uploaded ${file.name} (${file.uuid})`,
      quietValue: file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Upload',
      notFound: folderUuid ? `Folder '${folderUuid}' not found.` : undefined,
    })
  }
}
