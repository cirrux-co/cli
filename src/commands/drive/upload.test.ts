import { expect, test } from 'bun:test'
import { attachmentUploadRequest, emptyUploadRequest } from './upload.js'

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

test('attachmentUploadRequest names the attachment instead of sending data, and only what was passed', () => {
  expect(
    attachmentUploadRequest({
      folderUuid: undefined,
      attachmentUuid: 'att-1',
      name: undefined,
      contentType: undefined,
    }),
  ).toEqual({ path: 'public_api/v1/drive/files', body: { attachment_uuid: 'att-1' } })

  const { body } = attachmentUploadRequest({
    folderUuid: 'f-1',
    attachmentUuid: 'att-1',
    name: 'Invoice 77.pdf',
    contentType: 'application/pdf',
  })
  expect(body).toEqual({
    attachment_uuid: 'att-1',
    folder_uuid: 'f-1',
    name: 'Invoice 77.pdf',
    content_type: 'application/pdf',
  })
  expect(body).not.toHaveProperty('data')
})
