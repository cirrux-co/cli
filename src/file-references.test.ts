import { expect, test } from 'bun:test'
import { collectUuid, fileReferences } from './file-references.js'

test('repeated flags collect every uuid in order', () => {
  expect(collectUuid('b', collectUuid('a', []))).toEqual(['a', 'b'])
})

test('attachments and Drive files become references, attachments first', () => {
  expect(fileReferences(['att-1'], ['file-1', 'file-2'])).toEqual([
    { attachment_uuid: 'att-1' },
    { drive_file_uuid: 'file-1' },
    { drive_file_uuid: 'file-2' },
  ])
  expect(fileReferences()).toEqual([])
})
