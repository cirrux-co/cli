import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  AAD_SIZE,
  CHUNK_OVERHEAD,
  CryptoError,
  HEADER_SIZE,
  HeaderError,
  buildAad,
  buildHeader,
  decodeDataKey,
  decryptChunk,
  encryptChunk,
  packChunk,
  parseHeader,
  randomIv,
  unpackChunk,
  uuidToBytes,
} from './crypto.js'

const FILE_UUID = '11111111-2222-3333-4444-555555555555'
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)) // 0..31

// Encrypt a whole plaintext buffer into the v2 object format, mirroring what the
// streaming upload does part-by-part. `ivs` lets tests pin the per-chunk IVs so
// the output is deterministic and comparable to a golden fixture.
function encryptObject(plaintext: Buffer, chunkSize: number, ivs?: Buffer[]): Buffer {
  const chunkCount = Math.max(1, Math.ceil(plaintext.length / chunkSize))
  const out: Buffer[] = [buildHeader(chunkSize)]
  for (let i = 0; i < chunkCount; i++) {
    const chunkPlain = plaintext.subarray(i * chunkSize, i * chunkSize + chunkSize)
    const iv = ivs ? ivs[i] : randomIv()
    const aad = buildAad({ fileUuid: FILE_UUID, chunkIndex: i, chunkCount, plaintextChunkSize: chunkPlain.length })
    out.push(packChunk(iv, encryptChunk({ key: KEY, iv, aad, plaintext: chunkPlain })))
  }
  return Buffer.concat(out)
}

function decryptObject(object: Buffer, key: Buffer, fileUuid: string): Buffer {
  const { chunkSize } = parseHeader(object)
  const body = object.subarray(HEADER_SIZE)
  const fullChunk = chunkSize + CHUNK_OVERHEAD
  const chunkCount = Math.ceil(body.length / fullChunk)
  const out: Buffer[] = []
  let offset = 0
  for (let i = 0; i < chunkCount; i++) {
    const chunkTotal = Math.min(fullChunk, body.length - offset)
    const { iv, ciphertextWithTag } = unpackChunk(body.subarray(offset, offset + chunkTotal))
    const aad = buildAad({ fileUuid, chunkIndex: i, chunkCount, plaintextChunkSize: chunkTotal - CHUNK_OVERHEAD })
    out.push(decryptChunk({ key, iv, aad, ciphertextWithTag }))
    offset += chunkTotal
  }
  return Buffer.concat(out)
}

describe('header', () => {
  test('build/parse round trip', () => {
    const info = parseHeader(buildHeader(5 * 1024 * 1024))
    expect(info.formatVersion).toBe(1)
    expect(info.algoId).toBe(1)
    expect(info.chunkSize).toBe(5 * 1024 * 1024)
  })

  test('rejects bad magic', () => {
    const bad = buildHeader(16)
    bad[0] = 0x00
    expect(() => parseHeader(bad)).toThrow(HeaderError)
  })

  test('rejects a short header', () => {
    expect(() => parseHeader(Buffer.alloc(8))).toThrow(HeaderError)
  })
})

describe('aad', () => {
  test('has the fixed 56-byte layout', () => {
    const aad = buildAad({ fileUuid: FILE_UUID, chunkIndex: 7, chunkCount: 9, plaintextChunkSize: 1234 })
    expect(aad.length).toBe(AAD_SIZE)
    expect(aad.subarray(0, 16).equals(uuidToBytes(FILE_UUID))).toBe(true)
    expect(aad.readUInt32LE(16)).toBe(7)
    expect(aad.readUInt32LE(20)).toBe(9)
    expect(aad.readUInt32LE(24)).toBe(1234)
    expect(aad.subarray(28).equals(Buffer.alloc(AAD_SIZE - 28))).toBe(true)
  })
})

describe('round trip', () => {
  test('single chunk', () => {
    const plaintext = Buffer.from('hello drive')
    const object = encryptObject(plaintext, 64)
    expect(decryptObject(object, KEY, FILE_UUID).equals(plaintext)).toBe(true)
  })

  test('multi chunk with a short final chunk', () => {
    const data = Buffer.alloc(16 * 3 + 5, 'ab') // 3 full 16-byte chunks + a 5-byte tail
    const object = encryptObject(data, 16)
    expect(parseHeader(object).chunkSize).toBe(16)
    expect(decryptObject(object, KEY, FILE_UUID).equals(data)).toBe(true)
  })
})

