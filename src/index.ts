#!/usr/bin/env node

import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { mailboxListCommand } from './commands/mailbox/list.js'
import { mailboxGetCommand } from './commands/mailbox/get.js'
import { threadListCommand } from './commands/thread/list.js'
import { threadGetCommand } from './commands/thread/get.js'
import { emailGetCommand } from './commands/email/get.js'
import { emailContentCommand } from './commands/email/content.js'
import { attachmentGetCommand } from './commands/attachment/get.js'
import { attachmentDownloadCommand } from './commands/attachment/download.js'
import { whoamiCommand } from './commands/whoami.js'
import { installSkillCommand, printSkillCommand } from './commands/install-skill.js'
import { checkForUpdate } from './update-check.js'
import { CLI_VERSION } from './version.js'

const program = new Command()

program
  .name('cirrux')
  .description('Cirrux CLI')
  .version(CLI_VERSION)

program
  .command('login')
  .description('Authenticate with Cirrux via browser')
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
