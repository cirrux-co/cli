# Cirrux CLI

Command-line interface for [Cirrux](https://cirrux.co). Browse mailboxes, read threads and emails, download attachments, and manage Drive files — scriptable from the shell or from an AI coding assistant.

## Install

```bash
brew install cirrux-co/tap/cirrux
```

## Getting started

```bash
cirrux login            # browser-based OAuth
cirrux whoami           # confirm which user and workspace you're on
cirrux mailbox list     # list your mailboxes
cirrux doctor           # check the install, sign-in and coding agent setup
```

When `cirrux login` runs in a terminal and finds Claude Code or Codex on the machine, it offers to connect them (see [AI coding assistants](#ai-coding-assistants)).

### Logging in on a headless or remote machine

`cirrux login` opens a browser and waits for a redirect to a local port — which works on your own
machine, but not on a server you've SSH'd into (the browser would be on your laptop, not the server).
For those cases use the device flow:

```bash
cirrux login --no-browser
```

It prints a verification URL and a short code:

```
To sign in, open this URL in a browser on any device:

    https://auth.cirrux.co/device

and enter the code:

    WXYZ-1234

Waiting for you to authorize...
```

Open the URL on any device (e.g. your laptop), sign in, enter the code, and pick a workspace. The CLI
polls in the background and finishes automatically once you approve. No inbound connection to the
remote machine is needed. The CLI also falls back to this flow automatically when it detects a headless
environment (an SSH session, or no display server).

#### Scripting the device flow (`--json`)

Add `--json` to get machine-readable events instead of prose. The CLI prints one line with the code
**before** it starts blocking, then a second line once you approve:

```bash
cirrux login --no-browser --json
```

```json
{"event":"device_code","user_code":"WXYZ-1234","verification_uri":"https://auth.cirrux.co/device","expires_in":900}
{"event":"logged_in","workspace":{"uuid":"...","name":"Acme"},"user":{"uuid":"...","username":"you@acme.com","first_name":"You","last_name":"Acme"},"scopes":["email.read"]}
```

The single process stays alive between the two lines, so an agent can read the first line, show you the
code, and wait for the same process to exit. In `--json` mode progress notices go to stderr, keeping
stdout to just those two events.

## Usage

```bash
# List recent inbox threads
cirrux thread list <mailbox-uuid> --label inbox --limit 20

# Open a thread and see every non-deleted email in it
cirrux thread get <thread-uuid>

# Search threads or individual emails across your mailboxes
cirrux thread search "from:alice is:unread"
cirrux email search "has:attachment after:2026-01-01" --limit 50

# Read one email's HTML body or full MIME
cirrux email content <email-uuid> body
cirrux email content <email-uuid> raw > message.eml

# Mark read/unread or flag/unflag
cirrux email read <email-uuid>
cirrux email flag <email-uuid>

# Save an attachment to disk
cirrux attachment download <attachment-uuid> > attachment.pdf
```

### Compose & drafts

```bash
# MIME mode — you assemble the full RFC 5322 message
cirrux draft create --mailbox-uuid <mailbox-uuid> --file message.eml
cat message.eml | cirrux draft create --mailbox-uuid <mailbox-uuid>

# Markdown mode — supply a body plus structured headers
cirrux draft create --mailbox-uuid <mailbox-uuid> --markdown body.md \
  --subject "Hi" --to alice@example.com --cc bob@example.com

# Reply linking (either mode), then send or delete
cirrux draft create --mailbox-uuid <mailbox-uuid> --file reply.eml --in-reply-to <email-uuid>
cirrux draft send <draft-uuid>
cirrux draft delete <draft-uuid>
```

`draft send` needs the `email.send` OAuth scope (separate from `email.write`); if you logged in before send existed, run `cirrux logout && cirrux login` to re-grant.

**Attachments on outgoing mail:** there is no `--attach` flag, and markdown mode cannot carry files. The only way to send an attachment is to build a complete, valid MIME message yourself — a `multipart/mixed` body with each file as a base64-encoded part marked `Content-Disposition: attachment` — and pass it via `--file` or stdin. The backend then decodes and stores those parts, so the draft sends normally. Supply well-formed MIME; a malformed or truncated message may be rejected or drop the part. The `cirrux attachment` commands are download-only and do not add files to a draft.

### Drive

```bash
# List the root, then list a folder
cirrux drive list
cirrux drive list <folder-uuid>

# File metadata
cirrux drive get <file-uuid>

# Download a file (decrypted locally; raw bytes to stdout — pipe to a file)
cirrux drive download <file-uuid> > report.pdf
# ...or stream straight to a path (recommended for large files)
cirrux drive download <file-uuid> --output report.pdf

# Upload a file (2 GB max); omit the folder to land in the root
cirrux drive upload <folder-uuid> --file ./report.pdf
cirrux drive upload --file ./notes.txt --name renamed.txt --content-type text/plain

# Replace a file's contents in place, keeping its UUID (2 GB max)
cirrux drive replace <file-uuid> --file ./report-v2.pdf

# Trash (reversible) or permanently delete a file
cirrux drive trash <file-uuid>
cirrux drive delete <file-uuid>

# Create a public download link (anyone with the link can download, no login)
cirrux drive share create <file-uuid>
cirrux drive share create <folder-uuid> --folder
cirrux drive share get <file-uuid>
cirrux drive share revoke <file-uuid>

# Calendars (recurring series come back already expanded)
cirrux calendar list
cirrux calendar events list <calendar-uuid> --today
cirrux calendar events list <calendar-uuid> --on 2026-09-02
cirrux calendar events list <calendar-uuid> --from 2026-09-01 --to 2026-09-08
cirrux calendar events create <calendar-uuid> --title "Coffee" --start 2026-09-02T10:00 --end 2026-09-02T10:30
cirrux calendar events create <calendar-uuid> --title "Offsite" --all-day --start 2026-09-02 --end 2026-09-04
cirrux calendar events update <calendar-uuid> <event-uuid> --location "Room 2"
cirrux calendar events update <calendar-uuid> <uuid>_20260909T070000Z --title "Long standup"  # one occurrence
cirrux calendar events delete <calendar-uuid> <event-uuid> --yes

# Contacts (read-only; a contact lives in an addressbook)
cirrux contacts addressbooks
cirrux contacts list <addressbook-uuid>
cirrux contacts search "acme"
cirrux contacts search "jane" --addressbook-uuid <addressbook-uuid>
cirrux contacts get <contact-uuid>
```

### Commands

| Command                                                               | What it does                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `cirrux login` / `cirrux logout` / `cirrux whoami`                    | Browser OAuth (`--no-browser` for headless/remote machines), sign out, show current user + workspace |
| `cirrux feedback [message]`                                           | Send feedback about Cirrux or the CLI to the team (reads stdin if no message)                         |
| `cirrux mailbox list`                                                 | List mailboxes you have access to                                                                    |
| `cirrux mailbox get <mailbox-uuid>`                                   | Mailbox metadata                                                                                     |
| `cirrux thread list <mailbox-uuid>`                                   | List threads in a mailbox (`--label`, `--limit`, `--cursor`)                                         |
| `cirrux thread get <thread-uuid>`                                     | Thread with all non-deleted emails                                                                   |
| `cirrux thread search <query>`                                        | Search threads across your mailboxes (`--mailbox-uuid`, `--limit`, `--cursor`)                       |
| `cirrux email get <email-uuid>`                                       | Email metadata                                                                                       |
| `cirrux email content <email-uuid> body\|raw`                         | Rendered HTML body or full MIME                                                                      |
| `cirrux email search <query>`                                         | Search individual emails across your mailboxes                                                       |
| `cirrux email read <email-uuid>` / `cirrux email unread <email-uuid>` | Mark an email as read or unread                                                                      |
| `cirrux email flag <email-uuid>` / `cirrux email unflag <email-uuid>` | Flag (star) or unflag an email                                                                       |
| `cirrux draft create --mailbox-uuid <uuid>`                           | Create a draft from a MIME message (`--file`/stdin) or markdown (`--markdown` + headers); `--in-reply-to` links a reply |
| `cirrux draft send <draft-uuid>`                                      | Send a draft immediately (needs the `email.send` scope)                                              |
| `cirrux draft delete <draft-uuid>`                                    | Delete a draft                                                                                       |
| `cirrux attachment get <attachment-uuid>`                             | Attachment metadata                                                                                  |
| `cirrux attachment download <attachment-uuid>`                        | Raw bytes to stdout (use `--json` for base64url)                                                     |
| `cirrux drive list [folder-uuid]`                                     | List folders and files in a folder (omit for the root)                                               |
| `cirrux drive get <file-uuid>`                                        | File metadata                                                                                        |
| `cirrux drive download <file-uuid>`                                   | Decrypt locally; raw bytes to stdout (`--output <path>` to stream to a file, `--json` for base64url) |
| `cirrux drive upload [folder-uuid] --file <path>`                     | Encrypt locally and upload, 2 GB max (`--name`, `--content-type`)                                    |
| `cirrux drive replace <file-uuid> --file <path>`                      | Replace a file's contents in place, keeping its UUID; encrypts locally, 2 GB max (`--content-type`)  |
| `cirrux drive trash <file-uuid>`                                      | Move a file to the trash (reversible, idempotent)                                                    |
| `cirrux drive delete <file-uuid>`                                     | Permanently delete a file (idempotent)                                                               |
| `cirrux drive share create <uuid> [--folder]`                         | Create a public download link for a file or folder (anyone with the link, no login)                  |
| `cirrux drive share get <uuid> [--folder]`                            | Show sharing settings (grants + public link) for a file or folder                                    |
| `cirrux drive share revoke <uuid> [--folder]`                         | Revoke the public link for a file or folder                                                          |
| `cirrux calendar list`                                                | List calendars you can see (needs the `calendar.read` scope)                                         |
| `cirrux calendar events list <calendar-uuid>`                         | Events in a window, recurring series already expanded (`--today`, `--on`, `--from`/`--to`, `--days`) |
| `cirrux calendar events create <calendar-uuid>`                       | Create an event (`--title`, `--start`, `--end`, `--all-day`, `--recurrence`, `--attendee`)           |
| `cirrux calendar events update <calendar-uuid> <event-id>`            | Change an event, or one occurrence when given an occurrence ID from `events list`                    |
| `cirrux calendar events delete <calendar-uuid> <event-id>`            | Delete an event, or cancel one occurrence. Emails guests a cancellation, so confirms unless `--yes`  |
| `cirrux contacts addressbooks`                                        | List your addressbooks (needs the `contacts.read` scope)                                             |
| `cirrux contacts list <addressbook-uuid>`                             | List the contacts in one addressbook (`--limit`, `--cursor`)                                         |
| `cirrux contacts search <query>`                                      | Substring search over contact names, company and email addresses (`--addressbook-uuid`)              |
| `cirrux contacts get <contact-uuid>`                                  | One contact with its email addresses and phone numbers                                               |
| `cirrux skill install` / `uninstall` / `print`                        | Connect coding agents to the bundled agent skill, remove it, or preview it                           |
| `cirrux doctor`                                                       | Check the install, sign-in and each detected coding agent                                            |

Search supports `from:`, `to:`, `cc:`, `bcc:`, `subject:`, `body:`, `is:read`/`is:unread`/`is:starred`/`is:unstarred`/`is:replied`, `has:attachment`, `in:inbox`/`in:sent`/`in:drafts`/`in:archive`/`in:trash`/`in:spam`/`in:snoozed`/`in:starred`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`, bare terms for full-text, `"phrase match"`, and `-` to negate. Terms are ANDed by default.

Every data-producing command supports three output modes:

| Flag        | What you get                     | When to use it                  |
| ----------- | -------------------------------- | ------------------------------- |
| _(default)_ | Human-readable text              | Reading output at the terminal  |
| `--json`    | Structured JSON                  | Parsing fields programmatically |
| `--quiet`   | Bare identifier(s), one per line | Piping UUIDs into the next call |

Exit codes follow a predictable convention (`0` success, `1` unexpected failure, `2` usage error, `3` not found, `4` not logged in, `5` conflict, `6` rate limited) so scripts can branch on them without parsing error text. See [CLI design principles](docs/cli-design-principles.md) for the full rationale.

### Rate limits

The CLI absorbs the public API's rate limit (600 requests/minute per token) for you: on a `429` it honors the server's `Retry-After` and retries automatically (falling back to exponential backoff), so batch jobs ride out a throttle window instead of failing. Direct-to-S3 chunk transfers retry the same way on transient `503 SlowDown`. Only when a limit stays saturated past the retry budget does the command give up, exiting `6` with a `rate_limited` error (the `--json` shape carries a wait hint). Uploads are durable once they complete: a throttle late in the multi-step upload no longer aborts a file that already landed, so retries won't collide with a "name already exists" conflict.

### Pipe UUIDs between commands

```bash
# Read every email in the latest inbox thread
mb=$(cirrux mailbox list --quiet | head -1)
thread=$(cirrux thread list "$mb" --label inbox --limit 1 --quiet)
cirrux thread get "$thread" --quiet | while read email_uuid; do
  cirrux email content "$email_uuid" body
done
```

## AI coding assistants

`cirrux` ships an agent skill that teaches Claude Code, Codex and other skill-aware assistants how to use this CLI: auth, output modes, the command tree, and common workflows.

```bash
cirrux skill install              # ~/.agents/skills/cirrux, linked from ~/.claude/skills/cirrux
cirrux skill install --project    # the same under the current directory, to check into a repo
cirrux skill uninstall            # remove it again
cirrux skill print                # preview the bundled skill content
cirrux doctor                     # is every detected agent connected?
```

There is one copy of the skill, in `~/.agents/skills/cirrux/`, where Codex and other Agent Skills tools look for it. Claude Code gets a symlink to it from `~/.claude/skills/cirrux` (a copy on systems without symlinks). An interactive `cirrux login` offers to do this for you when it finds an agent that is not connected yet.

The skill follows the CLI: after an upgrade, the first command you run rewrites the installed skill to match the new version, so your assistant never works from instructions for the old one.

The CLI marks every skill directory it writes with a `.managed-by-cirrux-cli` file and never writes, replaces or removes a skill directory without it, so a skill you wrote yourself at one of these paths is safe. Skills installed by releases before 0.39 have no marker; `cirrux doctor` points them out, and `cirrux skill install --force` replaces them.

Once installed, ask your assistant something like _"show me the latest unread thread in my inbox"_ and it'll reach for the CLI.

## Links

- Docs & product: <https://cirrux.co>
- Issues & source: <https://github.com/cirrux-co/cli>
- Homebrew tap: <https://github.com/cirrux-co/homebrew-tap>
