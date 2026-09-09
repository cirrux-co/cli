#!/usr/bin/env node

import { Command } from 'commander'
import { setExplicitCoAuthor } from './api.js'
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { mailboxListCommand } from './commands/mailbox/list.js'
import { mailboxGetCommand } from './commands/mailbox/get.js'
import {
  mailboxLabelsCreateCommand,
  mailboxLabelsDeleteCommand,
  mailboxLabelsListCommand,
  mailboxLabelsUpdateCommand,
} from './commands/mailbox/labels.js'
import {
  mailboxFiltersCreateCommand,
  mailboxFiltersDeleteCommand,
  mailboxFiltersGetCommand,
  mailboxFiltersListCommand,
  mailboxFiltersUpdateCommand,
} from './commands/mailbox/filters.js'
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
import { driveReplaceCommand } from './commands/drive/replace.js'
import { driveTrashCommand } from './commands/drive/trash.js'
import { driveDeleteCommand } from './commands/drive/delete.js'
import { driveRenameCommand } from './commands/drive/rename.js'
import { driveMoveCommand } from './commands/drive/move.js'
import { driveFolderCreateCommand } from './commands/drive/folder/create.js'
import { driveFolderGetCommand } from './commands/drive/folder/get.js'
import { driveFolderRenameCommand } from './commands/drive/folder/rename.js'
import { driveFolderMoveCommand } from './commands/drive/folder/move.js'
import { driveFolderTrashCommand } from './commands/drive/folder/trash.js'
import { driveFolderDeleteCommand } from './commands/drive/folder/delete.js'
import { driveShareCreateCommand } from './commands/drive/share/create.js'
import { driveShareGetCommand } from './commands/drive/share/get.js'
import { driveShareRevokeCommand } from './commands/drive/share/revoke.js'
import { calendarListCommand } from './commands/calendar/list.js'
import { calendarEventsListCommand } from './commands/calendar/events/list.js'
import { calendarEventsCreateCommand } from './commands/calendar/events/create.js'
import { calendarEventsUpdateCommand } from './commands/calendar/events/update.js'
import { calendarEventsDeleteCommand } from './commands/calendar/events/delete.js'
import { contactsAddressbooksCommand } from './commands/contacts/addressbooks.js'
import { contactsListCommand } from './commands/contacts/list.js'
import { contactsGetCommand } from './commands/contacts/get.js'
import { contactsSearchCommand } from './commands/contacts/search.js'
import { whoamiCommand } from './commands/whoami.js'
import { feedbackCommand } from './commands/feedback.js'
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
  .option('--json', 'Emit machine-readable JSON events (device code, then result) on stdout')
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

program
  .command('feedback')
  .description('Send feedback about Cirrux or this CLI to the team')
  .argument('[message]', 'Your feedback (omit to read it from stdin)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only "ok" on success (for piping)')
  .action(feedbackCommand)

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

mailboxLabels
  .command('create')
  .description('Create a custom label for a mailbox')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .requiredOption('--name <name>', 'Label name')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new label UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux mailbox labels create <mailbox-uuid> --name "Receipts"')
  .action(mailboxLabelsCreateCommand)

mailboxLabels
  .command('update')
  .description('Rename a custom label (system labels cannot be changed)')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .argument('<label-uuid>', 'Label UUID (from `cirrux mailbox labels list`)')
  .requiredOption('--name <name>', 'New label name')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the label UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux mailbox labels update <mailbox-uuid> <label-uuid> --name "Invoices"')
  .action(mailboxLabelsUpdateCommand)

mailboxLabels
  .command('delete')
  .description('Delete a custom label (system labels cannot be deleted)')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .argument('<label-uuid>', 'Label UUID (from `cirrux mailbox labels list`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted label UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux mailbox labels delete <mailbox-uuid> <label-uuid>')
  .action(mailboxLabelsDeleteCommand)

const mailboxFilters = mailbox
  .command('filters')
  .description('Manage email filter rules for a mailbox')

