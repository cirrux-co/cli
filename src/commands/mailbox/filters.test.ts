import { expect, test } from 'bun:test'
import { buildFilterBody, FilterInputError, filtersPath } from './filters.js'

test('filtersPath builds the collection path', () => {
  expect(filtersPath('mbx-1')).toBe('public_api/v1/mailboxes/mbx-1/filters')
})

test('filtersPath builds the member path', () => {
  expect(filtersPath('mbx-1', 'flt-2')).toBe('public_api/v1/mailboxes/mbx-1/filters/flt-2')
})

test('filtersPath encodes path segments', () => {
  expect(filtersPath('a/b', 'c d')).toBe('public_api/v1/mailboxes/a%2Fb/filters/c%20d')
})

test('buildFilterBody (create) assembles required fields and defaults actions', () => {
  const body = buildFilterBody(
    { name: 'Invoices', conditionAst: '{"type":"all"}' },
    { mode: 'create' },
  )
  expect(body).toEqual({
    name: 'Invoices',
    condition_ast: { type: 'all' },
    actions: [],
  })
})

test('buildFilterBody (create) parses actions and scalar fields', () => {
  const body = buildFilterBody(
    {
      name: 'Invoices',
      conditionAst: '{"type":"contains","field":"from","value":"@x.com"}',
      actions: '[{"type":"skip_inbox"}]',
      description: 'desc',
      status: 'inactive',
      priority: '5',
      stopProcessing: true,
    },
    { mode: 'create' },
  )
  expect(body).toEqual({
    name: 'Invoices',
    condition_ast: { type: 'contains', field: 'from', value: '@x.com' },
    actions: [{ type: 'skip_inbox' }],
    description: 'desc',
    status: 'inactive',
    priority: 5,
    stop_processing: true,
  })
})

test('buildFilterBody (create) requires a name', () => {
  expect(() => buildFilterBody({ conditionAst: '{"type":"all"}' }, { mode: 'create' })).toThrow(
    FilterInputError,
  )
})

test('buildFilterBody (create) requires a condition', () => {
  expect(() => buildFilterBody({ name: 'X' }, { mode: 'create' })).toThrow(FilterInputError)
})

test('buildFilterBody rejects malformed JSON', () => {
  expect(() =>
    buildFilterBody({ name: 'X', conditionAst: '{not json' }, { mode: 'create' }),
  ).toThrow(FilterInputError)
})

test('buildFilterBody rejects a non-integer priority', () => {
  expect(() =>
    buildFilterBody({ conditionAst: '{"type":"all"}', priority: 'high' }, { mode: 'update' }),
  ).toThrow(FilterInputError)
})

test('buildFilterBody (update) sends only provided fields', () => {
  const body = buildFilterBody({ status: 'inactive' }, { mode: 'update' })
  expect(body).toEqual({ status: 'inactive' })
})

test('buildFilterBody (update) does not default actions', () => {
  const body = buildFilterBody({ name: 'Renamed' }, { mode: 'update' })
  expect(body).toEqual({ name: 'Renamed' })
})
