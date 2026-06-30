import { authedRequest } from '../../../api.js'
import { output, type OutputOptions } from '../../../output.js'
import { type DriveSharing, handleDriveError, requireCredentials, resourceKind } from '../drive-shared.js'

export async function driveShareGetCommand(
  uuid: string,
  options: OutputOptions & { folder?: boolean },
): Promise<void> {
  requireCredentials(options)

  const kind = resourceKind(options)
  try {
    const sharing = await authedRequest<DriveSharing>(
      `public_api/v1/drive/${kind}/${encodeURIComponent(uuid)}/sharing`,
    )

    output(sharing as unknown as Record<string, unknown>, {
      ...options,
      text: formatSharing(sharing),
      quietValue: sharing.public_link?.url ?? '',
    })
  } catch (error) {
    handleDriveError(error, options, {
      action: 'Get sharing',
      notFound: `${options.folder ? 'Folder' : 'File'} '${uuid}' not found.`,
    })
  }
}

function formatSharing(sharing: DriveSharing): string {
  const lines: string[] = []
  if (sharing.public_link) {
    lines.push(`Public link: ${sharing.public_link.url} (${sharing.public_link.status})`)
  } else {
    lines.push('Public link: none')
  }
  if (sharing.accesses.length > 0) {
    lines.push('Grants:')
    for (const grant of sharing.accesses) {
      const who = grant.principal_type === 'workspace' ? 'workspace' : (grant.principal_user_uuid ?? grant.principal_email ?? grant.principal_type)
      lines.push(`  ${who}\t${grant.role}\t${grant.status}`)
    }
  }
  return lines.join('\n')
}