const conditionAstHelp =
  'condition_ast node types: and/or ({"children":[...]}), not ({"child":{}}), ' +
  'contains/equals ({"field","value"}; contains fields: from,to,cc,bcc,subject,body,message_id,text; ' +
  'equals fields: from,to,cc,bcc,subject,body), dateafter/datebefore ({"field":"received_at"|"created_at","value":"<date>"}), ' +
  'flag ({"field":"seen"|"answered"|"flagged"|"deleted","value":<bool>}), all, ' +
  'hasattachment/isreply/fromcontact ({"value":<bool>}), sizegreaterthan/sizelessthan ({"bytes":<int>}), ' +
  'fromcontactgroup ({"contact_group_uuid":"..."}).\n' +
  'action types: add_label ({"label_uuid"}), skip_inbox, mark_read (opt value), flag (opt value), ' +
  'archive, delete, forward ({"forwarding_address_uuid"}), never_mark_as_spam.'

mailboxFilters
  .command('list')
  .description('List filter rules for a mailbox (ordered by priority)')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only filter UUIDs, one per line (for piping)')
  .action(mailboxFiltersListCommand)

mailboxFilters
  .command('get')
  .description('Show a single filter rule, including its full condition_ast and actions')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .argument('<filter-uuid>', 'Filter UUID (from `cirrux mailbox filters list`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the filter UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux mailbox filters get <mailbox-uuid> <filter-uuid> --json')
  .action(mailboxFiltersGetCommand)

mailboxFilters
  .command('create')
  .description('Create a filter rule for a mailbox')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .requiredOption('--name <name>', 'Filter name')
  .requiredOption('--condition-ast <json>', 'Condition tree as JSON')
  .option('--actions <json>', 'Actions as a JSON array (default [])')
  .option('--description <text>', 'Optional description')
  .option('--status <status>', 'active or inactive (default active)')
  .option('--priority <n>', 'Priority integer; lower runs first (default 0)')
  .option('--stop-processing', 'Stop evaluating further rules once this one matches')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new filter UUID (for piping)')
  .addHelpText(
    'after',
    '\nExample:\n' +
      '  $ cirrux mailbox filters create <mailbox-uuid> \\\n' +
      '      --name "Invoices" \\\n' +
      '      --condition-ast \'{"type":"contains","field":"from","value":"@billing.example.com"}\' \\\n' +
      '      --actions \'[{"type":"add_label","label_uuid":"<label-uuid>"},{"type":"skip_inbox"}]\'\n\n' +
      conditionAstHelp,
  )
  .action(mailboxFiltersCreateCommand)

mailboxFilters
  .command('update')
  .description('Update a filter rule (send only the fields you want to change)')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .argument('<filter-uuid>', 'Filter UUID (from `cirrux mailbox filters list`)')
  .option('--name <name>', 'New name')
  .option('--condition-ast <json>', 'New condition tree as JSON')
  .option('--actions <json>', 'New actions as a JSON array')
  .option('--description <text>', 'New description')
  .option('--status <status>', 'active or inactive')
  .option('--priority <n>', 'Priority integer; lower runs first')
  .option('--stop-processing', 'Stop evaluating further rules once this one matches')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the filter UUID (for piping)')
  .addHelpText(
    'after',
    '\nExample:\n  $ cirrux mailbox filters update <mailbox-uuid> <filter-uuid> --status inactive\n\n' +
      conditionAstHelp,
  )
  .action(mailboxFiltersUpdateCommand)

mailboxFilters
  .command('delete')
  .description('Delete a filter rule')
  .argument('<mailbox-uuid>', 'Mailbox UUID')
  .argument('<filter-uuid>', 'Filter UUID (from `cirrux mailbox filters list`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted filter UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux mailbox filters delete <mailbox-uuid> <filter-uuid>')
  .action(mailboxFiltersDeleteCommand)

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

const calendar = program
  .command('calendar')
  .description('Read and change calendars and their events')

