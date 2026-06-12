import { expect, test } from 'bun:test'
import { formatDriveList } from './list.js'

const folder = {
  object: 'drive_folder',
  uuid: 'f-1',
  parent_uuid: null,
  name: 'Documents',
  color: null,
}

const file = {
  object: 'drive_file',
  uuid: 'd-1',
  folder_uuid: null,
  name: 'notes.txt',
  content_type: 'text/plain',
  file_size_bytes: 42,
  upload_status: 'completed',
  created_at: '2026-06-12T00:00:00.000Z',
  updated_at: '2026-06-12T00:00:00.000Z',
}

test('formatDriveList lists folders (with trailing slash) before files', () => {
  const { text, quietValue } = formatDriveList({
    object: 'list',
    folder_uuid: null,
    folders: [folder],
    files: [file],
  })

  expect(text).toBe('f-1\tDocuments/\nd-1\tnotes.txt\t42')
  expect(quietValue).toBe('f-1\nd-1')
})

test('formatDriveList reports an empty listing', () => {
  const { text, quietValue } = formatDriveList({
    object: 'list',
    folder_uuid: null,
    folders: [],
    files: [],
  })

  expect(text).toBe('No folders or files here.')
  expect(quietValue).toBe('')
})
