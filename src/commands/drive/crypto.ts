// Drive v2 chunked-encryption codec for the CLI.
//
// This is the Node twin of the canonical client codec in
// `shared-client/lib/drive/crypto.ts` and the Ruby twin in the backend's
// `drive/services/v2_codec.rb`. It MUST stay byte-for-byte compatible with both:
// the CLI uploads files the web client downloads, and downloads files the web
// client (or the backend simple route) uploaded. The cross-language fixtures in
// `crypto.crosslang.test.ts` are the contract — do not change constants without
// updating every side and the fixtures.
//
// Wire format of the final S3 object:
//
//   [HEADER 16B] [chunk_0: IV ‖ ct ‖ tag] [chunk_1: ...] ... [chunk_N-1: ...]
//
// Per chunk: 12-byte IV, then AES-256-GCM ciphertext with the 16-byte tag
// appended. AAD bound to every chunk (56 bytes, fixed layout):
//
//   bytes  0..15  file_uuid (raw)
//   bytes 16..19  chunk_index           (u32 LE)
//   bytes 20..23  chunk_count           (u32 LE)
//   bytes 24..27  plaintext_chunk_size  (u32 LE)
//   bytes 28..55  reserved              (zeros)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const HEADER_SIZE = 16
export const CHUNK_IV_SIZE = 12
export const CHUNK_TAG_SIZE = 16
export const CHUNK_OVERHEAD = CHUNK_IV_SIZE + CHUNK_TAG_SIZE // 28
export const AAD_SIZE = 56

const ALGORITHM = 'aes-256-gcm'
const MAGIC = Buffer.from([0x43, 0x58, 0x44, 0x52, 0x56, 0x32, 0x00, 0x00]) // "CXDRV2\0\0"
const FORMAT_VERSION = 1
const ALGO_ID_AES_256_GCM = 1
const U32_MAX = 0xffffffff

export class CryptoError extends Error {}
export class HeaderError extends CryptoError {}

export interface AadParams {
  fileUuid: string
  chunkIndex: number
  chunkCount: number
  plaintextChunkSize: number
}

export interface HeaderInfo {
  formatVersion: number
  algoId: number
  chunkSize: number
}

/** Decode the base64 data key the server hands us into a raw 32-byte AES key. */
export function decodeDataKey(base64Key: string): Buffer {
  const raw = Buffer.from(base64Key, 'base64')
  if (raw.byteLength !== 32) {
    throw new CryptoError(`Expected 32-byte AES-256 key, got ${raw.byteLength}`)
  }
  return raw
}

export function randomIv(): Buffer {
  return randomBytes(CHUNK_IV_SIZE)
}

export function encryptChunk(opts: {
  key: Buffer
  iv: Buffer
  aad: Buffer
  plaintext: Buffer
}): Buffer {
  if (opts.iv.byteLength !== CHUNK_IV_SIZE) {
    throw new CryptoError(`IV must be ${CHUNK_IV_SIZE} bytes`)
  }
  const cipher = createCipheriv(ALGORITHM, opts.key, opts.iv, { authTagLength: CHUNK_TAG_SIZE })
  cipher.setAAD(opts.aad)
  const ciphertext = Buffer.concat([cipher.update(opts.plaintext), cipher.final()])
  // Match WebCrypto's output, which appends the tag to the ciphertext.
  return Buffer.concat([ciphertext, cipher.getAuthTag()])
}

