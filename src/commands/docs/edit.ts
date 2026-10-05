import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { authedRequest } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import {
  type DocumentContent,
  formatDocumentContent,
  formatDocumentThread,
  handleDocsError,
  requireCredentials,
  resolveDocumentRef,
} from './docs-shared.js'

/** One edit operation, as POST /v1/documents/:uuid/content takes it. */
export type DocumentEditOperation = Record<string, unknown> & { type: string }

interface EditOptions extends OutputOptions {
  baseRevision?: string
  occurrence?: string
  /** Suggest the changes instead of making them: each operation becomes a suggestion of its own. */
  suggest?: boolean
  /** Why, for a suggestion: the first message on it. */
  comment?: string
}

/** What POST /v1/documents/:uuid/suggestions answers: the document after it, and the new suggestions' uuids. */
export interface SuggestedContent extends DocumentContent {
  suggestions: string[]
}

interface TextEditOptions extends EditOptions {
  before?: string
  after?: string
}

interface InsertOptions extends EditOptions {
  after?: string
  before?: string
  at?: string
  file?: string
}

/** A whole number from 1 (`minimum` 0 for a revision), or null. */
export function parseCount(value: string | undefined, minimum = 1): number | null | undefined {
  if (value === undefined) return undefined
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return parsed >= minimum ? parsed : null
}

/** --occurrence: a number from 1, `first` or `last`. Null when it is none of those. */
export function parseOccurrence(value: string | undefined): number | 'first' | 'last' | null | undefined {
  if (value === undefined) return undefined
  const word = value.trim().toLowerCase()
  if (word === 'first' || word === 'last') return word
  return parseCount(value)
}

/**
 * Where an insert goes: exactly one of --after, --before and --at. --at is shorthand for the API's
 * `before: "start"` and `after: "end"`. Returns the fields, or why not.
 */
export function insertPlace(options: { after?: string; before?: string; at?: string }): Record<string, string> | string {
  const given = (['after', 'before', 'at'] as const).filter((key) => options[key] !== undefined)
  if (given.length !== 1) return 'Say where to insert with exactly one of --after, --before or --at.'

  if (given[0] === 'at') {
    if (options.at === 'start') return { before: 'start' }
    if (options.at === 'end') return { after: 'end' }
    return '--at is start or end.'
  }
  return { [given[0]]: options[given[0]] as string }
}

/** The operations of `cirrux docs edit`: a JSON list, or an object holding one under `operations`. */
export function parseOperations(json: string): DocumentEditOperation[] | string {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return 'The operations are not valid JSON.'
  }

  const list = Array.isArray(parsed) ? parsed : (parsed as { operations?: unknown } | null)?.operations
  if (!Array.isArray(list) || list.length === 0) return 'Pass a JSON list of operations, or {"operations": [...]}.'

  const invalid = list.findIndex((item) => typeof item !== 'object' || item === null || typeof item.type !== 'string')
  if (invalid !== -1) return untypedOperationMessage(list[invalid], invalid + 1)
  return list as DocumentEditOperation[]
}

const OPERATION_TYPES = ['replace', 'insert', 'delete', 'set_document']

/** Why an operation has no type, naming the flat shape, and the fix when it was written keyed by its type. */
function untypedOperationMessage(item: unknown, position: number): string {
  const keys = typeof item === 'object' && item !== null && !Array.isArray(item) ? Object.keys(item) : []
  if (keys.length === 1 && OPERATION_TYPES.includes(keys[0])) {
    return `Operation ${position} is keyed by its type: write {"type": "${keys[0]}", ...} with the fields beside the type, not {"${keys[0]}": {...}}.`
  }
  return `Operation ${position} has no type: each is an object like {"type": "replace", "find": "...", "with": "..."}, with type one of ${OPERATION_TYPES.join(', ')}.`
}

