import {
  type Availability,
  type HoursRange,
  type SchedulingPage,
  type SchedulingPageListResponse,
  type SlotListResponse,
  type Weekday,
  WEEKDAYS,
} from './scheduling-shared.js'

const SHORT: Record<Weekday, string> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
}

/** "30 min", "1h", "1h30m", "1d": short enough for a column, and what the length flags take. */
export function formatLength(minutes: number): string {
  if (minutes > 0 && minutes % 1440 === 0) return `${minutes / 1440}d`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours}h${rest}m` : `${hours}h`
}

function rangesKey(ranges: HoursRange[] | undefined): string {
  return (ranges ?? []).map((range) => `${range.start}-${range.end}`).join(',')
}

/** Days as `--hours` writes them: runs of three or more joined, "mon-wed,fri". */
function formatDays(days: Weekday[]): string {
  const parts: string[] = []
  let index = 0
  while (index < days.length) {
    let last = index
    while (
      last + 1 < days.length &&
      WEEKDAYS.indexOf(days[last + 1] as Weekday) === WEEKDAYS.indexOf(days[last] as Weekday) + 1
    ) {
      last += 1
    }
    const first = SHORT[days[index] as Weekday]
    if (last - index >= 2) parts.push(`${first}-${SHORT[days[last] as Weekday]}`)
    else parts.push(...days.slice(index, last + 1).map((day) => SHORT[day]))
    index = last + 1
  }
  return parts.join(',')
}

/**
 * Weekly hours in the syntax `--hours` takes, one line per set of hours with every day that has
 * them: ["mon-wed,fri 09:00-17:00", "sat 10:00-12:00"]. What `get` prints can be passed back as is.
 */
export function formatHours(hours: Partial<Record<Weekday, HoursRange[]>>): string[] {
  const groups = new Map<string, Weekday[]>()
  for (const day of WEEKDAYS) {
    const key = rangesKey(hours[day])
    if (key) groups.set(key, [...(groups.get(key) ?? []), day])
  }
  return [...groups].map(([key, days]) => `${formatDays(days)} ${key}`)
}

export function formatAvailability(availability: Availability): string[] {
  switch (availability.type) {
    case 'recurring':
      return formatHours(availability.hours)
    case 'windows':
      return availability.windows.map((window) => `${window.start}/${window.end}`)
    case 'slots':
      return availability.slots.map((slot) => slot.start)
  }
}

export function formatPageList(response: SchedulingPageListResponse): { text: string; quietValue: string } {
  const lines = response.data.map((page) =>
    [page.uuid, page.active ? 'on' : 'off', formatLength(page.duration_minutes), page.title, page.url].join('\t'),
  )

  return {
    text: lines.length > 0 ? lines.join('\n') : 'No scheduling pages found.',
    quietValue: response.data.map((page) => page.uuid).join('\n'),
  }
}

/** One line, for the result of a create or an update. */
export function formatWrittenPage(page: SchedulingPage): string {
  return [page.uuid, page.active ? 'on' : 'off', formatLength(page.duration_minutes), page.title, page.url].join('\t')
}

export function formatPage(page: SchedulingPage): string {
  const host = page.hosts[0]
  const label = (name: string) => name.padEnd(12)
  const [firstTime = '', ...moreTimes] = formatAvailability(page.availability)
  const lines = [
    `${page.title}  (${page.active ? 'on' : 'off'})`,
    page.url,
    '',
    `${label('uuid')}${page.uuid}`,
    `${label('length')}${formatLength(page.duration_minutes)}`,
    ...(page.location ? [`${label('location')}${page.location}`] : []),
    `${label('time zone')}${page.timezone}`,
    `${label(page.availability.type === 'recurring' ? 'hours' : page.availability.type)}${firstTime}`,
    ...moreTimes.map((line) => `${label('')}${line}`),
    `${label('notice')}${formatLength(page.minimum_notice_minutes)}`,
    `${label('days ahead')}${page.booking_window_days}`,
  ]
  if (host) {
    lines.push(
      `${label('mailbox')}${host.mailbox_uuid}`,
      `${label('books into')}${host.booking_calendar_uuid}`,
      `${label('busy from')}${host.availability_calendar_uuids.join(', ')}`,
    )
  }
  if (page.description) lines.push('', page.description)
  return lines.join('\n')
}

/**
 * The bookable times a day per line, in the zone they were asked for:
 * "2026-12-01  09:00 09:30 10:00". Start times only: every slot is as long as the page's meeting.
 */
export function formatSlots(response: SlotListResponse): { text: string; quietValue: string } {
  const days = new Map<string, string[]>()
  for (const slot of response.data) {
    const day = slot.start.slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), slot.start.slice(11, 16)])
  }
  const lines = [...days].map(([day, times]) => `${day}  ${times.join(' ')}`)

  return {
    text: lines.length > 0 ? `Times in ${response.timezone}:\n${lines.join('\n')}` : 'No bookable times in that window.',
    quietValue: response.data.map((slot) => slot.start).join('\n'),
  }
}
