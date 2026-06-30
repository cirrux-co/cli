import { test, expect } from 'bun:test'
import { buildFeedbackBody, FEEDBACK_PATH } from './feedback.js'

test('FEEDBACK_PATH targets the same endpoint as the website feedback button', () => {
  expect(FEEDBACK_PATH).toBe('api/feedback')
})

test('buildFeedbackBody tags the payload as coming from the CLI', () => {
  const body = buildFeedbackBody({
    message: 'the email command is great',
    email: 'jane@example.com',
    version: '1.2.3',
  })

  expect(body).toEqual({
    message: 'the email command is great',
    email: 'jane@example.com',
    url: '',
    client_version: '1.2.3',
    app: 'Cirrux CLI',
  })
})
