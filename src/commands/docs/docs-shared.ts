import { handleApiError, type ApiErrorRule } from '../../api-errors.js'
import type { ApiError } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { outputError, type OutputOptions } from '../../output.js'

export type DocumentRole = 'viewer' | 'commenter' | 'editor' | 'manager' | 'owner'

export interface DocumentOwner {
  self: boolean
  first_name: string | null
  last_name: string | null
  display_name: string | null
}

export interface CirruxDocument {
  object: string
  uuid: string
  workspace_uuid: string
  title: string | null
  url: string
  trashed_at: string | null
  created_at: string
  updated_at: string
  my_role: DocumentRole
  shared: boolean
  owner: DocumentOwner
}

export interface DocumentContentMessage {
  uuid: string
  author: DocumentOwner | null
  /** The message as markdown. */
  body: string
  created_at: string
  edited_at: string | null
}

export interface DocumentContentThread {
  uuid: string
  kind: 'comment' | 'suggestion'
  /** How the markdown refers to a suggestion, `s1` for `{>>s1<<}`. Null for a comment. */
  ref: string | null
  status: string
  placement: 'attached' | 'document' | 'detached'
  quote: string | null
  suggested_text: string | null
  suggested_format: { type: string }[] | null
  author: DocumentOwner | null
  created_at: string
  messages: DocumentContentMessage[]
}

export interface DocumentContent {
  object: string
  uuid: string
  revision: number
  markdown: string
  threads: DocumentContentThread[]
}

export interface DocumentListResponse {
  object: string
  url: string
  has_more: boolean
  next_cursor?: string
  data: CirruxDocument[]
}

export { requireCredentials } from '../../session.js'

interface EditCandidate {
  occurrence: number
  snippet: string
}

/** Each place an ambiguous quote matched, so the next attempt can pick one with --occurrence. */
export function candidatesHint(error: ApiError): string | undefined {
  let candidates: EditCandidate[] = []
  try {
    candidates = (JSON.parse(error.body) as { candidates?: EditCandidate[] }).candidates ?? []
  } catch {
    return undefined
  }
  if (candidates.length === 0) return undefined

  const lines = candidates.map((candidate) => `  ${candidate.occurrence}: ${candidate.snippet}`)
  return ['Quote more of the text, or pass --occurrence <n> for one of these:', ...lines].join('\n')
}

// The API explains which role a refused rename, trash or edit needed, which says more than the
// ladder's generic "no permission" line, so its description is kept. A refused edit says what to do
// next: read the document again, or say which match was meant.
export const DOCS_ERROR_RULES: ApiErrorRule[] = [
  {
    status: 403,
    errorCode: 'forbidden',
    exitCode: ExitCode.AUTH_REQUIRED,
  },
  {
    status: 422,
    errorCode: 'target_ambiguous',
    exitCode: ExitCode.USAGE_ERROR,
    hint: candidatesHint,
  },
  {
    status: 422,
    errorCode: 'target_not_found',
    exitCode: ExitCode.USAGE_ERROR,
    hint: "Quote the text exactly as 'cirrux docs read' prints it.",
  },
  {
    status: 422,
    errorCode: 'target_spans_blocks',
    exitCode: ExitCode.USAGE_ERROR,
    hint: "Change several paragraphs with 'cirrux docs delete-text' and 'cirrux docs insert'.",
  },
  {
    status: 409,
    errorCode: 'conflict',
    exitCode: ExitCode.CONFLICT,
    hint: "Read it again with 'cirrux docs read' and make the edit against what it says now.",
  },
]

/**
 * Map a failed docs API call to a clear message + exit code. Binds the scope
 * wording and the docs rules; the ladder itself lives in `api-errors.ts`.
 */
