#!/usr/bin/env node

import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { mailboxListCommand } from './commands/mailbox/list.js'
import { mailboxGetCommand } from './commands/mailbox/get.js'
import { whoamiCommand } from './commands/whoami.js'
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

program.parse()

await checkForUpdate(CLI_VERSION)
