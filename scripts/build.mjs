import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'

// The client module id must be the package name: the Host looks a client plugin
// up by the name it is installed under, so a bundle that registers anything else
// mounts nothing — no error, just a sidebar that never changes.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const out = 'lib'
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// Declarations keep "types" honest for the published package.
execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' })

const shared = {
  bundle: true,
  sourcemap: false,
  logLevel: 'info',
}

await build({
  ...shared,
  entryPoints: ['src/host/index.ts'],
  outfile: `${out}/index.js`,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['@deepseek-ai/*', 'node:*'],
})

await build({
  ...shared,
  entryPoints: ['src/client/index.tsx'],
  outfile: `${out}/client.js`,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', '@deepseek-ai/*'],
  banner: { js: `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(pkg.name)},\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;` },
  footer: { js: '\t\treturn module.exports;\n\t}\n});' },
})
