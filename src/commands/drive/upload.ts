import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { authedRequest, authedRequestVoid, putToPresignedUrl } from '../../api.js'
import { handleApiError } from '../../api-errors.js'
import { ExitCode } from '../../exit-codes.js'
import { FILE_REFERENCE_ERROR_RULES } from '../../file-references.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  buildAad,
  buildHeader,
  decodeDataKey,
  encryptChunk,
  packChunk,
  randomIv,
} from './crypto.js'
import { DRIVE_ERROR_RULES, DRIVE_MAX_BYTES, type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

interface UploadOptions extends OutputOptions {
  file?: string
  /** An email attachment to save instead of a local file, copied on the server. */
  attachment?: string
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
  if (options.file && options.attachment) {
    outputError('--file and --attachment are mutually exclusive.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
    })
  }

  requireCredentials(options)

  if (options.attachment) {
    return saveAttachment(folderUuid, options.attachment, options)
  }

  if (!options.file) {
    outputError('Missing --file <path>.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Provide the file to upload with --file, or an email attachment with --attachment <uuid>.',
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
      text: () => `Uploaded ${file.name} (${file.uuid})`,
      quietValue: () => file.uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Upload',
      notFound: folderUuid ? `Folder '${folderUuid}' not found.` : undefined,
    })
  }
}

// An email attachment saved as a Drive file: the server copies it, so nothing is downloaded or
// encrypted here. Kept pure so it can be unit-tested without HTTP.
export function attachmentUploadRequest(args: {
  folderUuid: string | undefined
  attachmentUuid: string
  name: string | undefined
  contentType: string | undefined
}): { path: string; body: Record<string, string> } {
  const body: Record<string, string> = { attachment_uuid: args.attachmentUuid }
  if (args.folderUuid) body.folder_uuid = args.folderUuid
  if (args.name) body.name = args.name
  if (args.contentType) body.content_type = args.contentType
  return { path: 'public_api/v1/drive/files', body }
}

async function saveAttachment(folderUuid: string | undefined, attachmentUuid: string, options: UploadOptions) {
  const { path, body } = attachmentUploadRequest({
    folderUuid,
    attachmentUuid,
    name: options.name,
    contentType: options.contentType,
  })

  try {
    const file = await authedRequest<DriveFile>(path, { method: 'POST', body })
    output(file as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Saved ${file.name} to Drive (${file.uuid})`,
      quietValue: () => file.uuid,
    })
  } catch (error) {
    handleApiError(error, options, {
      action: 'Save attachment',
      scope: 'Drive and email',
      notFound: folderUuid ? `Folder '${folderUuid}' not found.` : undefined,
      rules: [...FILE_REFERENCE_ERROR_RULES, ...DRIVE_ERROR_RULES],
    })
  }
}

// The request the CLI sends for a 0-byte file: the simple server-side route
// with empty base64 data. Kept pure so it can be unit-tested without HTTP.
export function emptyUploadRequest(args: {
  folderUuid: string | undefined
  name: string
  contentType: string
}): { path: string; body: { folder_uuid: string | undefined; name: string; content_type: string; data: string } } {
  return {
    path: 'public_api/v1/drive/files',
    body: { folder_uuid: args.folderUuid, name: args.name, content_type: args.contentType, data: '' },
  }
}

// Runs the chunked multipart upload: init → presign parts → encrypt+PUT each
// chunk straight to S3 → complete (which returns the finished file's metadata).
// The file is read and encrypted one chunk at a time, so memory stays flat
// regardless of file size. `complete` is the final step, so any failure means
// the upload did not finish — we abort it to avoid leaving an orphaned
// 'uploading' row. Once `complete` returns we never abort, so a transient
// throttle late in the sequence can't tear down a file that already landed.
async function uploadFile(args: {
  path: string
  folderUuid: string | undefined
  name: string
  contentType: string
  size: number
  options: UploadOptions
}): Promise<DriveFile> {
  const { path, folderUuid, name, contentType, size, options } = args

  // A 0-byte file has no chunks to encrypt and PUT, and S3 multipart can't
  // complete with zero parts. The simple server-side route handles it in one
  // call and returns the finished file directly.
  if (size === 0) {
    const { path: emptyPath, body } = emptyUploadRequest({ folderUuid, name, contentType })
    return await authedRequest<DriveFile>(emptyPath, { method: 'POST', body })
  }

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

    return await authedRequest<DriveFile>(
      `public_api/v1/drive/uploads/${encodeURIComponent(init.file_uuid)}/complete`,
      { method: 'POST', body: { parts } },
    )
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