calendar
  .command('list')
  .description('List calendars the user can see')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only calendar UUIDs, one per line (for piping)')
  .action(calendarListCommand)

const calendarEvents = calendar
  .command('events')
  .description('Read and change events on a calendar')

calendarEvents
  .command('list')
  .description('List events in a time window, with recurring series expanded into occurrences')
  .argument('<calendar-uuid>', 'Calendar UUID (from `cirrux calendar list`)')
  .option('--today', "Just today, in the window's timezone (not the next 24 hours)")
  .option('--on <date>', 'Just one calendar day, as YYYY-MM-DD')
  .option('--from <date>', 'Start of the window (ISO-8601 or YYYY-MM-DD). Defaults to now')
  .option('--to <date>', 'End of the window (ISO-8601 or YYYY-MM-DD). Defaults to 31 days after --from')
  .option('--days <n>', 'Window length in days from --from. Alternative to --to')
  .option('--timezone <tz>', "IANA timezone for the window and all-day events (default: the user's own)")
  .option('--limit <n>', 'Occurrences per page, 1-2500 (default 250)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only occurrence IDs, one per line (for piping)')
  .action(calendarEventsListCommand)

calendarEvents
  .command('create')
  .description('Create an event')
  .argument('<calendar-uuid>', 'Calendar UUID (from `cirrux calendar list`)')
  .requiredOption('--title <title>', 'Event title')
  .requiredOption('--start <when>', 'Start: 2026-09-02T09:00 (timed) or 2026-09-02 (with --all-day)')
  .requiredOption('--end <when>', 'End. For an all-day event this date is EXCLUSIVE')
  .option('--all-day', 'All-day event; --start and --end are YYYY-MM-DD dates')
  .option('--timezone <iana>', "IANA timezone for a timed event. Defaults to this machine's")
  .option('--location <location>', 'Where it happens')
  .option('--description <text>', 'Longer description')
  .option('--url <url>', 'Associated URL')
  .option('--transparency <value>', 'Busy or free: opaque | transparent')
  .option('--recurrence <rrule>', 'Repeat rule, e.g. "FREQ=WEEKLY;BYDAY=WE"')
  .option('--attendee <email...>', 'Guest, as an email or "Name <email>". Guests are emailed an invite')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new event ID (for piping)')
  .addHelpText(
    'after',
    '\nExamples:\n' +
      '  $ cirrux calendar events create <calendar-uuid> --title "Coffee" \\\n' +
      '      --start 2026-09-02T10:00 --end 2026-09-02T10:30\n' +
      '  $ cirrux calendar events create <calendar-uuid> --title "Offsite" --all-day \\\n' +
      '      --start 2026-09-02 --end 2026-09-04   # end date is exclusive\n' +
      '  $ cirrux calendar events create <calendar-uuid> --title "Standup" \\\n' +
      '      --start 2026-09-02T09:00 --end 2026-09-02T09:15 --recurrence "FREQ=WEEKLY;BYDAY=WE"',
  )
  .action(calendarEventsCreateCommand)

calendarEvents
  .command('update')
  .description('Change an event, or one occurrence of a repeating one')
  .argument('<calendar-uuid>', 'Calendar UUID (from `cirrux calendar list`)')
  .argument(
    '<event-id>',
    'Event UUID for the whole event, or an occurrence ID from `events list` for just that one',
  )
  .option('--title <title>', 'Event title')
  .option('--start <when>', 'New start. Must be given together with --end')
  .option('--end <when>', 'New end. Must be given together with --start')
  .option('--all-day', 'Make it all-day; --start and --end are YYYY-MM-DD dates')
  .option('--timezone <iana>', "IANA timezone for a timed event. Defaults to this machine's")
  .option('--location <location>', 'Where it happens')
  .option('--description <text>', 'Longer description')
  .option('--url <url>', 'Associated URL')
  .option('--transparency <value>', 'Busy or free: opaque | transparent')
  .option('--recurrence <rrule>', 'Repeat rule. Pass "" to stop it repeating')
  .option('--attendee <email...>', 'Replace the whole guest list with these people')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the event ID (for piping)')
  .addHelpText(
    'after',
    '\nThe ID decides the scope: an event UUID changes the whole event (every occurrence, if it\n' +
      'repeats), while an occurrence ID changes only that one and splits it out of the series.\n' +
      '\nExamples:\n' +
      '  $ cirrux calendar events update <calendar-uuid> <event-uuid> --location "Room 2"\n' +
      '  $ cirrux calendar events update <calendar-uuid> <uuid>_20260909T070000Z --title "Long standup"',
  )
  .action(calendarEventsUpdateCommand)

