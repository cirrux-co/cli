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

# Read one email's HTML body or full MIME
cirrux email content <email-uuid> body
cirrux email content <email-uuid> raw > message.eml

# Save an attachment to disk
cirrux attachment download <attachment-uuid> > attachment.pdf
```

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
