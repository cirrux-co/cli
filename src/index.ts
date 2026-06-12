#!/usr/bin/env node

import { Command } from 'commander'
import { setExplicitCoAuthor } from './api.js'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { mailboxListCommand } from './commands/mailbox/list.js'
import { mailboxGetCommand } from './commands/mailbox/get.js'
import { mailboxLabelsListCommand } from './commands/mailbox/labels.js'
import { threadListCommand } from './commands/thread/list.js'
import { threadGetCommand } from './commands/thread/get.js'
import { threadSearchCommand } from './commands/thread/search.js'
import { emailGetCommand } from './commands/email/get.js'
import { emailContentCommand } from './commands/email/content.js'
import { emailSearchCommand } from './commands/email/search.js'
import {
  emailReadCommand,
  emailUnreadCommand,
  emailFlagCommand,
  emailUnflagCommand,
} from './commands/email/update.js'
import {
  emailLabelsAddCommand,
  emailLabelsRemoveCommand,
} from './commands/email/labels.js'
import {
  emailArchiveCommand,
  emailUnarchiveCommand,
  emailTrashCommand,
  emailUntrashCommand,
  emailSpamCommand,
  emailUnspamCommand,
  emailMoveCommand,
} from './commands/email/transitions.js'
import { collectAddress, draftCreateCommand } from './commands/draft/create.js'
import { draftDeleteCommand } from './commands/draft/delete.js'
import { draftSendCommand } from './commands/draft/send.js'
import { attachmentGetCommand } from './commands/attachment/get.js'
import { attachmentDownloadCommand } from './commands/attachment/download.js'
import { driveListCommand } from './commands/drive/list.js'
import { driveGetCommand } from './commands/drive/get.js'
import { driveDownloadCommand } from './commands/drive/download.js'
import { driveUploadCommand } from './commands/drive/upload.js'
import { driveTrashCommand } from './commands/drive/trash.js'
import { driveDeleteCommand } from './commands/drive/delete.js'
import { whoamiCommand } from './commands/whoami.js'
import { installSkillCommand, printSkillCommand } from './commands/install-skill.js'
import { checkForUpdate } from './update-check.js'
import { CLI_VERSION } from './version.js'

const program = new Command()

program
  .name('cirrux')
  .description('Cirrux CLI')
  .version(CLI_VERSION)
  .option(
    '--co-author <name>',
    'Tag mutations with a co-author (overrides CIRRUX_CO_AUTHOR; auto-set to "claude" inside Claude Code)',
  )
  .hook('preAction', (thisCommand) => {
    setExplicitCoAuthor(thisCommand.opts().coAuthor as string | undefined)
  })

program
  .command('login')
  .description('Authenticate with Cirrux via browser')
  .option('--no-browser', 'Sign in without a local browser (for headless/remote machines)')
  .action(loginCommand)

program
  .command('logout')
  .description('Log out of the current workspace')
  .action(logoutCommand)

program
  .command('whoami')
  .description('Show current user and workspace')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the username (for piping)')
  .action(whoamiCommand)

const mailbox = program
  .command('mailbox')
  .description('Manage mailboxes')

mailbox
  .command('list')
  .description('List your mailboxes')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only mailbox IDs, one per line (for piping)')
  .action(mailboxListCommand)

mailbox
  .command('get')
  .description('Get details for a mailbox')
  .argument('<id>', 'Mailbox ID (UUID)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the mailbox ID (for piping)')
  .action(mailboxGetCommand)

const mailboxLabels = mailbox
  .command('labels')
  .description('Manage labels for a mailbox')

mailboxLabels
  .command('list')
  .description('List labels (system + custom) for a mailbox')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only label UUIDs, one per line (for piping)')
  .action(mailboxLabelsListCommand)

const thread = program
  .command('thread')
  .description('Manage email threads')

thread
  .command('list')
  .description('List threads for a mailbox')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .option('--limit <n>', 'Number of threads to return (1-100)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--label <label>', 'Filter by label (e.g. inbox, sent, archive)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only thread UUIDs, one per line (for piping)')
  .action(threadListCommand)

