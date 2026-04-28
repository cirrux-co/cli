import { test, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readMimeInput } from './create.js'

test('readMimeInput reads the MIME content from a file when --file is set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cirrux-draft-test-'))
  const path = join(dir, 'message.eml')
  const mime = 'From: me@example.com\r\nSubject: hi\r\n\r\nbody'
  writeFileSync(path, mime, 'utf8')

  try {
    const result = await readMimeInput({ file: path })
    expect(result).toBe(mime)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
