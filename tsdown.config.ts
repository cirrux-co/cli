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
  // This package is a binary, not a library: it is private, has no exports/types
  // entry, and nothing imports it, so the declaration output was an empty
  // `export {}`. Generating it runs rolldown-plugin-dts, which declares
  // `peerDependencies: typescript@^5 || ^6` and reads a compiler host the
  // TypeScript 7 API no longer provides — it dies on `useCaseSensitiveFileNames`
  // of undefined. The monorepo lockfile happens to pin a rolldown old enough to
  // dodge it; the standalone cirrux-co/cli repo resolves fresh and did not.
  // Nothing consumes the types, so don't emit them rather than pinning around an
  // incompatibility that would resurface.
  dts: false,
  outExtensions: () => ({ js: '.js' }),
  loader: {
    '.md': 'text',
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
})
