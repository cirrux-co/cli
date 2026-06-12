import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ensureConfigDir } from './config.js'

const CACHE_FILE = join(homedir(), '.cirrux', 'update-check.json')
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface UpdateCache {
  latest_version: string
  checked_at: number
}

function readCache(): UpdateCache | null {
  if (!existsSync(CACHE_FILE)) return null
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writeCache(cache: UpdateCache) {
  ensureConfigDir()
  writeFileSync(CACHE_FILE, JSON.stringify(cache))
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/cirrux-co/cli/releases/latest',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!response.ok) return null
    const data = (await response.json()) as { tag_name: string }
    return data.tag_name.replace(/^v/, '')
  } catch {
    return null
  }
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const parts = v.split('.').map((p) => parseInt(p, 10) || 0)
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0] as const
  }
  const [aMaj, aMin, aPatch] = parse(a)
  const [bMaj, bMin, bPatch] = parse(b)
  return aMaj - bMaj || aMin - bMin || aPatch - bPatch
}

export async function checkForUpdate(currentVersion: string) {
  const cache = readCache()
  const now = Date.now()

  let latestVersion: string | null = null

  if (cache && now - cache.checked_at < CHECK_INTERVAL_MS) {
    latestVersion = cache.latest_version
  } else {
    latestVersion = await fetchLatestVersion()
    if (latestVersion) {
      writeCache({ latest_version: latestVersion, checked_at: now })
    }
  }

  if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
    console.log(
      `\nUpdate available: ${currentVersion} → ${latestVersion}\nRun \`brew upgrade cirrux\` to update.\n`
    )
  }
}
