---
name: cirrux
description: Use this skill when the user wants to interact with their Cirrux email (mailboxes, threads, emails, attachments) via the cirrux CLI. Covers authentication, output modes, exit codes, and the full command tree with composable workflows.
---

# Cirrux CLI

`cirrux` is the command-line interface for [Cirrux](https://cirrux.co) email. Use it to authenticate, browse mailboxes and threads, read individual emails, and download attachments.

## Prerequisite: check it's installed

```bash
cirrux --version
```

If the binary is missing, point the user at `brew install cirrux-co/tap/cirrux`.

## Authentication

```bash
cirrux login     # browser-based OAuth
cirrux whoami    # show current user + workspace
cirrux logout
```

Commands that hit the API fail with exit code `4` (`AUTH_REQUIRED`) when the user is not logged in. Suggest `cirrux login` in that case.

## Output modes

Every data-producing command supports three output modes:

| Flag       | Shape                                                  | Use it when                              |
|------------|--------------------------------------------------------|------------------------------------------|
| (default)  | Human-readable text to stdout                          | Showing the user a summary               |
| `--json`   | Structured JSON to stdout                              | Parsing fields programmatically          |
| `--quiet`  | Bare identifier(s) to stdout, one per line             | Piping UUIDs into another `cirrux` call  |

`stderr` is always for diagnostics and errors; `stdout` is always for data. You can rely on this.

## Exit codes

| Code | Meaning                              |
|------|--------------------------------------|
| 0    | Success                              |
| 1    | General / unexpected failure         |
| 2    | Bad arguments or usage               |
| 3    | Resource not found                   |
| 4    | Not logged in / permission denied    |
| 5    | Resource already exists (conflict)   |

Check the exit code when scripting — don't grep error text.

## Command tree

Discover everything with `cirrux --help` and `cirrux <noun> --help`. The stable surface today is:

### Mailbox

```bash
cirrux mailbox list                    # list mailboxes the user has access to
cirrux mailbox get <mailbox-uuid>      # mailbox metadata
```

### Thread

```bash
cirrux thread list <mailbox-uuid>                  # list threads in a mailbox
cirrux thread list <mailbox-uuid> --label inbox    # filter by label (inbox, sent, archive, drafts, trash, spam, or a label UUID)
cirrux thread list <mailbox-uuid> --limit 50       # 1-100 (default 25)
cirrux thread list <mailbox-uuid> --cursor <cur>   # pagination (cursor is in the previous response)
cirrux thread get <thread-uuid>                    # thread with all non-deleted emails (uuid, from, subject, labels, attachment counts)
```

### Email

```bash
cirrux email get <email-uuid>                 # email metadata (subject, from, to, labels, attachments)
cirrux email content <email-uuid> body        # rendered HTML body
cirrux email content <email-uuid> raw         # full MIME message
```

`cirrux email content` writes directly to stdout (no `--json` wrapping) so you can pipe it to a file: `cirrux email content <uuid> raw > message.eml`.

### Attachment

```bash
cirrux attachment get <attachment-uuid>                # attachment metadata (filename, content-type, size)
cirrux attachment download <attachment-uuid> > file    # raw bytes to stdout
cirrux attachment download <attachment-uuid> --json    # JSON with base64url-encoded data
```

## Common workflows

**Show the latest inbox threads for the user's first mailbox:**

```bash
mb=$(cirrux mailbox list --quiet | head -1)
cirrux thread list "$mb" --label inbox --limit 10
```

**Read the full body of every email in a thread:**

```bash
cirrux thread get <thread-uuid> --quiet | while read email_uuid; do
  cirrux email content "$email_uuid" body
done
```

**Save every attachment from an email:**

```bash
cirrux email get <email-uuid> --json \
  | jq -r '.attachments[] | "\(.uuid)\t\(.filename)"' \
  | while IFS=$'\t' read uuid name; do
      cirrux attachment download "$uuid" > "$name"
    done
```

## Tips for agents

- Always inspect `cirrux <command> --help` before guessing flags — the CLI is self-documenting and new flags land there first.
- Prefer `--json` when you need to extract specific fields, and `--quiet` when you're piping UUIDs into the next call.
- UUIDs are opaque strings — never try to construct or mutate them.
- When the user asks about "the latest email" or "this thread", resolve the UUID by listing first (e.g. `thread list --limit 1`) rather than assuming one.
- The API is read-only today (no send/reply/delete commands). If a user asks for mutations, say so rather than fabricating commands.