calendarEvents
  .command('delete')
  .description('Delete an event, or cancel one occurrence of a repeating one')
  .argument('<calendar-uuid>', 'Calendar UUID (from `cirrux calendar list`)')
  .argument(
    '<event-id>',
    'Event UUID for the whole event, or an occurrence ID from `events list` for just that one',
  )
  .option('--yes', 'Skip the confirmation prompt (required when not running in a terminal)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted event ID (for piping)')
  .addHelpText(
    'after',
    '\nGuests are emailed a cancellation, so this confirms first unless --yes is passed.\n' +
      '\nExamples:\n' +
      '  $ cirrux calendar events delete <calendar-uuid> <event-uuid> --yes\n' +
      '  $ cirrux calendar events delete <calendar-uuid> <uuid>_20260909T070000Z --yes',
  )
  .action(calendarEventsDeleteCommand)

const contacts = program
  .command('contacts')
  .description('Browse and look up contacts')

contacts
  .command('addressbooks')
  .description('List your addressbooks (a contact lives in one)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only addressbook UUIDs, one per line (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux contacts addressbooks')
  .action(contactsAddressbooksCommand)

contacts
  .command('list')
  .description('List the contacts in one addressbook')
  .argument('<addressbook-uuid>', 'Addressbook UUID (from `cirrux contacts addressbooks`)')
  .option('--limit <n>', 'Contacts per page, 1-100 (default 25)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only contact UUIDs, one per line (for piping)')
  .addHelpText(
    'after',
    '\nExample:\n  $ cirrux contacts list $(cirrux contacts addressbooks --quiet | head -1)',
  )
  .action(contactsListCommand)

contacts
  .command('search')
  .description('Search contacts by name, company or email address')
  .argument('<query>', 'Search term, matched anywhere in the field')
  .option('--addressbook-uuid <uuid>', 'Only contacts in this addressbook')
  .option('--limit <n>', 'Contacts per page, 1-100 (default 25)')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only contact UUIDs, one per line (for piping)')
  .addHelpText(
    'after',
    '\nExamples:\n' +
      '  $ cirrux contacts search "acme"\n' +
      '  $ cirrux contacts search "jane" --addressbook-uuid <addressbook-uuid> --json\n' +
      '  $ cirrux contacts search "acme" --quiet | head -1 | xargs cirrux contacts get',
  )
  .action(contactsSearchCommand)

contacts
  .command('get')
  .description('Show one contact with its email addresses and phone numbers')
  .argument('<uuid>', 'Contact UUID (from `cirrux contacts search`)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the contact UUID (for piping)')
  .addHelpText('after', '\nExample:\n  $ cirrux contacts get <contact-uuid> --json')
  .action(contactsGetCommand)

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
  .description('Download a file (decrypts locally; writes raw bytes to stdout — pipe with `> out` or use --output)')
  .argument('<uuid>', 'Drive file UUID')
  .option('--output <path>', 'Write the decrypted file to this path (streamed; recommended for large files)')
  .option('--json', 'Output as JSON (base64url-encoded data)')
  .option('--quiet', 'Output only the base64url-encoded data (for piping)')
  .action(driveDownloadCommand)

