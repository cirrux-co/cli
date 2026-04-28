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
cirrux mailbox list                              # list mailboxes the user has access to
cirrux mailbox get <mailbox-uuid>                # mailbox metadata
cirrux mailbox labels list <mailbox-uuid>        # list system + custom labels (uuid, type, name)
```

### Thread

```bash
cirrux thread list <mailbox-uuid>                  # list threads in a mailbox
cirrux thread list <mailbox-uuid> --label inbox    # filter by label (inbox, sent, archive, drafts, trash, spam, or a label UUID)
cirrux thread list <mailbox-uuid> --limit 50       # 1-100 (default 25)
cirrux thread list <mailbox-uuid> --cursor <cur>   # pagination (cursor is in the previous response)
cirrux thread get <thread-uuid>                    # thread with all non-deleted emails (uuid, from, subject, labels, attachment counts)
cirrux thread search "<query>"                     # search threads (see Search section below)
```

### Email

```bash
cirrux email get <email-uuid>                 # email metadata (subject, from, to, labels, attachments)
cirrux email content <email-uuid> body        # rendered HTML body
cirrux email content <email-uuid> raw         # full MIME message
cirrux email search "<query>"                 # search individual emails (see Search section below)
cirrux email read <email-uuid>                # mark as read
cirrux email unread <email-uuid>              # mark as unread
cirrux email flag <email-uuid>                # flag (star) the email
cirrux email unflag <email-uuid>              # unflag (unstar) the email
cirrux email archive <email-uuid>             # archive (add archive, remove inbox)
cirrux email unarchive <email-uuid>           # move back to inbox
cirrux email trash <email-uuid>               # move to trash
cirrux email untrash <email-uuid>             # restore from trash to inbox
cirrux email spam <email-uuid>                # mark as spam
cirrux email unspam <email-uuid>              # remove from spam, back to inbox
cirrux email move <email-uuid> --type archive             # move to a system location (inbox/archive/trash/junk)
cirrux email move <email-uuid> --label-uuid <label-uuid>  # move to a custom label (only that label remains)
cirrux email labels add <email-uuid> --label-uuid <label-uuid>     # add a custom label (does not change location)
cirrux email labels remove <email-uuid> --label-uuid <label-uuid>  # remove a custom label
```

`cirrux email content` writes directly to stdout (no `--json` wrapping) so you can pipe it to a file: `cirrux email content <uuid> raw > message.eml`.

All mutations return the updated email (same shape as `cirrux email get`), so `--json` and `--quiet` behave consistently with the rest of the CLI. They're idempotent — archiving an already-archived email, or adding a label that's already present, is a no-op that still returns 200.

### Move emails between locations

**Use the verbs (`archive` / `unarchive` / `trash` / `untrash` / `spam` / `unspam` / `move`) for any inbox/archive/trash/junk transition** — they atomically swap the labels server-side so the email never ends up in two locations at once. Picking `cirrux email labels add --type archive` will be rejected with a 422 because it would leave the email in both inbox and archive.

- `archive` removes inbox, adds archive. Sent messages just lose inbox (they don't carry an archive label).
- `trash` and `spam` add the trash/junk label; the server then strips every other active label so the email has only that label. To restore, use `untrash` or `unspam`, which put it back in inbox.
- `move` is the general form: `--type inbox|archive|trash|junk` for system locations, or `--label-uuid <uuid>` to file under a custom label. After `move`, the target is the only active label on the email — every other label (system or custom) is removed.
- All verbs reject drafts (the compose API owns drafts) and `spam` rejects sent messages.

`labels add` / `labels remove` are still the right tool for custom labels and additive operations. The `--type` flag is **only** useful for `--type inbox` (re-adding inbox to an email that already has it, idempotent) — for any other type, use the verb. The system labels `sent`, `draft`, and `snoozed` are managed by other parts of the platform and the API will reject attempts to add/remove them by hand.

Thread-level versions of these verbs (`cirrux thread archive`, `cirrux thread move`, etc.) are not available yet — loop over `cirrux thread get <thread-uuid> --quiet` and apply the verb per email if you need to operate on a whole thread.

### Attachment

```bash
cirrux attachment get <attachment-uuid>                # attachment metadata (filename, content-type, size)
cirrux attachment download <attachment-uuid> > file    # raw bytes to stdout
cirrux attachment download <attachment-uuid> --json    # JSON with base64url-encoded data
```

## Search

`cirrux thread search "<query>"` and `cirrux email search "<query>"` both hit the same search engine — the difference is the grouping of results. Use `thread search` when the user cares about conversations, `email search` when they care about individual messages (e.g. "find every email with an attachment").

Both commands accept the same flags:

```bash
cirrux thread search "<query>" --mailbox-uuid <uuid>   # restrict to one mailbox
cirrux thread search "<query>" --limit 50              # 1-100 (default 25)
cirrux thread search "<query>" --cursor <cur>          # pagination cursor from the previous response
```

Supported query operators (ANDed by default, prefix with `-` to negate):

| Operator            | Example                             |
|---------------------|-------------------------------------|
| `from:`             | `from:alice@example.com`            |
| `to:` / `cc:` / `bcc:` | `to:me@example.com`              |
| `subject:`          | `subject:"quarterly review"`        |
| `body:`             | `body:invoice`                      |
| `is:read` / `is:unread` | `is:unread`                     |
| `is:starred` / `is:unstarred` | `is:starred`              |
| `is:replied`        | `is:replied`                        |
| `has:attachment`    | `has:attachment`                    |
| `in:`               | `in:inbox`, `in:sent`, `in:drafts`, `in:archive`, `in:snoozed`, `in:starred` |
| `after:` / `before:` | `after:2026-01-01 before:2026-04-01` |
| Bare term           | `invoice` (full-text)               |
| Phrase              | `"monthly report"`                  |
| Negate              | `-from:noreply@example.com`         |

Results exclude trash and junk automatically. Quote the whole query when it contains spaces or shell metacharacters: `cirrux thread search "from:alice is:unread"`.

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

**Find unread mail from a specific sender and print each body:**

```bash
cirrux thread search "from:alice@example.com is:unread" --quiet \
  | while read thread_uuid; do
      cirrux thread get "$thread_uuid" --quiet | while read email_uuid; do
        cirrux email content "$email_uuid" body
      done
    done
```

**Mark every unread email from a sender as read:**

```bash
cirrux email search "from:newsletter@example.com is:unread" --quiet \
  | xargs -I {} cirrux email read {}
```

## Tips for agents

- Always inspect `cirrux <command> --help` before guessing flags — the CLI is self-documenting and new flags land there first.
- Prefer `--json` when you need to extract specific fields, and `--quiet` when you're piping UUIDs into the next call.
- UUIDs are opaque strings — never try to construct or mutate them.
- When the user asks about "the latest email" or "this thread", resolve the UUID by listing first (e.g. `thread list --limit 1`) rather than assuming one.
- For anything finding-by-content ("emails from X", "unread invoices", "that thread about the contract"), reach for `thread search` / `email search` before listing — search is faster than paginating `thread list`.
- Mutations available today: `email read` / `unread` / `flag` / `unflag`, the move verbs (`email archive` / `unarchive` / `trash` / `untrash` / `spam` / `unspam` / `move`), and `email labels add` / `labels remove` for custom labels. Sending, replying, deleting, and snoozing are not yet exposed — say so rather than fabricating commands.
