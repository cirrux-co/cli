import { defineConfig } from 'tsup'
import pkg from './package.json'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  loader: {
    '.md': 'text',
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
})
