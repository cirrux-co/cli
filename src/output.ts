import { ExitCode } from './exit-codes.js'

export interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

/**
 * Print command output respecting --json and --quiet flags.
 *
 * - `--json`  → JSON to stdout
 * - `--quiet` → bare value to stdout (for piping)
 * - default   → human-readable text to stdout
 */
export function output(
  data: Record<string, unknown>,
  options: OutputOptions & {
    text: string
    quietValue?: string
  },
): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(data) + '\n')
  } else if (options.quiet) {
    process.stdout.write((options.quietValue ?? '') + '\n')
  } else {
    process.stdout.write(options.text + '\n')
  }
}

/**
 * Print an error and exit with the given code.
 *
 * - `--json` → structured JSON error to stdout, diagnostic to stderr
 * - default  → human-readable message to stderr
 */
export function outputError(
  message: string,
  options: OutputOptions & {
    code: ExitCode
    hint?: string
    errorType?: string
  },
): never {
  if (options.json) {
    process.stdout.write(
      JSON.stringify({
        error: {
          type: options.errorType ?? 'error',
          message,
          ...(options.hint ? { hint: options.hint } : {}),
        },
      }) + '\n',
    )
  } else {
    process.stderr.write(`Error: ${message}\n`)
    if (options.hint) {
      process.stderr.write(`Hint: ${options.hint}\n`)
    }
  }

  process.exit(options.code)
}
