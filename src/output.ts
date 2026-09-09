import { ExitCode } from './exit-codes.js'

export interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

/**
 * Renders one output mode's payload, on demand.
 *
 * Formatting is deferred so that only the mode the caller actually asked for
 * is ever built: a formatter that throws on unusual data (an email with no
 * `From:` header, say) can no longer take `--json` down with it, and a caller
 * hitting such a record still has `--json` as a way through.
 */
export type Renderer = () => string

/**
 * Defer a pure formatter that renders both modes at once.
 *
 * Only the mode being printed ever calls its renderer, so `format` runs once
 * (or not at all, under `--json`) despite appearing twice.
 */
export function deferred(
  format: () => { text: string; quietValue: string },
): { text: Renderer; quietValue: Renderer } {
  return {
    text: () => format().text,
    quietValue: () => format().quietValue,
  }
}

/**
 * Print command output respecting --json and --quiet flags.
 *
 * - `--json`  → JSON to stdout
 * - `--quiet` → bare value to stdout (for piping)
 * - default   → human-readable text to stdout
 *
 * `text` and `quietValue` are thunks: do the formatting *inside* them, not
 * before the call, or the deferral buys nothing.
 */
export function output(
  data: Record<string, unknown>,
  options: OutputOptions & {
    text: Renderer
    quietValue?: Renderer
  },
): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(data) + '\n')
  } else if (options.quiet) {
    process.stdout.write(render(options.quietValue, options) + '\n')
  } else {
    process.stdout.write(render(options.text, options) + '\n')
  }
}

/**
 * Run a renderer, turning a formatting crash into a typed `format_error`
 * rather than letting it surface as an API failure or a raw stack trace.
 * The data was fetched fine; only our rendering of it failed, and callers
 * need to be able to tell those apart.
 */
function render(renderer: Renderer | undefined, options: OutputOptions): string {
  if (!renderer) return ''

  try {
    return renderer()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    outputError(`Could not format the response for display: ${reason}`, {
      ...options,
      code: ExitCode.GENERAL_FAILURE,
      errorType: 'format_error',
      hint: 'Re-run with --json to get the raw response.',
    })
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
