import { expect, test } from 'bun:test'
import { classifyApiError } from '../../api-errors.js'
import { ApiError } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import {
  type CirruxDocument,
  type DocumentContentThread,
  DOCS_ERROR_RULES,
  formatDocument,
  formatDocumentContent,
  formatDocumentLine,
  formatDocumentList,
  parseDocumentRef,
} from './docs-shared.js'

const UUID = '0b6f0d3e-8c1a-4f6e-9a4b-2d1e5c7a9f10'

function doc(overrides: Partial<CirruxDocument> = {}): CirruxDocument {
  return {
    object: 'document',
    uuid: UUID,
    workspace_uuid: 'w-1',
    title: 'Roadmap',
    url: `https://docs.cirrux.co/d/${UUID}`,
    trashed_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    my_role: 'owner',
    shared: false,
    owner: { self: true, first_name: 'Ada', last_name: 'Lovelace', display_name: 'Ada Lovelace' },
    ...overrides,
  }
}

test('parseDocumentRef accepts a bare uuid, in any case', () => {
  expect(parseDocumentRef(UUID)).toBe(UUID)
  expect(parseDocumentRef(`  ${UUID.toUpperCase()} `)).toBe(UUID)
})

test('parseDocumentRef takes the uuid out of a Cirrux Docs link', () => {
  expect(parseDocumentRef(`https://docs.cirrux.co/d/${UUID}`)).toBe(UUID)
  expect(parseDocumentRef(`https://docs.cirrux.co/d/${UUID}/?comment=1#heading`)).toBe(UUID)
  expect(parseDocumentRef(`http://localhost:5182/d/${UUID}`)).toBe(UUID)
})

test('parseDocumentRef refuses anything else', () => {
  expect(parseDocumentRef('roadmap')).toBeNull()
  expect(parseDocumentRef('https://docs.cirrux.co/')).toBeNull()
  expect(parseDocumentRef('https://docs.cirrux.co/d/not-a-uuid')).toBeNull()
  expect(parseDocumentRef(`https://docs.cirrux.co/d/${UUID}/comments`)).toBeNull()
})

test('formatDocumentLine names the owner only when it is someone else', () => {
  expect(formatDocumentLine(doc())).toBe(`${UUID}\tRoadmap\towner`)
  expect(
    formatDocumentLine(
      doc({
        my_role: 'editor',
        owner: { self: false, first_name: 'Grace', last_name: 'Hopper', display_name: null },
      }),
    ),
  ).toBe(`${UUID}\tRoadmap\teditor\towned by Grace Hopper`)
})

test('an untitled document is shown with the placeholder the Docs app uses', () => {
  expect(formatDocumentLine(doc({ title: null }))).toBe(`${UUID}\tUntitled document\towner`)
})

test('formatDocumentList keeps the cursor footer out of --quiet', () => {
  const { text, quietValue } = formatDocumentList({
    object: 'list',
    url: '/v1/documents',
    has_more: true,
    next_cursor: 'abc',
    data: [doc()],
  })

  expect(text).toContain('cursor: abc')
  expect(quietValue).toBe(UUID)
})

test('formatDocumentList says so when there is nothing', () => {
  const empty = { object: 'list', url: '/v1/documents/trash', has_more: false, data: [] }

  expect(formatDocumentList(empty, 'Trash is empty.').text).toBe('Trash is empty.')
})

test('formatDocument shows the link, and the trash date only when trashed', () => {
  expect(formatDocument(doc())).toContain(`Link:     https://docs.cirrux.co/d/${UUID}`)
  expect(formatDocument(doc())).not.toContain('Trashed')
  expect(formatDocument(doc({ trashed_at: '2026-09-20T08:00:00.000Z' }))).toContain(
    'Trashed:  2026-09-20T08:00:00.000Z',
  )
})

// The API names the role a refused write needed, which the generic 403 line would throw away.
test('a refused rename or trash keeps the reason the API gave', () => {
  const error = new ApiError(
    403,
    JSON.stringify({ error: 'forbidden', error_description: 'Renaming this document needs the editor role.' }),
  )

  const result = classifyApiError(error, { action: 'Rename document', rules: DOCS_ERROR_RULES })

  expect(result.code).toBe(ExitCode.AUTH_REQUIRED)
  expect(result.errorType).toBe('forbidden')
  expect(result.message).toBe('Rename document failed: Renaming this document needs the editor role.')
})

const SAM = { self: false, first_name: 'Sam', last_name: 'Jansen', display_name: 'Sam Jansen' }
const ME = { self: true, first_name: 'Ada', last_name: 'Lovelace', display_name: 'Ada Lovelace' }

function thread(overrides: Partial<DocumentContentThread>): DocumentContentThread {
  return {
    uuid: 't-1',
    kind: 'comment',
    ref: null,
    status: 'open',
    placement: 'attached',
    quote: null,
    suggested_text: null,
    suggested_format: null,
    author: SAM,
    created_at: '2026-09-01T10:00:00.000Z',
    messages: [],
    ...overrides,
  }
}

const markdown = 'We ship on {~~Monday~>Friday~~}{>>s1<<}.\n'

test('formatDocumentContent prints the markdown alone unless comments are asked for', () => {
  const content = { object: 'document_content', uuid: UUID, revision: 4, markdown, threads: [thread({})] }
  expect(formatDocumentContent(content)).toBe('We ship on {~~Monday~>Friday~~}{>>s1<<}.')
})

test('formatDocumentContent lists each open thread under the document, with its messages', () => {
  const message = (body: string, author = SAM) => ({
    uuid: 'm',
    author,
    body,
    created_at: '2026-09-01T10:00:00.000Z',
    edited_at: null,
  })
  const threads = [
    thread({
      uuid: 't-1',
      kind: 'suggestion',
      ref: 's1',
      quote: 'Monday',
      suggested_text: 'Friday',
      messages: [message('Monday is a holiday\n'), message('Agreed.\n\nMoving it.\n', ME)],
    }),
    thread({ uuid: 't-2', quote: 'ship', messages: [message('Who ships?\n')] }),
    thread({ uuid: 't-3', placement: 'document', author: ME }),
    thread({ uuid: 't-4', placement: 'detached', quote: 'gone' }),
    thread({ uuid: 't-5', kind: 'suggestion', ref: 's2', suggested_format: [{ type: 'bold' }] }),
  ]

  expect(formatDocumentContent({ object: 'document_content', uuid: UUID, revision: 4, markdown, threads }, { comments: true }))
    .toBe(
      [
        'We ship on {~~Monday~>Friday~~}{>>s1<<}.',
        '--- 5 open threads ---',
        '[s1] Suggestion by Sam Jansen: replaces "Monday" with "Friday" (t-1)\n' +
          '  Sam Jansen: Monday is a holiday\n' +
          '  You: Agreed.\n' +
          '\n' +
          '    Moving it.',
        'Comment by Sam Jansen on "ship" (t-2)\n  Sam Jansen: Who ships?',
        'Comment by you on the whole document (t-3)',
        'Comment by Sam Jansen on "gone", whose text was deleted (t-4)',
        '[s2] Suggestion by Sam Jansen: changes the formatting (t-5)',
      ].join('\n\n'),
    )
})

test('formatDocumentContent says so when nothing is open', () => {
  const content = { object: 'document_content', uuid: UUID, revision: 1, markdown: '# Plan\n', threads: [] }
  expect(formatDocumentContent(content, { comments: true })).toBe('# Plan\n\n--- No open comments or suggestions ---')
})
