import { test, expect } from 'bun:test'
import { buildFeedbackBody, FEEDBACK_PATH } from './feedback.js'

test('FEEDBACK_PATH targets the same endpoint as the website feedback button', () => {
  expect(FEEDBACK_PATH).toBe('api/feedback')
})

test('buildFeedbackBody tags the payload as coming from the CLI', () => {
  const body = buildFeedbackBody({
    message: 'the email command is great',
    version: '1.2.3',
  })

  expect(body).toEqual({
    message: 'the email command is great',
    url: '',
    client_version: '1.2.3',
    app: 'Cirrux CLI',
  })
})

// The CLI used to send the signed-in username here, which is a login handle and
// not an address: feedback from a user named "usapieter" arrived claiming that as
// their shared email. The backend resolves the real sender instead.
test('buildFeedbackBody sends no reply address', () => {
  const body = buildFeedbackBody({ message: 'hello', version: '1.2.3' })

  expect('email' in body).toBe(false)
})
