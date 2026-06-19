import { closeSync, openSync, writeSync } from 'node:fs'
import { authedRequest, getRangeFromPresignedUrl } from '../../api.js'
import { output, type OutputOptions } from '../../output.js'
import { CHUNK_OVERHEAD, buildAad, cipherEnd, cipherOffset, decodeDataKey, decryptChunk, unpackChunk } from './crypto.js'
import { type DriveFile, handleDriveError, requireCredentials } from './drive-shared.js'

interface DownloadInit {
  file_uuid: string
  data_key: string
  chunk_size_bytes: number
  chunk_count: number
  ciphertext_size_bytes: number
  plaintext_size_bytes: number
  download_url: string
}

interface DownloadOptions extends OutputOptions {
  output?: string
}

export async function driveDownloadCommand(uuid: string, options: DownloadOptions): Promise<void> {
  requireCredentials(options)

  try {
    const init = await authedRequest<DownloadInit>(
      `public_api/v1/drive/files/${encodeURIComponent(uuid)}/download_init`,
    )

    // For --json/--quiet we must produce the whole base64 payload, so we buffer.
    // For a file or stdout we stream chunk-by-chunk and never hold the whole file.
    const buffering = Boolean(options.json || options.quiet)
    const collected: Buffer[] = []
    const fd = !buffering && options.output ? openSync(options.output, 'w') : null

    try {
      await eachDecryptedChunk(init, async (plaintext) => {
        if (buffering) {
          collected.push(plaintext)
        } else if (fd !== null) {
          writeSync(fd, plaintext)
        } else {
          await writeStdout(plaintext)
        }
      })
    } finally {
      if (fd !== null) closeSync(fd)
    }

    if (buffering) {
      const data = Buffer.concat(collected)
      if (options.json) {
        const meta = await authedRequest<DriveFile>(`public_api/v1/drive/files/${encodeURIComponent(uuid)}`)
        output(
          {
            uuid: init.file_uuid,
            name: meta.name,
            content_type: meta.content_type,
            size: data.byteLength,
            data: data.toString('base64url'),
          },
          { ...options, text: '' },
        )
      } else {
        process.stdout.write(data.toString('base64url') + '\n')
      }
      return
    }

    if (options.output) {
      output({ uuid: init.file_uuid, path: options.output }, {
        ...options,
        text: `Downloaded to ${options.output}`,
        quietValue: options.output,
      })
    }
  } catch (error) {
    handleDriveError(error, options, { action: 'Download', notFound: `File '${uuid}' not found.` })
  }
}

// Fetch each ciphertext chunk by byte-range straight from S3, decrypt it with the
// AAD rebuilt from the trusted server metadata, and hand the plaintext to `sink`.
async function eachDecryptedChunk(
  init: DownloadInit,
  sink: (plaintext: Buffer) => Promise<void> | void,
): Promise<void> {
  const key = decodeDataKey(init.data_key)
  const { chunk_size_bytes: chunkSize, chunk_count: chunkCount, ciphertext_size_bytes: ciphertextSize } = init

  for (let i = 0; i < chunkCount; i++) {
    const start = cipherOffset(i, chunkSize)
    const end = cipherEnd(i, chunkSize, ciphertextSize, chunkCount)
    const range = await getRangeFromPresignedUrl(init.download_url, start, end)
    const { iv, ciphertextWithTag } = unpackChunk(range)
    const aad = buildAad({
      fileUuid: init.file_uuid,
      chunkIndex: i,
      chunkCount,
      plaintextChunkSize: range.byteLength - CHUNK_OVERHEAD,
    })
    await sink(decryptChunk({ key, iv, aad, ciphertextWithTag }))
  }
}

// Write to stdout honouring backpressure so large streams don't balloon memory.
function writeStdout(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(buffer, (error) => (error ? reject(error) : resolve()))
  })
}
