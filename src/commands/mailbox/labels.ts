import { authedRequest, authedRequestVoid } from '../../api.js'
import { ExitCode } from '../../exit-codes.js'
import { output, outputError, type OutputOptions } from '../../output.js'
import { handleLabelError, type Label, requireCredentials } from './labels-shared.js'

interface MailboxLabelsResponse {
  object: string
  url: string
  has_more: boolean
  data: Label[]
}

interface LabelNameOptions extends OutputOptions {
  name: string
}

function labelsPath(mailboxUuid: string, labelUuid?: string): string {
  const base = `public_api/v1/mailboxes/${encodeURIComponent(mailboxUuid)}/labels`
  return labelUuid ? `${base}/${encodeURIComponent(labelUuid)}` : base
}

export async function mailboxLabelsListCommand(
  mailboxUuid: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<MailboxLabelsResponse>(
      labelsPath(mailboxUuid),
    )

    const data = {
      object: response.object,
      data: response.data,
    }

    const lines = response.data.map((l) => `${l.uuid}\t${l.type}\t${l.name}`)
    const quietValue = response.data.map((l) => l.uuid).join('\n')

    output(data, {
      ...options,
      text: lines.length > 0 ? lines.join('\n') : 'No labels found.',
      quietValue,
    })
  } catch (error) {
    handleLabelError(error, options, { action: 'List labels', notFound: `Mailbox '${mailboxUuid}' not found.` })
  }
}

function requireName(options: LabelNameOptions): string {
  const name = options.name?.trim()
  if (!name) {
    outputError('A label name is required.', {
      ...options,
      code: ExitCode.USAGE_ERROR,
      hint: 'Pass --name "<label name>".',
      errorType: 'usage_error',
    })
  }
  return name
}

export async function mailboxLabelsCreateCommand(
  mailboxUuid: string,
  options: LabelNameOptions,
): Promise<void> {
  requireCredentials(options)
  const name = requireName(options)

  try {
    const label = await authedRequest<Label>(labelsPath(mailboxUuid), {
      method: 'POST',
      body: { name },
    })

    output(label as unknown as Record<string, unknown>, {
      ...options,
      text: `Created label ${label.name} (${label.uuid})`,
      quietValue: label.uuid,
    })
  } catch (error) {
    handleLabelError(error, options, { action: 'Create label', notFound: `Mailbox '${mailboxUuid}' not found.` })
  }
}

export async function mailboxLabelsUpdateCommand(
  mailboxUuid: string,
  labelUuid: string,
  options: LabelNameOptions,
): Promise<void> {
  requireCredentials(options)
  const name = requireName(options)

  try {
    const label = await authedRequest<Label>(labelsPath(mailboxUuid, labelUuid), {
      method: 'POST',
      body: { name },
    })

    output(label as unknown as Record<string, unknown>, {
      ...options,
      text: `Renamed label to ${label.name} (${label.uuid})`,
      quietValue: label.uuid,
    })
  } catch (error) {
    handleLabelError(error, options, { action: 'Update label', notFound: `Label '${labelUuid}' not found.` })
  }
}

export async function mailboxLabelsDeleteCommand(
  mailboxUuid: string,
  labelUuid: string,
  options: OutputOptions,
): Promise<void> {
  requireCredentials(options)

  try {
    await authedRequestVoid(labelsPath(mailboxUuid, labelUuid), { method: 'DELETE' })

    output({ uuid: labelUuid, deleted: true }, {
      ...options,
      text: `Deleted label ${labelUuid}`,
      quietValue: labelUuid,
    })
  } catch (error) {
    handleLabelError(error, options, { action: 'Delete label', notFound: `Label '${labelUuid}' not found.` })
  }
}

export { labelsPath }
