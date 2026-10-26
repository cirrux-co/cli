import { test, expect } from 'bun:test'
import { confirmationRefusal } from './confirm.js'

test('a declined prompt is cancelled', () => {
  expect(confirmationRefusal(true)).toEqual({ message: 'Cancelled.', errorType: 'not_confirmed' })
})

// Nobody was asked, so "Cancelled." would be wrong: the caller has to pass --yes.
test('without a terminal it says confirmation is needed', () => {
  expect(confirmationRefusal(false)).toEqual({
    message: 'Not deleted: this needs confirmation, and there is no terminal to ask in.',
    errorType: 'confirmation_required',
  })
})
