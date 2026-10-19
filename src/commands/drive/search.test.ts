import { expect, test } from 'bun:test'
import { buildDriveSearchParams, type DriveSearchResponse, formatDriveSearch } from './search.js'

const response: DriveSearchResponse = {
  object: 'list',
  query: 'acme',
  has_more: false,
  next_cursor: null,
  data: [
    {
      object: 'drive_folder',
      uuid: 'f-1',
      name: 'Acme',
      url: 'https://drive.cirrux.co/folder/f-1',
      path: { root: 'my_drive', folders: [{ uuid: 'f-0', name: 'Clients' }] },
    },
    {
      object: 'drive_file',
      uuid: 'd-1',
      name: 'Acme contract.pdf',
      url: 'https://drive.cirrux.co/file/d-1',
      path: { root: 'shared_with_me', folders: [{ uuid: 'f-2', name: 'Contracts' }] },
    },
  ],
}

test('formatDriveSearch writes each item with where it sits and its link', () => {
  const { text, quietValue } = formatDriveSearch(response)

  expect(text).toBe(
    'f-1\tAcme/\tMy Drive / Clients\thttps://drive.cirrux.co/folder/f-1\n' +
      'd-1\tAcme contract.pdf\tShared with me / Contracts\thttps://drive.cirrux.co/file/d-1',
  )
  expect(quietValue).toBe('f-1\nd-1')
})

test('formatDriveSearch says when there is more, and when nothing matched', () => {
  expect(formatDriveSearch({ ...response, has_more: true, next_cursor: '25' }).text).toEndWith(
    '--- More results available (cursor: 25) ---',
  )
  expect(formatDriveSearch({ ...response, data: [] }).text).toBe('No files or folders matched the query.')
})

test('buildDriveSearchParams passes the query as written, and only the options given', () => {
  expect(buildDriveSearchParams('type:pdf acme', {}).toString()).toBe('q=type%3Apdf+acme')
  expect(buildDriveSearchParams('', { folder: 'f-1', limit: '10', cursor: '20' }).toString()).toBe(
    'q=&folder_uuid=f-1&limit=10&cursor=20',
  )
})
