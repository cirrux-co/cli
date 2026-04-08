export const ExitCode = {
  SUCCESS: 0,
  GENERAL_FAILURE: 1,
  USAGE_ERROR: 2,
  NOT_FOUND: 3,
  AUTH_REQUIRED: 4,
  CONFLICT: 5,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]
