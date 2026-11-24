#!/usr/bin/env node
/**
 * Print one version's CHANGELOG section, for the release body.
 *
 * This lives in a file rather than inline in the workflow because the publish
 * job used to carry the same logic inside a double-quoted `node -e` argument.
 * Bash expands `${…}` and `$&` inside those quotes before node ever sees them,
 * so a JavaScript character class turned into a bad substitution and the step
 * died — which skipped publishing entirely, on both tags that tried it.
 *
 * Usage: node scripts/release-notes.mjs <tag>
 * Silence and exit 0 when the tag has no section: the workflow then asks
 * GitHub for generated notes instead of writing an empty release.
 */
import { readFileSync } from 'node:fs'

const tag = (process.argv[2] ?? '').replace(/^v/, '')
if (tag === '') {
  console.error('usage: node scripts/release-notes.mjs <tag>')
  process.exit(2)
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n')
const start = lines.findIndex(line => line === `## ${tag}` || line.startsWith(`## ${tag} `))
if (start >= 0) {
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const section = lines.slice(start, end < 0 ? lines.length : end).join('\n').trim()
  if (section !== '') process.stdout.write(`${section}\n`)
}
