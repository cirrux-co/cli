export const ExitCode = {
  SUCCESS: 0,
  GENERAL_FAILURE: 1,
  USAGE_ERROR: 2,
  NOT_FOUND: 3,
  AUTH_REQUIRED: 4,
  CONFLICT: 5,
  RATE_LIMITED: 6,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]

/**
 * The exit code for a failure Commander raises itself, before any command runs: a missing required
 * option, an unknown option or command, a missing argument. Every one of those is the caller's
 * usage mistake, so it exits 2 like the usage errors commands raise themselves, where Commander
 * would exit 1 and read as a general failure. `--help` and `--version` keep their 0.
 */
export function commanderExitCode(error: { exitCode: number }): ExitCode {
  return error.exitCode === 0 ? ExitCode.SUCCESS : ExitCode.USAGE_ERROR
}
