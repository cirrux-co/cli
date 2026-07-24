import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { authedRequest, authedRequestVoid, putToPresignedUrl } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { buildAad, buildHeader, decodeDataKey, encryptChunk, packChunk, randomIv } from './crypto.js'
import { DRIVE_MAX_BYTES, type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

interface ReplaceOptions extends OutputOptions {
  file?: string
  contentType?: string
}

interface ReplaceInit {
  file_uuid: string
  version_uuid: string
  data_key: string
  chunk_size_bytes: number
  chunk_count: number
  s3_upload_id: string
}

interface PartUrl {
  part_number: number
  url: string
}

export async function driveReplaceCommand(uuid: string, options: ReplaceOptions): Promise<void> {
  requireCredentials(options)

  if (!options.file) {
    outputError('Missing --file <path>.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Provide the replacement file with --file.',
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
    outputError('Cannot replace with an empty file.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  if (size > DRIVE_MAX_BYTES) {
    outputError('File is too large (2 GB max).', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'file_too_large',
    })
  }

  try {
    const file = await replaceFile({ uuid, path: options.file, contentType: options.contentType, size, options })
    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: `Replaced ${file.name} (${file.uuid})`,
      quietValue: file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Replace',
      notFound: `File '${uuid}' not found.`,
    })
  }
}

// Uploads a new version of an existing file: init → presign parts → encrypt+PUT
// each chunk straight to S3 → complete (which promotes it and returns the file).
// The current version stays live until `complete`, so a failure means the
// replace did not land — we abort the staged version, leaving the file intact.
async function replaceFile(args: {
  uuid: string
  path: string
  contentType: string | undefined
  size: number
  options: ReplaceOptions
}): Promise<DriveFile> {
  const { uuid, path, contentType, size, options } = args

  const body: Record<string, unknown> = { plaintext_size_bytes: size }
  if (contentType) body.content_type = contentType

  const init = await authedRequest<ReplaceInit>(`public_api/v1/drive/files/${encodeURIComponent(uuid)}/replace`, {
    method: 'POST',
    body,
  })

  try {
    const key = decodeDataKey(init.data_key)
    const { chunk_size_bytes: chunkSize, chunk_count: chunkCount, file_uuid: fileUuid } = init

    const { part_urls: partUrls } = await authedRequest<{ part_urls: PartUrl[] }>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}/replace/part_urls`,
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
        // The AAD binds the file UUID (shared across versions), not the version.
        const aad = buildAad({ fileUuid, chunkIndex: i, chunkCount, plaintextChunkSize: bytesRead })
        const encrypted = encryptChunk({ key, iv, aad, plaintext: readBuffer.subarray(0, bytesRead) })
        const chunk = packChunk(iv, encrypted)
        const chunkBody = i === 0 ? Buffer.concat([header, chunk]) : chunk

        const partNumber = i + 1
        const url = urlByPart.get(partNumber)
        if (!url) throw new Error(`Missing presigned URL for part ${partNumber}.`)

        const etag = await putToPresignedUrl(url, chunkBody)
        parts.push({ part_number: partNumber, etag })
        reportProgress(options, i + 1, chunkCount)
      }
    } finally {
      closeSync(fd)
    }

    return await authedRequest<DriveFile>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}/replace/complete`,
      { method: 'POST', body: { parts } },
    )
  } catch (error) {
    await abortQuietly(uuid)
    throw error
  }
}

async function abortQuietly(uuid: string): Promise<void> {
  try {
    await authedRequestVoid(`public_api/v1/drive/files/${encodeURIComponent(uuid)}/replace/abort`, { method: 'POST' })
  } catch {
    // Best-effort cleanup: the version cleaner cron sweeps abandoned replacements anyway.
  }
}

function reportProgress(options: ReplaceOptions, done: number, total: number): void {
  if (options.json || options.quiet || total <= 1 || !process.stderr.isTTY) return
  process.stderr.write(`\rReplacing chunk ${done}/${total}…`)
  if (done === total) process.stderr.write('\n')
}
