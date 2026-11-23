import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'

// The client module id must be the package name: the Host looks a client plugin
// up by the name it is installed under, so a bundle that registers anything else
// mounts nothing — no error, just a sidebar that never changes.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// The two stylesheets are compiled into the client bundle as strings, so they have
// to be regenerated from their .css sources on every build — the .ts files are
// build products, not sources.
async function embedStylesheet(cssFile, moduleFile, exportName) {
  const css = readFileSync(new URL(`../src/client/${cssFile}`, import.meta.url), 'utf8')
  const body = [
    '/**',
    ` * The ${cssFile.replace('.css', '')} stylesheet, as a string the browser bundle can install.`,
    ' *',
    ` * Generated from ${cssFile} — edit that file, not this one.`,
    ' */',
    '',
    `export const ${exportName} = ${JSON.stringify(css)}`,
    '',
  ].join('\n')
  const target = new URL(`../src/client/${moduleFile}`, import.meta.url)
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    /* First run: the module does not exist yet. */
  }
  if (current === body) return
  await writeFile(target, body, 'utf8')
}

await embedStylesheet('card.css', 'stylesheet.ts', 'STYLESHEET')
await embedStylesheet('settings.css', 'settings-stylesheet.ts', 'SETTINGS_STYLESHEET')

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