drive
  .command('upload')
  .description('Upload a file (encrypts locally; 2 GB max)')
  .argument('[folder-uuid]', 'Destination folder UUID (omit to upload to the root)')
  .requiredOption('--file <path>', 'Path to the file to upload')
  .option('--name <name>', 'Override the stored filename (defaults to the file basename)')
  .option('--content-type <type>', 'MIME type (defaults to application/octet-stream)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new file UUID (for piping)')
  .action(driveUploadCommand)

drive
  .command('replace')
  .description("Replace a file's contents in place, keeping its UUID (encrypts locally; 2 GB max)")
  .argument('<uuid>', 'Drive file UUID')
  .requiredOption('--file <path>', 'Path to the replacement file')
  .option('--content-type <type>', 'Override the MIME type (defaults to keeping the existing one)')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the file UUID (for piping)')
  .action(driveReplaceCommand)

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

drive
  .command('rename')
  .description('Rename a file')
  .argument('<uuid>', 'Drive file UUID')
  .argument('<new-name>', 'New filename')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the file UUID (for piping)')
  .action(driveRenameCommand)

drive
  .command('move')
  .description('Move a file into another folder (or to the root)')
  .argument('<uuid>', 'Drive file UUID')
  .option('--to <folder-uuid>', 'Destination folder UUID')
  .option('--root', 'Move the file to the root')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the file UUID (for piping)')
  .action(driveMoveCommand)

const driveFolder = drive
  .command('folder')
  .description('Manage Drive folders')

driveFolder
  .command('create')
  .description('Create a folder (at the root, or inside --parent)')
  .requiredOption('--name <name>', 'Folder name')
  .option('--parent <folder-uuid>', 'Parent folder UUID (omit to create at the root)')
  .option('--color <color>', 'Folder color')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the new folder UUID (for piping)')
  .action(driveFolderCreateCommand)

driveFolder
  .command('get')
  .description('Get metadata for a folder')
  .argument('<uuid>', 'Drive folder UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the folder UUID (for piping)')
  .action(driveFolderGetCommand)

driveFolder
  .command('rename')
  .description('Rename a folder')
  .argument('<uuid>', 'Drive folder UUID')
  .argument('<new-name>', 'New folder name')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the folder UUID (for piping)')
  .action(driveFolderRenameCommand)

driveFolder
  .command('move')
  .description('Move a folder under another folder (or to the root)')
  .argument('<uuid>', 'Drive folder UUID')
  .option('--to <folder-uuid>', 'Destination parent folder UUID')
  .option('--root', 'Move the folder to the root')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the folder UUID (for piping)')
  .action(driveFolderMoveCommand)

driveFolder
  .command('trash')
  .description('Move a folder to the trash (reversible, idempotent)')
  .argument('<uuid>', 'Drive folder UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the folder UUID (for piping)')
  .action(driveFolderTrashCommand)

driveFolder
  .command('delete')
  .description('Delete a folder (idempotent)')
  .argument('<uuid>', 'Drive folder UUID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the deleted folder UUID (for piping)')
  .action(driveFolderDeleteCommand)

const driveShare = drive
  .command('share')
  .description('Manage public download links for files and folders')

driveShare
  .command('create')
  .description('Create a public download link for a file (or a folder with --folder)')
  .argument('<uuid>', 'Drive file or folder UUID')
  .option('--folder', 'Target a folder instead of a file')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the public link URL (for piping)')
  .action(driveShareCreateCommand)

driveShare
  .command('get')
  .description('Show sharing settings (grants + public link) for a file (or a folder with --folder)')
  .argument('<uuid>', 'Drive file or folder UUID')
  .option('--folder', 'Target a folder instead of a file')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the public link URL, if any (for piping)')
  .action(driveShareGetCommand)

driveShare
  .command('revoke')
  .description('Revoke the public link for a file (or a folder with --folder)')
  .argument('<uuid>', 'Drive file or folder UUID')
  .option('--folder', 'Target a folder instead of a file')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Output only the resource UUID (for piping)')
  .action(driveShareRevokeCommand)

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
