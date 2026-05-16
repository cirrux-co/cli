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

## Attribution

When invoked from inside Claude Code, the CLI auto-detects the `CLAUDECODE=1` environment variable and tags every mutation with co-author `claude` — no action needed from you. This shows up in the user's activity feed so they can tell which actions came from you (vs. their own).

If you need to override (e.g. tagging as a different agent), pass `--co-author <name>` on any command:

```bash
cirrux --co-author claude-reviewer email archive <uuid>
```

The `CIRRUX_CO_AUTHOR` env var also works as a fallback for non-Claude automation. Order of precedence: `--co-author` flag → `CIRRUX_CO_AUTHOR` env var → auto-detected `claude`.

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
cirrux thread search "<query>" --mailbox-uuid <uuid>  # search threads in one mailbox (preferred — see Search section)
cirrux thread search "<query>"                         # cross-mailbox search (use only when the user hasn't narrowed to one)
```

### Email

```bash
cirrux email get <email-uuid>                 # email metadata (subject, from, to, labels, attachments)
cirrux email content <email-uuid> body        # rendered HTML body
cirrux email content <email-uuid> raw         # full MIME message
cirrux email search "<query>" --mailbox-uuid <uuid>  # search one mailbox (preferred — see Search section)
cirrux email search "<query>"                         # cross-mailbox search (use only when the user hasn't narrowed to one)
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

### Draft

```bash
# MIME mode — caller assembles the full RFC 5322 message
cirrux draft create --mailbox-uuid <mailbox-uuid> --file message.eml   # create from a .eml file
cat message.eml | cirrux draft create --mailbox-uuid <mailbox-uuid>    # create from stdin
cirrux draft create --mailbox-uuid <mailbox-uuid> --file reply.eml --in-reply-to <email-uuid>  # link as a reply

# Markdown mode — caller supplies a markdown body and structured headers
cirrux draft create --mailbox-uuid <mailbox-uuid> --markdown body.md --subject "Hi" --to alice@example.com
cirrux draft create --mailbox-uuid <mailbox-uuid> --markdown body.md \
  --to "Alice <alice@example.com>" --cc bob@example.com --bcc carol@example.com

cirrux draft delete <draft-uuid>                                       # delete a draft
cirrux draft send <draft-uuid>                                         # send a draft immediately
```

`draft create` accepts the body in two mutually-exclusive shapes:

- **`--file` / stdin** — a full RFC 5322 MIME message (headers + blank line + body). The `From:` header must be one of the mailbox's configured addresses (or its primary address); the API rejects spoofed senders with 422.
- **`--markdown <path>`** — a markdown file used as the draft body. Headers come from `--subject`, `--to`, `--cc`, `--bcc` (each address is repeatable, `Name <addr>` or just `addr`). The backend renders markdown to HTML via Kramdown (defaults), converts to the editor's structured body format, and synthesizes the MIME — `From:` is set to the mailbox's primary address automatically. Bcc is preserved on the draft record but stripped from the rendered MIME, matching webmail compose behavior.

Supply `--in-reply-to <email-uuid>` (in either mode) to link the draft to a parent email — it must belong to the same workspace. The response is the new draft (uuid, headers, body_html, body_text, labels include `draft`).

`draft delete` returns 204 with no body. Deleting an email that isn't a draft returns 422 (`not_a_draft`); deleting a non-existent draft returns 404.

`draft send` requires the `email.send` OAuth scope (separate from `email.write`) — if the CLI was logged in before send was supported, run `cirrux logout && cirrux login` to re-grant. The response is the resulting email (no longer a draft: `sent` label applied, `draft` label removed). The draft must have at least one recipient; sending one with no `To`/`Cc`/`Bcc` returns 422 (`invalid_value`). Sending a non-draft returns 422 (`not_a_draft`); a draft with a future `send_draft_at` already scheduled returns 422 (`already_scheduled`).

### Attachment

```bash
cirrux attachment get <attachment-uuid>                # attachment metadata (filename, content-type, size)
cirrux attachment download <attachment-uuid> > file    # raw bytes to stdout
cirrux attachment download <attachment-uuid> --json    # JSON with base64url-encoded data
```

