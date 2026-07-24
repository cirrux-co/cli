import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

// Read package.json rather than importing it: on Node >= 22.18 tsdown loads
// this config with native type stripping, where a bare JSON import fails with
// ERR_IMPORT_ATTRIBUTE_MISSING. Older Node loads it through unrun, where the
// import works, so the breakage only shows up on the release runner.
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  outExtensions: () => ({ js: '.js' }),
  loader: {
    '.md': 'text',
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
})
