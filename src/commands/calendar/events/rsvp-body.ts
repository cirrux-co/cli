/**
 * Turning the rsvp flags into the API's body. Pure, so the one decision in the
 * command (is this an answer the server will take) is tested without a network.
 */

export const RSVP_STATUSES = ['accepted', 'declined', 'tentative'] as const

export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export interface RsvpOptions {
  status?: string
  comment?: string
}

export interface RsvpBody {
  status: RsvpStatus
  comment?: string
}

export type BuiltRsvpBody = { ok: true; body: RsvpBody } | { ok: false; message: string }

function isRsvpStatus(value: string): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value)
}

export function buildRsvpBody(options: RsvpOptions): BuiltRsvpBody {
  if (options.status === undefined || !isRsvpStatus(options.status)) {
    return { ok: false, message: `--status must be one of: ${RSVP_STATUSES.join(', ')}.` }
  }

  const body: RsvpBody = { status: options.status }
  if (options.comment !== undefined) body.comment = options.comment

  return { ok: true, body }
}

const STATUS_LABELS: Record<RsvpStatus, string> = {
  accepted: 'Accepted',
  declined: 'Declined',
  tentative: 'Tentatively accepted',
}

export function rsvpStatusLabel(status: RsvpStatus): string {
  return STATUS_LABELS[status]
}
