import { authedRequestVoid } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { handleDriveError, requireCredentials, resourceKind } from '../drive-shared.js'

export async function driveShareRevokeCommand(
  uuid: string,
  options: OutputOptions & { folder?: boolean },
): Promise<void> {
  requireCredentials(options)

  const kind = resourceKind(options)
  try {
    await authedRequestVoid(
      `public_api/v1/drive/${kind}/${encodeURIComponent(uuid)}/public_link`,
      { method: 'DELETE' },
    )

    output({ uuid, revoked: true }, {
      ...options,
      text: `Revoked public link for ${uuid}`,
      quietValue: uuid,
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Revoke public link',
      notFound: `No public link exists for '${uuid}'.`,
    })
  }
}
