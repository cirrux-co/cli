#!/usr/bin/env node

import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { whoamiCommand } from './commands/whoami.js'

declare const CLI_VERSION: string

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
  .command('whoami')
  .description('Show current user and workspace')
  .action(whoamiCommand)

program.parse()
