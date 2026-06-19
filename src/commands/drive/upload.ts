import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { authedRequest, authedRequestVoid, putToPresignedUrl } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  buildAad,
  buildHeader,
  decodeDataKey,
  encryptChunk,
  packChunk,
  randomIv,
} from './crypto.js'
import { DRIVE_MAX_BYTES, type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

interface UploadOptions extends OutputOptions {
  file?: string
  name?: string
  contentType?: string
}

interface UploadInit {
  file_uuid: string
  data_key: string
  chunk_size_bytes: number
  chunk_count: number
  s3_upload_id: string
}

interface PartUrl {
  part_number: number
  url: string
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

  let size: number
  try {
    size = statSync(options.file).size
  } catch (error) {
    return outputError(`Cannot read file '${options.file}': ${error instanceof Error ? error.message : String(error)}`, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  if (size === 0) {
    outputError('File is empty.', { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
  }

  if (size > DRIVE_MAX_BYTES) {
    outputError('File is too large (2 GB max).', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'file_too_large',
    })
  }

  const name = options.name ?? basename(options.file)
  const contentType = options.contentType ?? 'application/octet-stream'

  try {
    const file = await uploadFile({ path: options.file, folderUuid, name, contentType, size, options })
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

// Runs the chunked multipart upload: init → presign parts → encrypt+PUT each
// chunk straight to S3 → complete. The file is read and encrypted one chunk at a
// time, so memory stays flat regardless of file size. On any failure the
// in-progress upload is aborted so we don't leave an orphaned 'uploading' row.
async function uploadFile(args: {
  path: string
  folderUuid: string | undefined
  name: string
  contentType: string
  size: number
  options: UploadOptions
}): Promise<DriveFile> {
  const { path, folderUuid, name, contentType, size, options } = args

  const init = await authedRequest<UploadInit>('public_api/v1/drive/uploads', {
    method: 'POST',
    body: { folder_uuid: folderUuid, name, content_type: contentType, plaintext_size_bytes: size },
  })

  try {
    const key = decodeDataKey(init.data_key)
    const { chunk_size_bytes: chunkSize, chunk_count: chunkCount, file_uuid: fileUuid } = init

    const { part_urls: partUrls } = await authedRequest<{ part_urls: PartUrl[] }>(
      `public_api/v1/drive/uploads/${encodeURIComponent(fileUuid)}/part_urls`,
      { method: 'POST', body: { part_numbers: Array.from({ length: chunkCount }, (_, i) => i + 1) } },
    )
    const urlByPart = new Map(partUrls.map((p) => [p.part_number, p.url]))

    const header = buildHeader(chunkSize)
    const readBuffer = Buffer.allocUnsafe(chunkSize)
    const parts: { part_number: number; etag: string }[] = []
    const fd = openSync(path, 'r')
    try {
      for (let i = 0; i < chunkCount; i++) {
        const bytesRead = readSync(fd, readBuffer, 0, chunkSize, i * chunkSize)
        const iv = randomIv()
        const aad = buildAad({ fileUuid, chunkIndex: i, chunkCount, plaintextChunkSize: bytesRead })
        const encrypted = encryptChunk({ key, iv, aad, plaintext: readBuffer.subarray(0, bytesRead) })
        const chunk = packChunk(iv, encrypted)
        const body = i === 0 ? Buffer.concat([header, chunk]) : chunk

        const partNumber = i + 1
        const url = urlByPart.get(partNumber)
        if (!url) throw new Error(`Missing presigned URL for part ${partNumber}.`)

        const etag = await putToPresignedUrl(url, body)
        parts.push({ part_number: partNumber, etag })
        reportProgress(options, i + 1, chunkCount)
      }
    } finally {
      closeSync(fd)
    }

    await authedRequest(`public_api/v1/drive/uploads/${encodeURIComponent(init.file_uuid)}/complete`, {
      method: 'POST',
      body: { parts },
    })

    return await authedRequest<DriveFile>(`public_api/v1/drive/files/${encodeURIComponent(init.file_uuid)}`)
  } catch (error) {
    await abortQuietly(init.file_uuid)
    throw error
  }
}

async function abortQuietly(fileUuid: string): Promise<void> {
  try {
    await authedRequestVoid(`public_api/v1/drive/uploads/${encodeURIComponent(fileUuid)}/abort`, { method: 'POST' })
  } catch {
    // Best-effort cleanup: the multipart cron sweeps abandoned uploads anyway.
  }
}

function reportProgress(options: UploadOptions, done: number, total: number): void {
  if (options.json || options.quiet || total <= 1 || !process.stderr.isTTY) return
  process.stderr.write(`\rUploading chunk ${done}/${total}…`)
  if (done === total) process.stderr.write('\n')
}