thread
  .command('get')
  .description('Get a thread with its non-deleted emails')
  .argument('<uuid>', 'Thread UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUIDs, one per line (for piping)')
  .action(threadGetCommand)

thread
  .command('search')
  .description('Search threads across the user\'s mailboxes')
  .argument('<query>', 'Search query (e.g. "from:alice is:unread subject:\\"quarterly review\\"")')
  .option('--mailbox-uuid <uuid>', 'Restrict results to a single mailbox')
  .option('--limit <n>', 'Number of threads to return (1-100, default 25)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only thread UUIDs, one per line (for piping)')
  .action(threadSearchCommand)

const email = program
  .command('email')
  .description('Manage emails')

email
  .command('get')
  .description('Get email metadata')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailGetCommand)

email
  .command('content')
  .description('Get email content (raw MIME or HTML body)')
  .argument('<uuid>', 'Email UUID')
  .argument('<format>', 'Content format: "raw" or "body"')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the content (for piping)')
  .action(emailContentCommand)

email
  .command('search')
  .description('Search individual emails across the user\'s mailboxes')
  .argument('<query>', 'Search query (e.g. "has:attachment after:2026-01-01")')
  .option('--mailbox-uuid <uuid>', 'Restrict results to a single mailbox')
  .option('--limit <n>', 'Number of emails to return (1-100, default 25)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only email UUIDs, one per line (for piping)')
  .action(emailSearchCommand)

email
  .command('read')
  .description('Mark an email as read')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailReadCommand)

email
  .command('unread')
  .description('Mark an email as unread')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailUnreadCommand)

email
  .command('flag')
  .description('Flag an email')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailFlagCommand)

email
  .command('unflag')
  .description('Unflag an email')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailUnflagCommand)

email
  .command('archive')
  .description('Archive an email (add archive, remove inbox)')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailArchiveCommand)

email
  .command('unarchive')
  .description('Move an email back to the inbox')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailUnarchiveCommand)

email
  .command('trash')
  .description('Move an email to the trash')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailTrashCommand)

email
  .command('untrash')
  .description('Restore an email from the trash to the inbox')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailUntrashCommand)

email
  .command('spam')
  .description('Mark an email as spam')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailSpamCommand)

