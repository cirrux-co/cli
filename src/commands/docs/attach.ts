import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { classifyApiError } from '../../api-errors.js'
import { authedRequest } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  type DocumentContent,
  DOCS_ERROR_RULES,
  formatDocumentContent,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'
import { insertPlace, parseCount, postEdit, withOccurrence } from './edit.js'

/** What POST /v1/documents/:uuid/attachments answers. */
export interface DocumentAttachment {
  object: 'document_attachment'
  uuid: string
  document_uuid: string
  filename: string
  content_type: string
  byte_size: number
  width: number | null
  height: number | null
  /** An image the document shows in place; anything else is a file to download. */
  inline: boolean
  /** What places it in the document, alone on its own line. */
  markdown: string
  created_at: string
}

interface AttachOptions extends OutputOptions {
  name?: string
  after?: string
  before?: string
  at?: string
  occurrence?: string
  baseRevision?: string
}

function usage(message: string, options: OutputOptions, hint?: string): never {
  outputError(message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', ...(hint ? { hint } : {}) })
}

/** Where to place the attachment: nowhere when no place is given, or where `insert` would put it. */
export function attachmentPlace(options: { after?: string; before?: string; at?: string }): Record<string, string> | string | null {
  if (options.after === undefined && options.before === undefined && options.at === undefined) return null
  return insertPlace(options)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatAttachment(attachment: DocumentAttachment): string {
  const dimensions = attachment.width && attachment.height ? `, ${attachment.width}x${attachment.height}` : ''
  return `Attached ${attachment.filename} (${attachment.content_type}, ${formatSize(attachment.byte_size)}${dimensions}) as ${attachment.uuid}`
}

/**
 * Upload a file to a document and, given a place, insert it there as one edit. Without a place the
 * attachment is only uploaded, and its markdown is printed for a larger edit to place.
 */
export async function docsAttachCommand(ref: string, file: string, options: AttachOptions): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)

  const place = attachmentPlace(options)
  if (typeof place === 'string') usage(place, options)
  if (options.occurrence !== undefined && !place) usage('--occurrence goes with --after or --before.', options)
  const baseRevision = parseCount(options.baseRevision, 0)
  if (baseRevision === null) usage('--base-revision must be a whole number.', options)
  if (baseRevision !== undefined && !place) usage('--base-revision goes with --after, --before or --at.', options)

  let bytes: Buffer
  try {
    bytes = readFileSync(file)
  } catch (error) {
    usage(`Cannot read file '${file}': ${error instanceof Error ? error.message : String(error)}`, options)
  }
  if (bytes.length === 0) usage(`'${file}' is empty.`, options)

  const filename = options.name ?? basename(file)
  let attachment: DocumentAttachment
  try {
    attachment = await authedRequest<DocumentAttachment>(
      `public_api/v1/documents/${uuid}/attachments?${new URLSearchParams({ filename })}`,
      { method: 'POST', bytes },
    )
  } catch (error) {
    handleDocsError(error, options, { action: 'Attach', notFound: 'Document not found.' })
  }

  if (!place) {
    output(attachment as unknown as Record<string, unknown>, {
      ...options,
      text: () => `${formatAttachment(attachment)}\nPlace it with an edit, alone on its own line:\n  ${attachment.markdown}`,
      quietValue: () => attachment.uuid,
    })
    return
  }

  let content: DocumentContent
  try {
    content = await postEdit(uuid, [withOccurrence({ type: 'insert', markdown: attachment.markdown, ...place }, options)], {
      baseRevision,
    })
  } catch (error) {
    // The upload stands, so say how to place it rather than to start over.
    const failure = classifyApiError(error, { action: 'Place the attachment', notFound: 'Document not found.', scope: 'Docs', rules: DOCS_ERROR_RULES })
    const placeHint = `The file is uploaded as ${attachment.uuid}: insert ${attachment.markdown} to place it.`
    outputError(failure.message, {
      ...options,
      code: failure.code,
      errorType: failure.errorType,
      hint: failure.hint ? `${failure.hint}\n${placeHint}` : placeHint,
    })
  }

  output({ ...content, attachment } as unknown as Record<string, unknown>, {
    ...options,
    text: () => `${formatAttachment(attachment)}\n\n${formatDocumentContent(content)}`,
    quietValue: () => attachment.uuid,
  })
}
