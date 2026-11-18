import { authedRequest, authedRequestVoid } from '../../api.js'
import { confirmDeleteOrExit } from '../../confirm.js'
import { ExitCode } from '../../exit-codes.js'
import { deferred, output, outputError, type OutputOptions } from '../../output.js'
import type { CalendarListResponse } from '../calendar/calendar-shared.js'
import { formatPage, formatPageList, formatSlots, formatWrittenPage, hostNamesFrom, type HostNames } from './format.js'
import { buildPageBody, type PageBodyOptions } from './page-body.js'
import {
  handleSchedulingError,
  requireCredentials,
  type SchedulingPage,
  type SchedulingPageListResponse,
  type SlotListResponse,
} from './scheduling-shared.js'

const PAGES = 'public_api/v1/scheduling_pages'

function pagePath(uuid: string): string {
  return `${PAGES}/${encodeURIComponent(uuid)}`
}

/**
 * The text output names the host's mailbox and calendars rather than printing their uuids, so a
 * page that went to an unexpected mailbox shows. Best effort: without the list, the uuids.
 */
async function hostNames(options: OutputOptions): Promise<HostNames | undefined> {
  if (options.json || options.quiet) return undefined
  try {
    return hostNamesFrom((await authedRequest<CalendarListResponse>('public_api/v1/calendars')).data)
  } catch {
    return undefined
  }
}

function notFound(uuid: string): string {
  return `Scheduling page '${uuid}' not found. Run 'cirrux scheduling pages list' for the pages you can see.`
}

export async function schedulingPagesListCommand(options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const response = await authedRequest<SchedulingPageListResponse>(PAGES)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatPageList(response)),
    })
  } catch (error) {
    handleSchedulingError(error, options, { action: 'List scheduling pages' })
  }
}

export async function schedulingPagesGetCommand(uuid: string, options: OutputOptions): Promise<void> {
  requireCredentials(options)

  try {
    const page = await authedRequest<SchedulingPage>(pagePath(uuid))
    const names = await hostNames(options)

    output(page as unknown as Record<string, unknown>, {
      ...options,
      text: () => formatPage(page, names),
      quietValue: () => page.url,
    })
  } catch (error) {
    handleSchedulingError(error, options, { action: 'Get scheduling page', notFound: notFound(uuid) })
  }
}

function bodyOrExit(options: PageBodyOptions & OutputOptions, built: ReturnType<typeof buildPageBody>) {
  if (!built.ok) {
    outputError(built.message, {
      ...options,
      code: ExitCode.USAGE_ERROR,
      errorType: 'usage_error',
      ...(built.hint ? { hint: built.hint } : {}),
    })
  }
  return built.body
}

export async function schedulingPagesCreateCommand(options: PageBodyOptions & OutputOptions): Promise<void> {
  requireCredentials(options)
  const body = bodyOrExit(options, buildPageBody(options, { mode: 'create' }))

  try {
    const page = await authedRequest<SchedulingPage>(PAGES, { method: 'POST', body })
    const names = await hostNames(options)

    output(page as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Created ${formatWrittenPage(page, names)}`,
      quietValue: () => page.uuid,
    })
  } catch (error) {
    handleSchedulingError(error, options, { action: 'Create scheduling page' })
  }
}

export async function schedulingPagesUpdateCommand(
  uuid: string,
  options: PageBodyOptions & OutputOptions,
): Promise<void> {
  requireCredentials(options)

  const body = bodyOrExit(options, buildPageBody(options, { mode: 'update' }))

  try {
    const page = await authedRequest<SchedulingPage>(pagePath(uuid), { method: 'POST', body })
    const names = await hostNames(options)

    output(page as unknown as Record<string, unknown>, {
      ...options,
      text: () => `Updated ${formatWrittenPage(page, names)}`,
      quietValue: () => page.uuid,
    })
  } catch (error) {
    handleSchedulingError(error, options, { action: 'Update scheduling page', notFound: notFound(uuid) })
  }
}

/**
 * Deleting a page takes its link down at once: anyone holding it can no longer book. Bookings
 * already made stay on the calendar, and their cancel links keep working.
 */
export async function schedulingPagesDeleteCommand(
  uuid: string,
  options: OutputOptions & { yes?: boolean },
): Promise<void> {
  requireCredentials(options)

  if (!options.yes) {
    await confirmDeleteOrExit(`Delete scheduling page ${uuid}? Its link stops working at once.`, options)
  }

  try {
    await authedRequestVoid(pagePath(uuid), { method: 'DELETE' })

    output(
      { uuid, deleted: true },
      { ...options, text: () => `Deleted scheduling page ${uuid}`, quietValue: () => uuid },
    )
  } catch (error) {
    handleSchedulingError(error, options, { action: 'Delete scheduling page', notFound: notFound(uuid) })
  }
}

export async function schedulingPagesSlotsCommand(
  uuid: string,
  options: OutputOptions & { from?: string; to?: string },
): Promise<void> {
  requireCredentials(options)

  const query = new URLSearchParams()
  if (options.from) query.set('from', options.from)
  if (options.to) query.set('to', options.to)
  const suffix = query.size > 0 ? `?${query}` : ''

  try {
    const response = await authedRequest<SlotListResponse>(`${pagePath(uuid)}/slots${suffix}`)

    output(response as unknown as Record<string, unknown>, {
      ...options,
      ...deferred(() => formatSlots(response)),
    })
  } catch (error) {
    handleSchedulingError(error, options, { action: 'List bookable times', notFound: notFound(uuid) })
  }
}
