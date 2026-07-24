import { expect, test } from 'bun:test'
import { emptyUploadRequest } from './upload.js'

test('emptyUploadRequest targets the simple route with empty base64 data', () => {
  const { path, body } = emptyUploadRequest({ folderUuid: undefined, name: 'empty.txt', contentType: 'text/plain' })

  expect(path).toBe('public_api/v1/drive/files')
  expect(body).toEqual({ folder_uuid: undefined, name: 'empty.txt', content_type: 'text/plain', data: '' })
})

test('emptyUploadRequest passes through the destination folder', () => {
  const { body } = emptyUploadRequest({ folderUuid: 'f-1', name: 'blank.bin', contentType: 'application/octet-stream' })

  expect(body.folder_uuid).toBe('f-1')
  expect(body.data).toBe('')
})
