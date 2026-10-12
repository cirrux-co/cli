/**
 * Parsing for wake-up times on `snooze` and `--remind-at`.
 *
 * The API only ever accepts an absolute ISO 8601 instant. Everything human goes
 * through here first, resolved against the machine's local timezone, which is what
 * someone typing "tomorrow 9am" means. Deliberately narrower than the web app's
 * picker: this covers what people actually type at a shell, and anything it does not
 * understand is rejected loudly rather than guessed at.
 */

export class TimeParseError extends Error {}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

/** The hour a bare day reference means. "monday" is Monday morning, not midnight. */
const DEFAULT_HOUR = 9

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i

interface TimeOfDay {
  hours: number
  minutes: number
}

function parseAmount(text: string): number | null {
  if (/^\d+$/.test(text)) return parseInt(text, 10)
  return NUMBER_WORDS[text] ?? null
}

function parseTimeOfDay(text: string): TimeOfDay | null {
  const match24 = text.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const hours = parseInt(match24[1]!, 10)
    const minutes = parseInt(match24[2]!, 10)
    if (hours <= 23 && minutes <= 59) return { hours, minutes }
    return null
  }

  const matchAmPm = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (matchAmPm) {
    let hours = parseInt(matchAmPm[1]!, 10)
    const minutes = matchAmPm[2] ? parseInt(matchAmPm[2], 10) : 0
    if (hours < 1 || hours > 12 || minutes > 59) return null
    if (matchAmPm[3] === 'pm' && hours !== 12) hours += 12
    if (matchAmPm[3] === 'am' && hours === 12) hours = 0
    return { hours, minutes }
  }

  return null
}

function at(base: Date, time: TimeOfDay): Date {
  const result = new Date(base)
  result.setHours(time.hours, time.minutes, 0, 0)
  return result
}

function parseRelative(text: string, now: Date): Date | null {
  // "+3h" / "+2d" / "+30m" / "+1w" — the terse form, and what scripts tend to use.
  const shorthand = text.match(/^\+(\d+)\s*(m|min|mins|h|hr|hrs|d|w)$/)
  if (shorthand) {
    const amount = parseInt(shorthand[1]!, 10)
    return addUnit(now, shorthand[2]!, amount)
  }

  // "in 3 hours" / "3 hours" / "two weeks"
  const spelled = text.match(
    /^(?:in\s+)?([a-z]+|\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days|week|weeks)$/,
  )
  if (spelled) {
    const amount = parseAmount(spelled[1]!)
    if (amount === null) return null
    return addUnit(now, spelled[2]!, amount)
  }

  return null
}

function addUnit(now: Date, unit: string, amount: number): Date {
  const result = new Date(now)
  if (unit.startsWith('m')) result.setMinutes(result.getMinutes() + amount)
  else if (unit.startsWith('h')) result.setHours(result.getHours() + amount)
  else if (unit.startsWith('w')) result.setDate(result.getDate() + amount * 7)
  else result.setDate(result.getDate() + amount)
  return result
}

function parseNamedDay(parts: string[], now: Date): Date | null {
  const dayName = DAY_NAMES[parts[0]!]
  if (dayName === undefined) return null

  const result = new Date(now)
  // A bare weekday always means the *next* one. "monday" on a Monday is a week out,
  // never today, because today's 9am has usually already gone.
  const daysAhead = (dayName - result.getDay() + 7) % 7 || 7
  result.setDate(result.getDate() + daysAhead)

  const time = parts.length > 1
    ? parseTimeOfDay(parts.slice(1).join(''))
    : { hours: DEFAULT_HOUR, minutes: 0 }
  if (!time) return null

  return at(result, time)
}

function parseTodayTomorrow(text: string, now: Date): Date | null {
  const match = text.match(/^(today|tonight|tomorrow)(?:\s+(.+))?$/)
  if (!match) return null

  const result = new Date(now)
  if (match[1] === 'tomorrow') result.setDate(result.getDate() + 1)

  // "tonight" is the one word that carries its own hour.
  const fallback = match[1] === 'tonight'
    ? { hours: 18, minutes: 0 }
    : { hours: DEFAULT_HOUR, minutes: 0 }

  const time = match[2] ? parseTimeOfDay(match[2]) : fallback
  if (!time) return null

  return at(result, time)
}