## Search

`cirrux thread search "<query>"` and `cirrux email search "<query>"` both hit the same search engine — the difference is the grouping of results. Use `thread search` when the user cares about conversations, `email search` when they care about individual messages (e.g. "find every email with an attachment").

**Scope every search you can.** When the user mentions a mailbox (by address, alias, or any identifier in the request), resolve it via `cirrux mailbox list` and pass `--mailbox-uuid <uuid>` on the search. Unscoped search returns results across every mailbox the user can access — fine for genuinely cross-mailbox queries ("everything unread from Alice"), but noise when the user clearly meant one inbox.

```bash
cirrux thread search "<query>" --mailbox-uuid <uuid>   # restrict to one mailbox (preferred)
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

**Find a single email by subject in a specific mailbox and apply a verb:**

```bash
# Resolve the mailbox UUID (look it up by address, not by guessing).
mb=$(cirrux mailbox list --json | jq -r '.data[] | select(.primary_address == "demo@example.com") | .uuid')

# Scope the search to that mailbox and require it's still in the inbox.
uuid=$(cirrux email search "subject:\"welcome\" in:inbox" --mailbox-uuid "$mb" --quiet | head -1)

# Apply a verb (archive, trash, spam, untrash, unspam, unarchive, or move).
cirrux email archive "$uuid"
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

**Compose and send a reply to an email:**

```bash
parent="<email-uuid>"
mb=$(cirrux email get "$parent" --json | jq -r '.mailbox_uuid')

draft=$(cat <<EOF | cirrux draft create --mailbox-uuid "$mb" --in-reply-to "$parent" --quiet
From: me@example.com
To: alice@example.com
Subject: Re: Quarterly review
In-Reply-To: <$parent>

Thanks Alice — let's circle back next week.
EOF
)

cirrux draft send "$draft"
```

Drop the final `cirrux draft send` if you want to leave the draft for the user to review and send themselves.

**Same reply via markdown mode (no MIME assembly required):**

```bash
parent="<email-uuid>"
mb=$(cirrux email get "$parent" --json | jq -r '.mailbox_uuid')
to=$(cirrux email get "$parent" --json | jq -r '.from[0].address')

cat > /tmp/reply.md <<'EOF'
Thanks Alice — let's **circle back** next week.

A few quick thoughts:
- The Q1 numbers look solid
- I'll send the deck on Monday
EOF

cirrux draft create --mailbox-uuid "$mb" --in-reply-to "$parent" \
  --markdown /tmp/reply.md \
  --subject "Re: Quarterly review" \
  --to "$to"
```

## Tips for agents

- Always inspect `cirrux <command> --help` before guessing flags — the CLI is self-documenting and new flags land there first.
- Prefer `--json` when you need to extract specific fields, and `--quiet` when you're piping UUIDs into the next call.
- UUIDs are opaque strings — never try to construct or mutate them.
- When the user asks about "the latest email" or "this thread", resolve the UUID by listing first (e.g. `thread list --limit 1`) rather than assuming one.
- For anything finding-by-content ("emails from X", "unread invoices", "that thread about the contract"), reach for `thread search` / `email search` before listing — search is faster than paginating `thread list`.
- **Resolve the mailbox before searching.** When the user names a mailbox (an address, an alias, or any identifier in their request), run `cirrux mailbox list` first and pass `--mailbox-uuid <uuid>` on every subsequent search. Unscoped search across mailboxes the user can access wastes a call and returns noise. The only time to skip this is when the user explicitly asks across mailboxes ("anything unread anywhere from Alice").
- Mutations available today: `email read` / `unread` / `flag` / `unflag`, the move verbs (`email archive` / `unarchive` / `trash` / `untrash` / `spam` / `unspam` / `move`), `email labels add` / `labels remove` for custom labels, and `draft create` / `draft delete` / `draft send` for drafts. Snoozing is not yet exposed — say so rather than fabricating commands.
