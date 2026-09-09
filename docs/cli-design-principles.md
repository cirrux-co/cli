# Cirrux CLI — Design Principles

These principles guide how we build and extend the Cirrux CLI. They ensure consistency across commands and make the CLI useful for both humans and automated tooling (scripts, AI agents, CI pipelines).

## 1. Noun-verb command hierarchy

Resource-scoped commands follow `cirrux <noun> <verb>`:

```
cirrux workspace list
cirrux workspace switch <id>
cirrux domain add <domain>
cirrux domain verify <domain>
```

Global operations like `login` and `whoami` remain top-level since they aren't resource-scoped.

## 2. Always support `--json`

Every command supports a `--json` flag for structured output.

- **stdout** is for data (text or JSON depending on the flag)
- **stderr** is for diagnostics, progress, and errors
- JSON output uses flat structures, consistent field names, ISO 8601 timestamps, and UUIDs as strings
- Human-readable text is the default when `--json` is not passed

Use the shared `output` utility (`src/output.ts`) so every command gets this for free.

**Render lazily.** `text` and `quietValue` are thunks, and `output` only invokes the one it is about to print. Build the human string *inside* the thunk, never in a local above the call: formatters run against whatever the API returned, and one odd record (an email with no `From:` header) must not be able to take `--json` down with it. A caller who hits such a record needs `--json` to still be a way through. For the pure "render both modes at once" helpers, wrap the call in `deferred(() => formatX(response))` so the helper stays a plain, unit-testable function.

## 3. Meaningful exit codes

Go beyond 0/1. Use the shared constants from `src/exit-codes.ts`:

| Code | Constant           | Meaning                        |
|------|--------------------|--------------------------------|
| 0    | `SUCCESS`          | Success                        |
| 1    | `GENERAL_FAILURE`  | General / unexpected failure   |
| 2    | `USAGE_ERROR`      | Bad arguments or usage         |
| 3    | `NOT_FOUND`        | Resource not found             |
| 4    | `AUTH_REQUIRED`    | Not logged in / permission denied |
| 5    | `CONFLICT`         | Resource already exists        |
| 6    | `RATE_LIMITED`     | Rate limited, retries exhausted |

## 4. Non-interactive by default

- Never prompt for input in non-TTY environments. Detect `process.stdout.isTTY` and fail with a clear message instead.
- Support `--yes` / `--force` for destructive operations.
- Support `--dry-run` for mutations that change state.
- The `login` command is the exception — it requires a browser.

## 5. Idempotent where possible

Commands like `domain add` should succeed gracefully if the resource already exists, or return exit code 5 (CONFLICT) so callers can distinguish "already done" from "failed". Don't force users to check-then-act.

## 6. Composable output

Support `--quiet` for minimal output (just IDs or key values, one per line) that pipes well:

```bash
cirrux domain list --quiet | xargs -I {} cirrux domain verify {}
```

Between `--json`, `--quiet`, and plain text, the three output modes cover the vast majority of use cases.

## 7. Actionable errors

- Include an error `code` / `type` in JSON error output
- Echo back the failing input ("domain 'foo.bar' not found")
- Suggest next steps ("Run `cirrux login` first")
- Distinguish transient errors (network timeout — retry) from permanent ones (not found — don't retry)
- Distinguish *our* failures from the API's: a formatter that throws exits 1 with type `format_error`, not `api_error`. Integrations back off or fail over differently for "the server rejected this" than for "the CLI could not print it", and the hint points at `--json`, which is unaffected.

## 8. Self-documenting help

- Add realistic examples to every command's help text
- Document the `--json` flag in each command's help
- List valid values for enum-type options
- Both humans and AI agents discover capabilities through `--help`

## 9. One error mapper

Every command's `catch` ends in `handleApiError` (`src/api-errors.ts`). It owns the whole ladder — `insufficient_scope`, 404, 403, 409, 429, 422/400 — so a command never decides an exit code for itself.

**Never classify by sniffing strings.** `ApiError.message` is the API's `error_description` when there is one, so it does *not* contain the status code: a `message.includes('404')` test is dead code that silently downgrades every not-found to exit 1. And `error.body.includes('name_taken')` can fire on a description echoing a filename. Match on `error.status` and the parsed `error.errorCode` instead.

Domain differences are expressed as `ApiErrorRule` **data**, never as a new `if`:

```ts
export const DRIVE_ERROR_RULES: ApiErrorRule[] = [
  { errorCode: 'name_taken', exitCode: ExitCode.CONFLICT, reason: '...', hint: '...' },
]
```

Rules are tried in order before the ladder, and the first match wins. A per-domain wrapper exists only to bind `scope` / `rules` — it never contains a branch. Six near-identical hand-rolled handlers is how this file's rules got out of sync in the first place.

Classification lives in the pure `classifyApiError`, so it is unit-testable without spying on `process.exit`; `handleApiError` is the thin wrapper that prints and exits.
