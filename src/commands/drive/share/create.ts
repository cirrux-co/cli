import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { type DrivePublicLink, handleDriveError, requireCredentials, resourceKind } from '../drive-shared.js'

export async function driveShareCreateCommand(
  uuid: string,
  options: OutputOptions & { folder?: boolean },
): Promise<void> {
  requireCredentials(options)

  const kind = resourceKind(options)
  try {
    const link = await authedRequest<DrivePublicLink>(
      `public_api/v1/drive/${kind}/${encodeURIComponent(uuid)}/public_link`,
      { method: 'POST' },
    )

    // The copy runs asynchronously; status is 'pending' until it is ready.
    output(link as unknown as Record<string, unknown>, {
      ...options,
      text: `${link.url}\t(${link.status})`,
      quietValue: link.url,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Create public link',
      notFound: `${options.folder ? 'Folder' : 'File'} '${uuid}' not found.`,
    })
  }
}
