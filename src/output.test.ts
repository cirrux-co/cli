import { test, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import { deferred, output, outputError } from './output.js'
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
  output({ hello: 'world' }, { json: true, text: () => 'unused' })
  expect(stdoutSpy).toHaveBeenCalledTimes(1)
  expect(stdoutSpy).toHaveBeenCalledWith('{"hello":"world"}\n')
})

test('output --quiet emits only the quietValue to stdout', () => {
  output({ hello: 'world' }, { quiet: true, text: () => 'human readable', quietValue: () => 'abc-123' })
  expect(stdoutSpy).toHaveBeenCalledWith('abc-123\n')
})

test('output --quiet with no quietValue emits a blank line', () => {
  output({}, { quiet: true, text: () => 'unused' })
  expect(stdoutSpy).toHaveBeenCalledWith('\n')
})

test('output default emits the text to stdout', () => {
  output({ hello: 'world' }, { text: () => 'Hello, world!' })
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

test('output --json never runs the text renderer', () => {
  let rendered = false
  output({ hello: 'world' }, {
    json: true,
    text: () => {
      rendered = true
      return 'unused'
    },
  })

  expect(rendered).toBe(false)
})

test('output --json survives a text renderer that throws', () => {
  output({ hello: 'world' }, {
    json: true,
    text: () => {
      throw new TypeError("Cannot read properties of undefined (reading 'name')")
    },
  })

  expect(stdoutSpy).toHaveBeenCalledWith('{"hello":"world"}\n')
})

test('output reports a throwing text renderer as format_error, not an API failure', () => {
  expect(() =>
    output({ hello: 'world' }, {
      json: false,
      text: () => {
        throw new TypeError("Cannot read properties of undefined (reading 'name')")
      },
    }),
  ).toThrow('__exit__:1')

  expect(stderrSpy).toHaveBeenCalledWith(
    "Error: Could not format the response for display: Cannot read properties of undefined (reading 'name')\n",
  )
  expect(stderrSpy).toHaveBeenCalledWith('Hint: Re-run with --json to get the raw response.\n')
})

test('output --quiet reports a throwing quietValue renderer as format_error', () => {
  expect(() =>
    output({ hello: 'world' }, {
      quiet: true,
      text: () => 'unused',
      quietValue: () => {
        throw new Error('boom')
      },
    }),
  ).toThrow('__exit__:1')

  expect(stderrSpy).toHaveBeenCalledWith('Error: Could not format the response for display: boom\n')
})

test('deferred formatters do not run under --json', () => {
  let calls = 0
  const format = (): { text: string; quietValue: string } => {
    calls += 1
    return { text: 'human', quietValue: 'uuid' }
  }

  output({ hello: 'world' }, { json: true, ...deferred(format) })
  expect(calls).toBe(0)

  output({ hello: 'world' }, { quiet: true, ...deferred(format) })
  expect(calls).toBe(1)
  expect(stdoutSpy).toHaveBeenLastCalledWith('uuid\n')
})
