// Generate shields.io endpoint badge data (coverage / tests).
// Usage: run `npm run test:coverage`, then `node tools/badge.mjs`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
  } catch {
    return null
  }
}

function writeBadge(name, label, message, color) {
  const outDir = path.join(root, 'coverage')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, name), JSON.stringify({ schemaVersion: 1, label, message, color }))
  console.log(label + ': ' + message + ' (' + color + ')')
}

function colorFor(pct) {
  if (pct >= 90) return 'brightgreen'
  if (pct >= 80) return 'green'
  if (pct >= 70) return 'yellowgreen'
  if (pct >= 50) return 'yellow'
  return 'red'
}

// coverage (statements, matching the CI threshold)
const summary = readJson('coverage/coverage-summary.json')
if (summary) {
  const pct = Math.round(summary.total.statements.pct)
  writeBadge('coverage.json', 'coverage', pct + '%', colorFor(pct))
} else {
  writeBadge('coverage.json', 'coverage', 'n/a', 'lightgrey')
}

// tests (vitest json output)
const tr = readJson('output/test-results.json')
if (tr) {
  const msg = tr.numPassedTests + '/' + tr.numTotalTests + ' passed'
  writeBadge('tests.json', 'tests', msg, (tr.numFailedTests || 0) === 0 ? 'brightgreen' : 'red')
} else {
  writeBadge('tests.json', 'tests', 'n/a', 'lightgrey')
}