function parseCalendarDate(parts: string[], now: Date): Date | null {
  let month: number | undefined
  let day: number | undefined
  let rest: string[]

  const asMonthFirst = MONTH_NAMES[parts[0]!]
  if (asMonthFirst !== undefined && parts.length >= 2) {
    month = asMonthFirst
    day = parseInt(parts[1]!, 10)
    rest = parts.slice(2)
  } else if (parts.length >= 2 && MONTH_NAMES[parts[1]!] !== undefined) {
    month = MONTH_NAMES[parts[1]!]
    day = parseInt(parts[0]!, 10)
    rest = parts.slice(2)
  } else {
    return null
  }

  if (!day || Number.isNaN(day) || day < 1 || day > 31) return null

  const result = new Date(now.getFullYear(), month, day)
  // Reading back the month catches a day that does not exist (Feb 30 rolls to March).
  if (result.getMonth() !== month) return null

  const maybeYear = rest[0]
  if (maybeYear && /^\d{4}$/.test(maybeYear)) {
    result.setFullYear(parseInt(maybeYear, 10))
    rest = rest.slice(1)
  } else if (result < now) {
    // A date that has passed this year means next year, the way a calendar reads.
    result.setFullYear(result.getFullYear() + 1)
  }

  const time = rest.length > 0
    ? parseTimeOfDay(rest.join(''))
    : { hours: DEFAULT_HOUR, minutes: 0 }
  if (!time) return null

  return at(result, time)
}

/**
 * Resolve a human wake-up time to an absolute ISO 8601 instant.
 *
 * Throws `TimeParseError` when the input cannot be understood, or resolves to a
 * moment that has already passed. Pass `now` in tests; never rely on the clock.
 */
export function parseWhen(input: string, now: Date = new Date()): string {
  const text = input.trim().toLowerCase()

  if (text.length === 0) {
    throw new TimeParseError('A time is required.')
  }

  // An explicit instant is passed through untouched — the caller already did the work,
  // and reinterpreting it in local time would move it.
  if (ISO_WITH_OFFSET.test(input.trim())) {
    const parsed = new Date(input.trim())
    if (Number.isNaN(parsed.getTime())) {
      throw new TimeParseError(`Could not understand the time '${input}'.`)
    }
    return ensureFuture(parsed, now, input)
  }

  // A date with no offset would otherwise be read as UTC by Date, silently shifting it.
  if (/^\d{4}-\d{2}-\d{2}t/.test(text)) {
    throw new TimeParseError(
      `The timestamp '${input}' has no timezone. Add 'Z' or an offset like '+02:00', ` +
        'or use a phrase like "tomorrow 9am".',
    )
  }

  const parts = text.split(/\s+/)
  const resolved =
    parseRelative(text, now) ??
    parseTodayTomorrow(text, now) ??
    parseNamedDay(parts, now) ??
    parseCalendarDate(parts, now) ??
    parseBareTime(text, now)

  if (!resolved || Number.isNaN(resolved.getTime())) {
    throw new TimeParseError(
      `Could not understand the time '${input}'. Try '+2d', 'tomorrow 9am', 'monday', ` +
        "'3 hours', 'mar 20', or an ISO 8601 timestamp.",
    )
  }

  return ensureFuture(resolved, now, input)
}

/** A bare "9am" means today if it is still ahead, otherwise tomorrow. */
function parseBareTime(text: string, now: Date): Date | null {
  const time = parseTimeOfDay(text)
  if (!time) return null

  const result = at(now, time)
  if (result <= now) result.setDate(result.getDate() + 1)
  return result
}

function ensureFuture(value: Date, now: Date, input: string): string {
  if (value <= now) {
    throw new TimeParseError(`'${input}' is in the past.`)
  }
  return value.toISOString()
}
