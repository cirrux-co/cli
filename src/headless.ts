// A headless machine (e.g. a server reached over SSH) can render a URL but has
// no browser to open and no way to receive the loopback redirect, so we fall
// back to the device authorization grant instead of the local-callback flow.
// Platform/env are injectable so the detection logic is unit-testable.
export function isHeadless(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (platform === 'darwin' || platform === 'win32') return false
  if (env.SSH_CONNECTION || env.SSH_TTY) return true
  return !env.DISPLAY && !env.WAYLAND_DISPLAY
}
