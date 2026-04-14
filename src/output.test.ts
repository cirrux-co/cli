import { test, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import { output, outputError } from './output.js'
import { ExitCode } from './exit-codes.js'

let stdoutSpy: ReturnType<typeof spyOn>
let stderrSpy: ReturnType<typeof spyOn>
let exitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true)
  exitSpy = spyOn(process, 'exit').mockImplementation(((_code?: number) => {
    throw new Error(`__exit__:${_code ?? 0}`)
  }) as never)
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
  exitSpy.mockRestore()
})

test('output --json emits a single JSON line to stdout', () => {
  output({ hello: 'world' }, { json: true, text: 'unused' })
  expect(stdoutSpy).toHaveBeenCalledTimes(1)
  expect(stdoutSpy).toHaveBeenCalledWith('{"hello":"world"}\n')
})

test('output --quiet emits only the quietValue to stdout', () => {
  output({ hello: 'world' }, { quiet: true, text: 'human readable', quietValue: 'abc-123' })
  expect(stdoutSpy).toHaveBeenCalledWith('abc-123\n')
})

test('output --quiet with no quietValue emits a blank line', () => {
  output({}, { quiet: true, text: 'unused' })
  expect(stdoutSpy).toHaveBeenCalledWith('\n')
})

test('output default emits the text to stdout', () => {
  output({ hello: 'world' }, { text: 'Hello, world!' })
  expect(stdoutSpy).toHaveBeenCalledWith('Hello, world!\n')
  expect(stderrSpy).not.toHaveBeenCalled()
})

test('outputError --json writes structured error to stdout and exits with code', () => {
  expect(() =>
    outputError('Mailbox not found', {
      json: true,
      code: ExitCode.NOT_FOUND,
      hint: 'Check the UUID',
      errorType: 'not_found',
    }),
  ).toThrow('__exit__:3')

  expect(stdoutSpy).toHaveBeenCalledWith(
    '{"error":{"type":"not_found","message":"Mailbox not found","hint":"Check the UUID"}}\n',
  )
  expect(stderrSpy).not.toHaveBeenCalled()
  expect(exitSpy).toHaveBeenCalledWith(ExitCode.NOT_FOUND)
})

test('outputError default writes message and hint to stderr', () => {
  expect(() =>
    outputError('Not logged in.', {
      code: ExitCode.AUTH_REQUIRED,
      hint: "Run 'cirrux login' first.",
    }),
  ).toThrow('__exit__:4')

  expect(stderrSpy).toHaveBeenCalledWith('Error: Not logged in.\n')
  expect(stderrSpy).toHaveBeenCalledWith("Hint: Run 'cirrux login' first.\n")
  expect(stdoutSpy).not.toHaveBeenCalled()
})

test('outputError --json with no hint omits the hint field', () => {
  expect(() =>
    outputError('Boom', { json: true, code: ExitCode.GENERAL_FAILURE }),
  ).toThrow('__exit__:1')

  expect(stdoutSpy).toHaveBeenCalledWith('{"error":{"type":"error","message":"Boom"}}\n')
})
