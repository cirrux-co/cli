# Cirrux CLI

Command-line interface for [Cirrux](https://cirrux.co). Browse mailboxes, read threads and emails, download attachments — scriptable from the shell or from an AI coding assistant.

## Install

```bash
brew install cirrux-co/tap/cirrux
```

## Getting started

```bash
cirrux login            # browser-based OAuth
cirrux whoami           # confirm which user and workspace you're on
cirrux mailbox list     # list your mailboxes
```

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

### Commands

| Command | What it does |
|---------|--------------|
| `cirrux login` / `cirrux logout` / `cirrux whoami` | Browser OAuth, sign out, show current user + workspace |
| `cirrux mailbox list` | List mailboxes you have access to |
| `cirrux mailbox get <mailbox-uuid>` | Mailbox metadata |
| `cirrux thread list <mailbox-uuid>` | List threads in a mailbox (`--label`, `--limit`, `--cursor`) |
| `cirrux thread get <thread-uuid>` | Thread with all non-deleted emails |
| `cirrux thread search <query>` | Search threads across your mailboxes (`--mailbox-uuid`, `--limit`, `--cursor`) |
| `cirrux email get <email-uuid>` | Email metadata |
| `cirrux email content <email-uuid> body\|raw` | Rendered HTML body or full MIME |
| `cirrux email search <query>` | Search individual emails across your mailboxes |
| `cirrux email read <email-uuid>` / `cirrux email unread <email-uuid>` | Mark an email as read or unread |
| `cirrux email flag <email-uuid>` / `cirrux email unflag <email-uuid>` | Flag (star) or unflag an email |
| `cirrux attachment get <attachment-uuid>` | Attachment metadata |
| `cirrux attachment download <attachment-uuid>` | Raw bytes to stdout (use `--json` for base64url) |
| `cirrux skill install` / `cirrux skill print` | Install or preview the bundled agent skill |

Search supports `from:`, `to:`, `cc:`, `bcc:`, `subject:`, `body:`, `is:read`/`is:unread`/`is:starred`/`is:unstarred`/`is:replied`, `has:attachment`, `in:inbox`/`in:sent`/`in:drafts`/`in:archive`/`in:snoozed`/`in:starred`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`, bare terms for full-text, `"phrase match"`, and `-` to negate. Terms are ANDed by default.

Every data-producing command supports three output modes:

| Flag        | What you get                                          | When to use it                   |
|-------------|-------------------------------------------------------|----------------------------------|
| *(default)* | Human-readable text                                   | Reading output at the terminal   |
| `--json`    | Structured JSON                                       | Parsing fields programmatically  |
| `--quiet`   | Bare identifier(s), one per line                      | Piping UUIDs into the next call  |

Exit codes follow a predictable convention (`0` success, `2` usage error, `3` not found, `4` not logged in, `5` conflict) so scripts can branch on them without parsing error text. See [CLI design principles](docs/cli-design-principles.md) for the full rationale.

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

`cirrux` ships an agent skill that teaches Claude Code (and other skill-aware assistants) how to use this CLI — auth, output modes, the command tree, and common workflows.

```bash
cirrux skill install              # ~/.claude/skills/cirrux/SKILL.md
cirrux skill install --project    # ./.claude/skills/cirrux/SKILL.md (checked into the repo you're in)
cirrux skill print                # preview the bundled skill content
```

Once installed, ask your assistant something like *"show me the latest unread thread in my inbox"* and it'll reach for the CLI.

## Links

- Docs & product: <https://cirrux.co>
- Issues & source: <https://github.com/cirrux-co/cli>
- Homebrew tap: <https://github.com/cirrux-co/homebrew-tap>
