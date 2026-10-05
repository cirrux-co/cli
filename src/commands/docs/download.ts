import { writeFileSync } from 'node:fs'
import { authedRequest, authedRequestRaw } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import type { DocumentAttachment } from './attach.js'
import { handleDocsError, requireCredentials, resolveDocumentRef } from './docs-shared.js'

interface DownloadOptions extends OutputOptions {
  output?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The attachment uuid in what was handed over: a bare uuid, or the `attachment:<uuid>` link the
 * markdown of `docs read` carries, since that is what an agent copies. Null when neither.
 */
export function parseAttachmentRef(ref: string): string | null {
  const uuid = ref.trim().replace(/^attachment:/i, '')
  return UUID.test(uuid) ? uuid.toLowerCase() : null
}

/**
 * An attachment's file. Raw bytes to stdout by default (pipe with `> out`), to a file with --output;
 * --json and --quiet carry it base64url-encoded, as `drive download` and `attachment download` do.
 */
export async function docsDownloadCommand(ref: string, attachmentRef: string, options: DownloadOptions): Promise<void> {
  requireCredentials(options)
  const documentUuid = resolveDocumentRef(ref, options)
  const attachmentUuid = parseAttachmentRef(attachmentRef)
  if (!attachmentUuid) {
    outputError(`'${attachmentRef}' is not an attachment UUID.`, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'invalid_attachment',
      hint: "Pass the uuid of an attachment:<uuid> link from 'cirrux docs read'.",
    })
  }

  const path = `public_api/v1/documents/${documentUuid}/attachments/${attachmentUuid}`
  try {
    const { body } = await authedRequestRaw(`${path}/download`)

    if (options.json) {
      const attachment = await authedRequest<DocumentAttachment>(path)
      output({ ...attachment, data: body.toString('base64url') }, { ...options, text: () => '' })
      return
    }

    if (options.output) {
      writeFileSync(options.output, body)
      output({ uuid: attachmentUuid, path: options.output }, {
        ...options,
        text: () => `Downloaded to ${options.output}`,
        quietValue: () => options.output ?? '',
      })
      return
    }

    if (options.quiet) {
      process.stdout.write(body.toString('base64url') + '\n')
      return
    }

    process.stdout.write(body)
  } catch (error) {
    handleDocsError(error, options, { action: 'Download', notFound: 'Document or attachment not found.' })
  }
}