export function handleDocsError(
  error: unknown,
  options: OutputOptions,
  context: { action: string; notFound?: string },
): never {
  handleApiError(error, options, { ...context, scope: 'Docs', rules: DOCS_ERROR_RULES })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The document uuid in whatever the user handed over: a bare uuid, or a link to
 * the document (`https://docs.cirrux.co/d/<uuid>`), since a link is what people
 * paste to an agent. Any host is accepted so a local dev link works too. Null
 * when neither.
 */
export function parseDocumentRef(ref: string): string | null {
  const trimmed = ref.trim()
  if (UUID.test(trimmed)) return trimmed.toLowerCase()

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const match = url.pathname.match(/^\/d\/([^/]+)\/?$/)
  return match && UUID.test(match[1]) ? match[1].toLowerCase() : null
}

/** `parseDocumentRef`, or a usage error naming what was expected. */
export function resolveDocumentRef(ref: string, options: OutputOptions): string {
  const uuid = parseDocumentRef(ref)
  if (uuid) return uuid

  outputError(`'${ref}' is not a document UUID or a Cirrux Docs link.`, {
    ...options,
    code: ExitCode.USAGE_ERROR,
    errorType: 'invalid_document',
    hint: "Pass a UUID from 'cirrux docs list', or a link like https://docs.cirrux.co/d/<uuid>.",
  })
}

/** An untitled document has a null title; the Docs app shows a placeholder, and so do we. */
export function documentTitle(document: CirruxDocument): string {
  return document.title ?? 'Untitled document'
}

export function ownerName(owner: DocumentOwner): string {
  if (owner.self) return 'you'

  const name = [owner.first_name, owner.last_name].filter(Boolean).join(' ')
  return owner.display_name || name || 'someone else'
}

/** One document per line: uuid, title, your role, and whose it is when it is not yours. */
export function formatDocumentLine(document: CirruxDocument): string {
  const columns = [document.uuid, documentTitle(document), document.my_role]
  if (!document.owner.self) columns.push(`owned by ${ownerName(document.owner)}`)

  return columns.join('\t')
}

/**
 * Render a page of documents into the CLI's human text and the newline-joined
 * uuids used by --quiet.
 */
export function formatDocumentList(
  response: DocumentListResponse,
  emptyMessage = 'No documents found.',
): { text: string; quietValue: string } {
  const lines = response.data.map(formatDocumentLine)
  // The footer is human text only: in --quiet it would be fed to whatever the
  // caller piped the uuids into.
  if (response.has_more && response.next_cursor) {
    lines.push(`\n--- More results available (cursor: ${response.next_cursor}) ---`)
  }

  return {
    text: response.data.length > 0 ? lines.join('\n') : emptyMessage,
    quietValue: response.data.map((document) => document.uuid).join('\n'),
  }
}

/** The multi-line detail view for a single document. */
export function formatDocument(document: CirruxDocument): string {
  const lines = [
    `${documentTitle(document)}  (${document.uuid})`,
    `Link:     ${document.url}`,
    `Owner:    ${ownerName(document.owner)}`,
    `Role:     ${document.my_role}`,
    `Shared:   ${document.shared ? 'yes' : 'no'}`,
    `Created:  ${document.created_at}`,
  ]
  if (document.trashed_at) lines.push(`Trashed:  ${document.trashed_at}`)

  return lines.join('\n')
}

function personName(person: DocumentOwner | null): string {
  return person ? ownerName(person) : 'someone'
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** What a suggestion changes, from the text it takes out and the text it adds. */
function suggestionSummary(thread: DocumentContentThread): string {
  const { quote, suggested_text: added } = thread
  if (quote && added) return `replaces "${quote}" with "${added}"`
  if (added) return `adds "${added}"`
  if (quote) return `removes "${quote}"`
  return 'changes the formatting'
}

function threadHeading(thread: DocumentContentThread): string {
  const author = personName(thread.author)
  if (thread.kind === 'suggestion') {
    return `[${thread.ref ?? '?'}] Suggestion by ${author}: ${suggestionSummary(thread)}`
  }
  if (thread.placement === 'document') return `Comment by ${author} on the whole document`
  if (thread.placement === 'detached') return `Comment by ${author} on "${thread.quote ?? ''}", whose text was deleted`
  return `Comment by ${author} on "${thread.quote ?? ''}"`
}

/** One message, its markdown indented under its author. */
function formatMessage(message: DocumentContentMessage): string {
  const [first = '', ...rest] = message.body.trimEnd().split('\n')
  const lines = [`  ${capitalized(personName(message.author))}: ${first}`, ...rest.map((line) => (line ? `    ${line}` : ''))]
  return lines.join('\n')
}

/** One thread: what it is on, its uuid, whether it is closed, and its messages. */
export function formatDocumentThread(thread: DocumentContentThread): string {
  const closed = thread.status === 'open' ? '' : `, ${thread.status}`
  return [`${threadHeading(thread)} (${thread.uuid}${closed})`, ...thread.messages.map(formatMessage)].join('\n')
}

/** The open threads, after the document, for `cirrux docs read --comments`. */
export function formatDocumentThreads(threads: DocumentContentThread[]): string {
  if (threads.length === 0) return '--- No open comments or suggestions ---'

  const header = `--- ${threads.length} open ${threads.length === 1 ? 'thread' : 'threads'} ---`
  return [header, ...threads.map(formatDocumentThread)].join('\n\n')
}

/** The document as markdown, and its open threads after it when asked for. */
export function formatDocumentContent(content: DocumentContent, options: { comments?: boolean } = {}): string {
  const markdown = content.markdown.trimEnd()
  if (!options.comments) return markdown

  return [markdown, formatDocumentThreads(content.threads)].filter(Boolean).join('\n\n')
}
