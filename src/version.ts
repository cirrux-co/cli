declare const __CLI_VERSION__: string

// `__CLI_VERSION__` is replaced at build time by tsdown's define. Under the test
// runner (no define) it is undefined, so fall back rather than crash on import.
export const CLI_VERSION: string =
  typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : 'dev'
