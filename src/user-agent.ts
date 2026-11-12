import { execFileSync } from 'node:child_process'
import { arch, platform, release } from 'node:os'
import { CLI_VERSION } from './version.js'

// What the CLI calls itself on every API request. The server records it on the session, and
// Settings, Security, Sessions describes each login from it: without one, Node's default ("node")
// parses as nothing at all. The parenthesised part follows the browser convention closely enough
// for the server's user agent parser to recognise the operating system.
export function userAgentFor(options: {
  version: string
  platform: string
  release: string
  arch: string
  node: string
  macOSVersion?: string
}) {
  return `Cirrux-CLI/${options.version} (${systemPart(options)}) Node/${options.node}`
}

function systemPart(options: { platform: string; release: string; arch: string; macOSVersion?: string }) {
  const { platform, release, arch, macOSVersion } = options
  switch (platform) {
    case 'darwin':
      // The parser only recognises macOS with a version after it, written with underscores.
      return macOSVersion ? `Macintosh; Mac OS X ${macOSVersion.replaceAll('.', '_')}; ${arch}` : `Macintosh; ${arch}`
    case 'win32':
      return `Windows NT ${release.split('.').slice(0, 2).join('.')}; ${arch}`
    case 'linux':
      return `Linux; ${arch}`
    default:
      return `${platform}; ${arch}`
  }
}

// Node only knows the Darwin kernel's version, so ask the system for the product version.
function readMacOSVersion(): string | undefined {
  try {
    return execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8', timeout: 1000 }).trim() || undefined
  } catch {
    return undefined
  }
}

let cached: string | undefined

export function cliUserAgent(): string {
  cached ??= userAgentFor({
    version: CLI_VERSION,
    platform: platform(),
    release: release(),
    arch: arch(),
    node: process.versions.node,
    macOSVersion: platform() === 'darwin' ? readMacOSVersion() : undefined,
  })
  return cached
}