describe('tamper detection', () => {
  test('a flipped ciphertext byte fails authentication', () => {
    const object = encryptObject(Buffer.from('sensitive payload here'), 64)
    object[object.length - 1] ^= 0xff // corrupt the GCM tag of the last chunk
    expect(() => decryptObject(object, KEY, FILE_UUID)).toThrow(CryptoError)
  })

  test('a wrong file_uuid (AAD mismatch) fails authentication', () => {
    const object = encryptObject(Buffer.from('bound to the file uuid'), 64)
    const wrongUuid = '99999999-2222-3333-4444-555555555555'
    expect(() => decryptObject(object, KEY, wrongUuid)).toThrow(CryptoError)
  })

  test('a wrong key fails authentication', () => {
    const object = encryptObject(Buffer.from('keyed payload'), 64)
    const wrongKey = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1))
    expect(() => decryptObject(object, wrongKey, FILE_UUID)).toThrow(CryptoError)
  })
})

describe('key handling', () => {
  test('decodeDataKey rejects a non-32-byte key', () => {
    expect(() => decodeDataKey(Buffer.alloc(16).toString('base64'))).toThrow(CryptoError)
  })
})

// Cross-language contract: the backend Ruby V2Codec (v2_codec.rb) and the web
// client (shared-client/lib/drive/crypto.ts) must produce/consume the exact same
// wire format. These golden objects are copied from the shared-client fixtures;
// the CLI decrypting them proves CLI download interoperates, and re-encrypting to
// identical bytes proves CLI upload interoperates.
interface Fixture {
  file_uuid: string
  data_key_base64: string
  chunk_size: number
  plaintext_base64: string
  object_base64: string
}

function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(resolve(import.meta.dir, 'fixtures', name), 'utf8'))
}

// Re-encrypt a fixture's plaintext using the IVs extracted from its golden
// object, so the result is deterministic and must match byte-for-byte.
function reencryptFixture(fixture: Fixture): Buffer {
  const object = Buffer.from(fixture.object_base64, 'base64')
  const body = object.subarray(HEADER_SIZE)
  const fullChunk = fixture.chunk_size + CHUNK_OVERHEAD
  const chunkCount = Math.ceil(body.length / fullChunk)
  const ivs: Buffer[] = []
  let offset = 0
  for (let i = 0; i < chunkCount; i++) {
    const chunkTotal = Math.min(fullChunk, body.length - offset)
    ivs.push(Buffer.from(unpackChunk(body.subarray(offset, offset + chunkTotal)).iv))
    offset += chunkTotal
  }
  const key = decodeDataKey(fixture.data_key_base64)
  const plaintext = Buffer.from(fixture.plaintext_base64, 'base64')
  const out: Buffer[] = [buildHeader(fixture.chunk_size)]
  for (let i = 0; i < chunkCount; i++) {
    const chunkPlain = plaintext.subarray(i * fixture.chunk_size, i * fixture.chunk_size + fixture.chunk_size)
    const aad = buildAad({ fileUuid: fixture.file_uuid, chunkIndex: i, chunkCount, plaintextChunkSize: chunkPlain.length })
    out.push(packChunk(ivs[i], encryptChunk({ key, iv: ivs[i], aad, plaintext: chunkPlain })))
  }
  return Buffer.concat(out)
}

describe.each(['v2_object_from_ruby.json', 'v2_object_from_ts.json'])('cross-language: %s', (name) => {
  test('decrypts to the expected plaintext', () => {
    const fixture = loadFixture(name)
    const key = decodeDataKey(fixture.data_key_base64)
    const object = Buffer.from(fixture.object_base64, 'base64')
    const plaintext = decryptObject(object, key, fixture.file_uuid)
    expect(plaintext.toString('base64')).toBe(fixture.plaintext_base64)
  })

  test('re-encrypts to byte-identical ciphertext', () => {
    const fixture = loadFixture(name)
    expect(reencryptFixture(fixture).toString('base64')).toBe(fixture.object_base64)
  })
})
