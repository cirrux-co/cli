import { expect, test } from 'bun:test'
import { parseWhen, TimeParseError } from './time.js'

// A Wednesday, deliberately mid-week and mid-month so weekday and calendar rollover
// are both exercised. Constructed in local time: that is what the parser works in.
const NOW = new Date(2026, 7, 19, 14, 30, 0)

function parsed(input: string, now: Date = NOW): Date {
  return new Date(parseWhen(input, now))
}

test('passes an explicit UTC instant through untouched', () => {
  expect(parseWhen('2027-01-01T09:00:00Z', NOW)).toBe('2027-01-01T09:00:00.000Z')
})

test('passes an explicit offset instant through, normalised to UTC', () => {
  expect(parseWhen('2027-01-01T09:00:00+02:00', NOW)).toBe('2027-01-01T07:00:00.000Z')
})

test('rejects a timestamp with no timezone rather than guessing', () => {
  expect(() => parseWhen('2027-01-01T09:00:00', NOW)).toThrow(TimeParseError)
  expect(() => parseWhen('2027-01-01T09:00:00', NOW)).toThrow(/no timezone/)
})

test('parses +Nh shorthand', () => {
  expect(parsed('+3h').getTime()).toBe(NOW.getTime() + 3 * 3600_000)
})

test('parses +Nd shorthand', () => {
  const result = parsed('+2d')
  expect(result.getDate()).toBe(21)
  expect(result.getHours()).toBe(14)
})

test('parses +Nw shorthand', () => {
  expect(parsed('+1w').getDate()).toBe(26)
})

test('parses +Nm as minutes', () => {
  expect(parsed('+30m').getTime()).toBe(NOW.getTime() + 30 * 60_000)
})

test('parses spelled-out relative times', () => {
  expect(parsed('in 3 hours').getTime()).toBe(NOW.getTime() + 3 * 3600_000)
  expect(parsed('3 hours').getTime()).toBe(NOW.getTime() + 3 * 3600_000)
  expect(parsed('two weeks').getDate()).toBe(2)
})

test('parses "an hour" as one hour', () => {
  expect(parsed('in an hour').getTime()).toBe(NOW.getTime() + 3600_000)
})

test('tomorrow defaults to 9am', () => {
  const result = parsed('tomorrow')
  expect(result.getDate()).toBe(20)
  expect(result.getHours()).toBe(9)
  expect(result.getMinutes()).toBe(0)
})

test('tomorrow takes an explicit time', () => {
  const result = parsed('tomorrow 2:30pm')
  expect(result.getDate()).toBe(20)
  expect(result.getHours()).toBe(14)
  expect(result.getMinutes()).toBe(30)
})

test('tonight means this evening', () => {
  const result = parsed('tonight')
  expect(result.getDate()).toBe(19)
  expect(result.getHours()).toBe(18)
})

test('a weekday resolves to the next one at 9am', () => {
  // NOW is a Wednesday, so Friday is two days out.
  const result = parsed('friday')
  expect(result.getDate()).toBe(21)
  expect(result.getHours()).toBe(9)
})

test('a weekday matching today jumps a full week rather than meaning today', () => {
  const result = parsed('wednesday')
  expect(result.getDate()).toBe(26)
})

test('a weekday takes an explicit time', () => {
  const result = parsed('mon 7am')
  expect(result.getDay()).toBe(1)
  expect(result.getHours()).toBe(7)
})

test('parses month-first calendar dates', () => {
  const result = parsed('mar 20')
  expect(result.getMonth()).toBe(2)
  expect(result.getDate()).toBe(20)
  // March 2026 has already passed relative to NOW, so it rolls to 2027.
  expect(result.getFullYear()).toBe(2027)
})

test('parses day-first calendar dates', () => {
  const result = parsed('20 march')
  expect(result.getMonth()).toBe(2)
  expect(result.getDate()).toBe(20)
})

test('keeps a calendar date in this year when it is still ahead', () => {
  const result = parsed('dec 25')
  expect(result.getFullYear()).toBe(2026)
})

test('accepts an explicit year', () => {
  const result = parsed('mar 20 2028')
  expect(result.getFullYear()).toBe(2028)
  expect(result.getMonth()).toBe(2)
})

test('accepts a calendar date with a time', () => {
  const result = parsed('dec 25 18:00')
  expect(result.getHours()).toBe(18)
  expect(result.getMinutes()).toBe(0)
})

test('rejects a calendar date that does not exist', () => {
  expect(() => parseWhen('feb 30', NOW)).toThrow(TimeParseError)
})

test('a bare time later today stays today', () => {
  const result = parsed('6pm')
  expect(result.getDate()).toBe(19)
  expect(result.getHours()).toBe(18)
})

test('a bare time that has already passed rolls to tomorrow', () => {
  const result = parsed('9am')
  expect(result.getDate()).toBe(20)
  expect(result.getHours()).toBe(9)
})

test('parses 24-hour times', () => {
  const result = parsed('23:45')
  expect(result.getHours()).toBe(23)
  expect(result.getMinutes()).toBe(45)
})

test('handles 12am and 12pm correctly', () => {
  expect(parsed('12pm').getHours()).toBe(12)
  expect(parsed('12am').getHours()).toBe(0)
})

test('is case insensitive', () => {
  expect(parsed('TOMORROW 9AM').getHours()).toBe(9)
})

test('rejects a time in the past', () => {
  expect(() => parseWhen('2020-01-01T09:00:00Z', NOW)).toThrow(/in the past/)
})

test('rejects an empty input', () => {
  expect(() => parseWhen('   ', NOW)).toThrow(TimeParseError)
})

test('rejects gibberish with a hint at what does work', () => {
  expect(() => parseWhen('next fortnight', NOW)).toThrow(/Could not understand/)
  expect(() => parseWhen('next fortnight', NOW)).toThrow(/tomorrow 9am/)
})

test('rejects an out-of-range clock time', () => {
  expect(() => parseWhen('25:00', NOW)).toThrow(TimeParseError)
  expect(() => parseWhen('13pm', NOW)).toThrow(TimeParseError)
})

test('always returns a UTC ISO string', () => {
  expect(parseWhen('+1h', NOW)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
})