email
  .command('unspam')
  .description('Remove an email from spam (back to inbox)')
  .argument('<uuid>', 'Email UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailUnspamCommand)

email
  .command('move')
  .description('Move an email to a target label (system type or custom label)')
  .argument('<uuid>', 'Email UUID')
  .option('--type <type>', 'System label type (inbox, archive, trash, junk)')
  .option('--label-uuid <uuid>', 'Custom label UUID (from `cirrux mailbox labels list`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailMoveCommand)

const emailLabels = email
  .command('labels')
  .description('Add or remove labels on an email (use email archive/trash/move for system locations)')

emailLabels
  .command('add')
  .description('Add a label to an email (idempotent)')
  .argument('<uuid>', 'Email UUID')
  .option('--type <type>', 'System label type (inbox, archive, trash, junk)')
  .option('--label-uuid <uuid>', 'Custom label UUID (from `cirrux mailbox labels list`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailLabelsAddCommand)

emailLabels
  .command('remove')
  .description('Remove a label from an email (idempotent)')
  .argument('<uuid>', 'Email UUID')
  .option('--type <type>', 'System label type (inbox, archive, trash, junk)')
  .option('--label-uuid <uuid>', 'Custom label UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the email UUID (for piping)')
  .action(emailLabelsRemoveCommand)

const draft = program
  .command('draft')
  .description('Manage email drafts')

draft
  .command('create')
  .description('Create a draft from MIME (file/stdin) or markdown with structured headers')
  .requiredOption('--mailbox-uuid <uuid>', 'Mailbox the draft belongs to')
  .option('--file <path>', 'Path to a .eml file containing the MIME message (read from stdin if omitted)')
  .option('--markdown <path>', 'Path to a markdown file used as the draft body (mutually exclusive with --file)')
  .option('--subject <subject>', 'Subject line (markdown mode only)')
  .option('--to <addr>', '`Name <addr>` or `addr` (repeatable, markdown mode only)', collectAddress, [])
  .option('--cc <addr>', '`Name <addr>` or `addr` (repeatable, markdown mode only)', collectAddress, [])
  .option('--bcc <addr>', '`Name <addr>` or `addr` (repeatable, markdown mode only)', collectAddress, [])
  .option('--in-reply-to <email-uuid>', 'Link this draft as a reply to an existing email')
  .option(
    '--no-quote-original',
    'Do not quote the original email below your reply (markdown replies quote it by default)',
  )
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new draft UUID (for piping)')
  .action(draftCreateCommand)

draft
  .command('delete')
  .description('Delete a draft')
  .argument('<uuid>', 'Draft UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted draft UUID (for piping)')
  .action(draftDeleteCommand)

draft
  .command('send')
  .description('Send a draft')
  .argument('<uuid>', 'Draft UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the sent email UUID (for piping)')
  .action(draftSendCommand)

const attachment = program
  .command('attachment')
  .description('Manage email attachments')

attachment
  .command('get')
  .description('Get attachment metadata')
  .argument('<uuid>', 'Attachment UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the attachment UUID (for piping)')
  .action(attachmentGetCommand)

attachment
  .command('download')
  .description('Download attachment content')
  .argument('<uuid>', 'Attachment UUID')
  .option('--json', 'Output as JSON (base64url-encoded data)')
  .option('--quiet', 'Output only the base64url-encoded data (for piping)')
  .action(attachmentDownloadCommand)

const drive = program
  .command('drive')
  .description('Manage Drive folders and files')

drive
  .command('list')
  .description('List folders and files in a folder (or the root)')
  .argument('[folder-uuid]', 'Folder UUID to list (omit for the root)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only folder/file UUIDs, one per line (for piping)')
  .action(driveListCommand)

drive
  .command('get')
  .description('Get metadata for a file')
  .argument('<uuid>', 'Drive file UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the file UUID (for piping)')
  .action(driveGetCommand)

drive
  .command('download')
  .description('Download a file (writes raw bytes to stdout — pipe to a file with `> out`)')
  .argument('<uuid>', 'Drive file UUID')
  .option('--json', 'Output as JSON (base64url-encoded data)')
  .option('--quiet', 'Output only the base64url-encoded data (for piping)')
  .action(driveDownloadCommand)

drive
  .command('upload')
  .description('Upload a file (100 MB max)')
  .argument('[folder-uuid]', 'Destination folder UUID (omit to upload to the root)')
  .requiredOption('--file <path>', 'Path to the file to upload')
  .option('--name <name>', 'Override the stored filename (defaults to the file basename)')
  .option('--content-type <type>', 'MIME type (defaults to application/octet-stream)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new file UUID (for piping)')
  .action(driveUploadCommand)

drive
  .command('trash')
  .description('Move a file to the trash (reversible, idempotent)')
  .argument('<uuid>', 'Drive file UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the file UUID (for piping)')
  .action(driveTrashCommand)

drive
  .command('delete')
  .description('Delete a file (idempotent)')
  .argument('<uuid>', 'Drive file UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted file UUID (for piping)')
  .action(driveDeleteCommand)

const skill = program
  .command('skill')
  .description('Agent skill for Cirrux — makes AI coding assistants fluent in this CLI')

skill
  .command('install')
  .description('Install the Cirrux skill into your Claude Code config')
  .option('--project', 'Install into ./.claude/skills/cirrux/ instead of ~/.claude/skills/cirrux/')
  .option('--force', 'Overwrite an existing skill file')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the installed path (for piping)')
  .action(installSkillCommand)

skill
  .command('print')
  .description('Print the bundled SKILL.md contents to stdout')
  .option('--json', 'Wrap the content in a JSON object')
  .option('--quiet', 'Alias for printing the raw content')
  .action(printSkillCommand)

program.parse()

await checkForUpdate(CLI_VERSION)
