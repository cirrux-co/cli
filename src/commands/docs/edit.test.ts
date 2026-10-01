import { expect, test } from 'bun:test'
import { classifyApiError } from '../../api-errors.js'
import { ApiError } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { DOCS_ERROR_RULES } from './docs-shared.js'
import { insertPlace, parseCount, parseOccurrence, parseOperations } from './edit.js'

test('parseCount takes whole numbers from the minimum, and nothing else', () => {
  expect(parseCount(undefined)).toBeUndefined()
  expect(parseCount('2')).toBe(2)
  expect(parseCount('0')).toBeNull()
  expect(parseCount('0', 0)).toBe(0)
  expect(parseCount('1.5')).toBeNull()
  expect(parseCount('two')).toBeNull()
})

test('parseOccurrence takes a number, first or last', () => {
  expect(parseOccurrence('2')).toBe(2)
  expect(parseOccurrence('Last')).toBe('last')
  expect(parseOccurrence('middle')).toBeNull()
  expect(parseOccurrence(undefined)).toBeUndefined()
})

test('insertPlace needs exactly one place, and --at is the start or end anchor', () => {
  expect(insertPlace({ after: 'section:Risks' })).toEqual({ after: 'section:Risks' })
  expect(insertPlace({ at: 'end' })).toEqual({ after: 'end' })
  expect(insertPlace({ at: 'start' })).toEqual({ before: 'start' })
  expect(insertPlace({})).toContain('exactly one')
  expect(insertPlace({ after: 'a', before: 'b' })).toContain('exactly one')
  expect(insertPlace({ at: 'middle' })).toBe('--at is start or end.')
})

test('parseOperations takes a list, or an object holding one', () => {
  const list = [{ type: 'replace', find: 'a', with: 'b' }]
  expect(parseOperations(JSON.stringify(list))).toEqual(list)
  expect(parseOperations(JSON.stringify({ operations: list }))).toEqual(list)
  expect(parseOperations('{nope')).toBe('The operations are not valid JSON.')
  expect(parseOperations('[]')).toContain('list of operations')
  expect(parseOperations('[{"find":"a"}]')).toBe('Every operation is an object with a type.')
})

function refusal(status: number, body: Record<string, unknown>) {
  return classifyApiError(new ApiError(status, JSON.stringify(body)), {
    action: 'Replace text',
    scope: 'Docs',
    rules: DOCS_ERROR_RULES,
  })
}

test('an ambiguous quote lists where it matched, so the next try can pick one', () => {
  const classified = refusal(422, {
    error: 'target_ambiguous',
    error_description: '"ship" is in the document 2 times.',
    operation: 0,
    candidates: [
      { occurrence: 1, snippet: 'We ship on Monday.' },
      { occurrence: 2, snippet: '…ship it again' },
    ],
  })

  expect(classified.code).toBe(ExitCode.USAGE_ERROR)
  expect(classified.errorType).toBe('target_ambiguous')
  expect(classified.message).toBe('Replace text failed: "ship" is in the document 2 times.')
  expect(classified.hint).toBe(
    'Quote more of the text, or pass --occurrence <n> for one of these:\n  1: We ship on Monday.\n  2: …ship it again',
  )
})

test('a conflict says to read the document again', () => {
  const classified = refusal(409, { error: 'conflict', revision: 7, error_description: 'The document is at revision 7 now.' })
  expect(classified.code).toBe(ExitCode.CONFLICT)
  expect(classified.hint).toContain('cirrux docs read')
})
