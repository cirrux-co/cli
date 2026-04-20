import { defineConfig } from 'tsdown'
import pkg from './package.json'

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