function usage(message: string, options: OutputOptions, hint?: string): never {
  outputError(message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error', ...(hint ? { hint } : {}) })
}

function count(value: string | undefined, name: string, options: OutputOptions, minimum = 1): number | undefined {
  const parsed = parseCount(value, minimum)
  if (parsed === null) usage(`${name} must be a whole number${minimum > 0 ? ' from 1' : ''}.`, options)
  return parsed
}

/** Markdown from the argument, then --file, then stdin. */
async function readMarkdown(argument: string | undefined, file: string | undefined, options: OutputOptions): Promise<string> {
  if (argument !== undefined) return argument
  if (file) return readFileSync(file, 'utf-8')
  if (process.stdin.isTTY) usage('No markdown given.', options, 'Pass it as an argument, with --file, or on stdin.')

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

/** The document after a suggestion, and each suggestion it made, as `docs read --comments` lists them. */
export function formatSuggestedContent(content: SuggestedContent): string {
  const made = content.suggestions.flatMap((uuid) => content.threads.filter((thread) => thread.uuid === uuid))
  const header = `--- ${made.length} new ${made.length === 1 ? 'suggestion' : 'suggestions'} ---`
  return [formatDocumentContent(content), header, ...made.map(formatDocumentThread)].join('\n\n')
}

/** POST the operations as one edit, or as suggestions, under a fresh batch id. */
export async function postEdit(
  uuid: string,
  operations: DocumentEditOperation[],
  options: { baseRevision?: number; suggest?: boolean } = {},
): Promise<DocumentContent | SuggestedContent> {
  return authedRequest<DocumentContent | SuggestedContent>(
    `public_api/v1/documents/${uuid}/${options.suggest ? 'suggestions' : 'content'}`,
    {
      method: 'POST',
      body: {
        operations,
        batch_id: randomUUID(),
        ...(options.baseRevision !== undefined ? { base_revision: options.baseRevision } : {}),
      },
    },
  )
}

/**
 * Send the operations as one edit, or as suggestions with --suggest, and print the document after it.
 * The batch id makes a retried request the same edit, so the HTTP layer's retries can never apply it
 * twice.
 */
async function submitEdit(
  ref: string,
  operations: DocumentEditOperation[],
  options: EditOptions,
  action: string,
): Promise<void> {
  requireCredentials(options)
  const uuid = resolveDocumentRef(ref, options)
  const baseRevision = count(options.baseRevision, '--base-revision', options, 0)

  try {
    const content = await postEdit(uuid, operations, { baseRevision, suggest: options.suggest })

    output(content as unknown as Record<string, unknown>, {
      ...options,
      text: () => ('suggestions' in content ? formatSuggestedContent(content) : formatDocumentContent(content)),
      quietValue: () => String(content.revision),
    })
  } catch (error) {
    handleDocsError(error, options, { action: options.suggest ? `${action} (suggest)` : action, notFound: 'Document not found.' })
  }
}

/** --comment says why a suggestion is made, so it goes with --suggest. */
function withComment(operation: DocumentEditOperation, options: EditOptions): DocumentEditOperation {
  if (options.comment === undefined) return operation
  if (!options.suggest) usage('--comment goes with --suggest.', options, "Comment without suggesting with 'cirrux docs comments add'.")
  if (options.comment.trim() === '') usage('The comment is empty.', options)
  return { ...operation, comment: options.comment }
}

export function withOccurrence(operation: DocumentEditOperation, options: EditOptions): DocumentEditOperation {
  const occurrence = parseOccurrence(options.occurrence)
  if (occurrence === null) usage('--occurrence is a number from 1, first or last.', options)
  return occurrence === undefined ? operation : { ...operation, occurrence }
}

/** --before and --after narrow a quote to the place with that text right before or after it. */
function withContext(operation: DocumentEditOperation, options: TextEditOptions): DocumentEditOperation {
  return {
    ...withOccurrence(operation, options),
    ...(options.before !== undefined ? { before: options.before } : {}),
    ...(options.after !== undefined ? { after: options.after } : {}),
  }
}

export async function docsReplaceCommand(ref: string, find: string, replacement: string, options: TextEditOptions) {
  const operation = withComment(withContext({ type: 'replace', find, with: replacement }, options), options)
  await submitEdit(ref, [operation], options, 'Replace text')
}

export async function docsDeleteTextCommand(ref: string, find: string, options: TextEditOptions) {
  await submitEdit(ref, [withComment(withContext({ type: 'delete', find }, options), options)], options, 'Delete text')
}

export async function docsInsertCommand(ref: string, markdown: string | undefined, options: InsertOptions) {
  const place = insertPlace(options)
  if (typeof place === 'string') usage(place, options)

  const operation = withOccurrence({ type: 'insert', markdown: await readMarkdown(markdown, options.file, options), ...place }, options)
  await submitEdit(ref, [withComment(operation, options)], options, 'Insert')
}

export async function docsWriteCommand(ref: string, options: EditOptions & { file?: string }) {
  const markdown = await readMarkdown(undefined, options.file, options)
  await submitEdit(ref, [{ type: 'set_document', markdown }], options, 'Write document')
}

export async function docsEditCommand(ref: string, options: EditOptions & { operations?: string }) {
  if (!options.operations) usage('--operations is required.', options, 'Pass a JSON file, or - to read it from stdin.')

  const json = options.operations === '-' ? await readMarkdown(undefined, undefined, options) : readFileSync(options.operations, 'utf-8')
  const operations = parseOperations(json)
  if (typeof operations === 'string') usage(operations, options)

  await submitEdit(ref, operations, options, 'Edit document')
}