export function decryptChunk(opts: {
  key: Buffer
  iv: Buffer
  aad: Buffer
  ciphertextWithTag: Buffer
}): Buffer {
  if (opts.iv.byteLength !== CHUNK_IV_SIZE) {
    throw new CryptoError(`IV must be ${CHUNK_IV_SIZE} bytes`)
  }
  if (opts.ciphertextWithTag.byteLength < CHUNK_TAG_SIZE) {
    throw new CryptoError(`Chunk too short: ${opts.ciphertextWithTag.byteLength}`)
  }
  const split = opts.ciphertextWithTag.byteLength - CHUNK_TAG_SIZE
  const ciphertext = opts.ciphertextWithTag.subarray(0, split)
  const tag = opts.ciphertextWithTag.subarray(split)
  const decipher = createDecipheriv(ALGORITHM, opts.key, opts.iv, { authTagLength: CHUNK_TAG_SIZE })
  decipher.setAAD(opts.aad)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (error) {
    throw new CryptoError(`chunk authentication failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function buildAad(params: AadParams): Buffer {
  for (const value of [params.chunkIndex, params.chunkCount, params.plaintextChunkSize]) {
    if (value < 0 || value > U32_MAX) throw new CryptoError('AAD field out of u32 range')
  }
  const aad = Buffer.alloc(AAD_SIZE)
  uuidToBytes(params.fileUuid).copy(aad, 0)
  aad.writeUInt32LE(params.chunkIndex, 16)
  aad.writeUInt32LE(params.chunkCount, 20)
  aad.writeUInt32LE(params.plaintextChunkSize, 24)
  return aad
}

export function buildHeader(chunkSize: number): Buffer {
  if (chunkSize <= 0 || chunkSize > U32_MAX) throw new CryptoError('chunk_size out of u32 range')

  const header = Buffer.alloc(HEADER_SIZE)
  MAGIC.copy(header, 0)
  header[8] = FORMAT_VERSION
  header[9] = ALGO_ID_AES_256_GCM
  header.writeUInt32LE(chunkSize, 10)
  return header
}

export function parseHeader(bytes: Buffer): HeaderInfo {
  if (bytes.byteLength < HEADER_SIZE) throw new HeaderError(`Header too short: ${bytes.byteLength}`)
  if (!bytes.subarray(0, MAGIC.byteLength).equals(MAGIC)) throw new HeaderError('Bad magic bytes')

  const formatVersion = bytes[8]
  if (formatVersion !== FORMAT_VERSION) throw new HeaderError(`Unsupported format version: ${formatVersion}`)

  const algoId = bytes[9]
  if (algoId !== ALGO_ID_AES_256_GCM) throw new HeaderError(`Unsupported algo id: ${algoId}`)

  return { formatVersion, algoId, chunkSize: bytes.readUInt32LE(10) }
}

/** Byte offset in the S3 object where chunk `i`'s IV starts. */
export function cipherOffset(chunkIndex: number, chunkSize: number): number {
  return HEADER_SIZE + chunkIndex * (chunkSize + CHUNK_OVERHEAD)
}

/**
 * Byte offset (exclusive) where chunk `i` ends. The last chunk is short, so
 * callers must pass ciphertextSize so the formula returns the precise end.
 */
export function cipherEnd(
  chunkIndex: number,
  chunkSize: number,
  ciphertextSize: number,
  chunkCount: number,
): number {
  if (chunkIndex >= chunkCount - 1) return ciphertextSize
  return cipherOffset(chunkIndex + 1, chunkSize)
}

/** Concatenate [IV ‖ ciphertext+tag]; the body shape that goes into each S3 part. */
export function packChunk(iv: Buffer, ciphertextWithTag: Buffer): Buffer {
  return Buffer.concat([iv, ciphertextWithTag])
}

/** Split a downloaded chunk range back into IV + ciphertext+tag. */
export function unpackChunk(bytes: Buffer): { iv: Buffer; ciphertextWithTag: Buffer } {
  if (bytes.byteLength < CHUNK_OVERHEAD) throw new CryptoError(`Chunk too short: ${bytes.byteLength}`)
  return {
    iv: bytes.subarray(0, CHUNK_IV_SIZE),
    ciphertextWithTag: bytes.subarray(CHUNK_IV_SIZE),
  }
}

export function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32 || !/^[0-9a-fA-F]+$/.test(hex)) throw new CryptoError(`Invalid UUID: ${uuid}`)
  return Buffer.from(hex, 'hex')
}
