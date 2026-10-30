import { test, expect } from 'bun:test'
import { birthdayValue, buildContactBody, parseJsonBody, parseTypedValue, usesFieldFlags } from './write.js'

test('a typed value splits on the first colon only after plain words', () => {
  expect(parseTypedValue('work:jane@acme.example', 'email')).toEqual({ email: 'jane@acme.example', types: ['work'] })
  expect(parseTypedValue('cell,voice: +31 6 1234 5678', 'phone')).toEqual({
    phone: '+31 6 1234 5678',
    types: ['cell', 'voice'],
  })
  expect(parseTypedValue('+31 6 1234 5678', 'phone')).toEqual({ phone: '+31 6 1234 5678' })
  expect(parseTypedValue('jane@acme.example', 'email')).toEqual({ email: 'jane@acme.example' })
})

test('a birthday is a full date, or a month and day without a year', () => {
  expect(birthdayValue('1980-03-14')).toBe('1980-03-14')
  expect(birthdayValue('03-14')).toBe('--03-14')
  expect(birthdayValue('--03-14')).toBe('--03-14')
  expect(birthdayValue('14 March')).toBeNull()
})

test('create sends what was passed, and needs a name, a company or an email', () => {
  expect(
    buildContactBody({ given: ' Jane ', family: 'Doe', email: ['work:jane@acme.example'], birthday: '03-14' }, 'create'),
  ).toEqual({
    body: {
      name_given: 'Jane',
      name_family: 'Doe',
      birthday: '--03-14',
      emails: [{ email: 'jane@acme.example', types: ['work'] }],
    },
  })
  expect(buildContactBody({ email: ['jane@acme.example'] }, 'create')).toHaveProperty('body')
  expect(buildContactBody({ notes: 'who?' }, 'create')).toMatchObject({
    error: 'A contact needs a name, a company or an email address.',
  })
})

// Repeating --phone builds the whole list; an empty string clears a field or a list.
test('update replaces the lists it is given and clears with empty strings', () => {
  expect(buildContactBody({ phone: ['+31 20 123 4567', 'cell:+31 6 1234 5678'] }, 'update')).toEqual({
    body: { phones: [{ phone: '+31 20 123 4567' }, { phone: '+31 6 1234 5678', types: ['cell'] }] },
  })
  expect(buildContactBody({ email: [''], notes: '', birthday: false }, 'update')).toEqual({
    body: { emails: [], notes: null, birthday: null },
  })
})

test('update with nothing to change, or a birthday that is no date, is a usage error', () => {
  expect(buildContactBody({}, 'update')).toMatchObject({ error: 'Nothing to change.' })
  expect(buildContactBody({ birthday: 'March' }, 'update')).toMatchObject({ error: '"March" is not a birthday.' })
})

test('--from-json takes one JSON object, and no field flags beside it', () => {
  expect(parseJsonBody('{"company": "Acme"}')).toEqual({ body: { company: 'Acme' } })
  expect(parseJsonBody('[1]')).toMatchObject({ error: 'The --from-json input must be one JSON object.' })
  expect(parseJsonBody('{nope')).toMatchObject({ error: 'The --from-json input is not valid JSON.' })
  expect(usesFieldFlags({ fromJson: '-', json: true })).toBe(false)
  expect(usesFieldFlags({ fromJson: '-', phone: ['+31 20 123 4567'] })).toBe(true)
  expect(usesFieldFlags({ fromJson: '-', birthday: false })).toBe(true)
})
