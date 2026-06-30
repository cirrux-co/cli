import { authedRequest, authedRequestVoid } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { type Filter, handleFilterError, requireCredentials } from './filters-shared.js'

interface MailboxFiltersResponse {
  object: string
  url: string
  has_more: boolean
  data: Filter[]
}

interface FilterFieldOptions {
  name?: string
  conditionAst?: string
  actions?: string
  description?: string
  status?: string
  priority?: string
  stopProcessing?: boolean
}

type FilterWriteOptions = OutputOptions & FilterFieldOptions

/** Thrown for malformed local input (bad JSON, missing required flags) before any API call. */
export class FilterInputError extends Error {}

function filtersPath(mailboxUuid: string, filterUuid?: string): string {
  const base = `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/filters`
  return filterUuid ? `${base}/${encodeURIComponent(filterUuid)}` : base
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new FilterInputError(`${label} must be valid JSON.`)
  }
}

/**
 * Build the request body from CLI flags, sending only the fields the user provided.
 * On `create`, `--name` and `--condition-ast` are required and `actions` defaults to `[]`.
 * Pure (throws FilterInputError on bad input) so it can be unit-tested.
 */
export function buildFilterBody(
  options: FilterFieldOptions,
  { mode }: { mode: 'create' | 'update' },
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  const name = options.name?.trim()
  if (mode === 'create') {
    if (!name) throw new FilterInputError('A filter name is required. Pass --name "<name>".')
    body.name = name
  } else if (options.name !== undefined) {
    if (!name) throw new FilterInputError('--name cannot be blank.')
    body.name = name
  }

  if (mode === 'create') {
    if (!options.conditionAst) {
      throw new FilterInputError('--condition-ast <json> is required.')
    }
    body.condition_ast = parseJson(options.conditionAst, '--condition-ast')
  } else if (options.conditionAst !== undefined) {
    body.condition_ast = parseJson(options.conditionAst, '--condition-ast')
  }

  if (options.actions !== undefined) {
    body.actions = parseJson(options.actions, '--actions')
  } else if (mode === 'create') {
    body.actions = []
  }

  if (options.description !== undefined) body.description = options.description
  if (options.status !== undefined) body.status = options.status
  if (options.priority !== undefined) {
    const priority = Number(options.priority)
    if (!Number.isInteger(priority)) throw new FilterInputError('--priority must be an integer.')
    body.priority = priority
  }
  if (options.stopProcessing !== undefined) body.stop_processing = options.stopProcessing

  return body
}

function buildBodyOrExit(options: FilterWriteOptions, mode: 'create' | 'update'): Record<string, unknown> {
  try {
    return buildFilterBody(options, { mode })
  } catch (error) {
    if (error instanceof FilterInputError) {
      outputError(error.message, { ...options, code: ExitCode.USAGE_ERROR, errorType: 'usage_error' })
    }
    throw error
  }
}

export async function mailboxFiltersListCommand(
  mailboxUuid: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<MailboxFiltersResponse>(filtersPath(mailboxUuid))

    const data = { object: response.object, data: response.data }
    const lines = response.data.map((f) => `${f.uuid}\t${f.status}\t${f.name}`)
    const quietValue = response.data.map((f) => f.uuid).join('\n')

    output(data, {
      ...options,
      text: lines.length > 0 ? lines.join('\n') : 'No filters found.',
      quietValue,
    })
  } catch (error) {
    handleFilterError(error, options, { action: 'List filters', notFound: `Mailbox '${mailboxUuid}' not found.` })
  }
}

export async function mailboxFiltersCreateCommand(
  mailboxUuid: string,
  options: FilterWriteOptions,
): Promise<void> {
  requireCredentials(options)
  const body = buildBodyOrExit(options, 'create')

  try {
    const filter = await authedRequest<Filter>(filtersPath(mailboxUuid), { method: 'POST', body })

    output(filter as unknown as Record<string, unknown>, {
      ...options,
      text: `Created filter ${filter.name} (${filter.uuid})`,
      quietValue: filter.uuid,
    })
  } catch (error) {
    handleFilterError(error, options, { action: 'Create filter', notFound: `Mailbox '${mailboxUuid}' not found.` })
  }
}

export async function mailboxFiltersUpdateCommand(
  mailboxUuid: string,
  filterUuid: string,
  options: FilterWriteOptions,
): Promise<void> {
  requireCredentials(options)
  const body = buildBodyOrExit(options, 'update')

  try {
    const filter = await authedRequest<Filter>(filtersPath(mailboxUuid, filterUuid), { method: 'POST', body })

    output(filter as unknown as Record<string, unknown>, {
      ...options,
      text: `Updated filter ${filter.name} (${filter.uuid})`,
      quietValue: filter.uuid,
    })
  } catch (error) {
    handleFilterError(error, options, { action: 'Update filter', notFound: `Filter '${filterUuid}' not found.` })
  }
}

export async function mailboxFiltersDeleteCommand(
  mailboxUuid: string,
  filterUuid: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(filtersPath(mailboxUuid, filterUuid), { method: 'DELETE' })

    output({ uuid: filterUuid, deleted: true }, {
      ...options,
      text: `Deleted filter ${filterUuid}`,
      quietValue: filterUuid,
    })
  } catch (error) {
    handleFilterError(error, options, { action: 'Delete filter', notFound: `Filter '${filterUuid}' not found.` })
  }
}

export { filtersPath }
