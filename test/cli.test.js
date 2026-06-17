'use strict'

// Lightweight assertion-based tests, runnable with plain `node` — no test
// framework dependency.
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { parseArgs } = require('../lib/cli')
const { resolveConfig } = require('../lib/config')
const { prepareAppDir } = require('../lib/html')

let passed = 0
function test(name, fn) {
  fn()
  passed++
  // eslint-disable-next-line no-console
  console.log(`  ok  ${name}`)
}

// ---- arg parsing -----------------------------------------------------------

test('parses command + positional entry', () => {
  const { command, options } = parseArgs(['dev', 'src/main.tsx'])
  assert.strictEqual(command, 'dev')
  assert.strictEqual(options.entry, 'src/main.tsx')
})

test('parses flags and aliases', () => {
  const { command, options } = parseArgs([
    'build',
    '-e',
    'src/index.tsx',
    '--port',
    '4000',
    '--no-devtools',
    '--title',
    'My App',
  ])
  assert.strictEqual(command, 'build')
  assert.strictEqual(options.entry, 'src/index.tsx')
  assert.strictEqual(options.port, 4000)
  assert.strictEqual(options.devtools, false)
  assert.strictEqual(options.title, 'My App')
})

test('positional does not override explicit --entry', () => {
  const { options } = parseArgs(['dev', 'folder', '--entry', 'real.tsx'])
  assert.strictEqual(options.entry, 'real.tsx')
})

test('unknown option throws', () => {
  assert.throws(() => parseArgs(['dev', '--nope']))
})

// ---- config + html generation ---------------------------------------------

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbf-test-'))
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', version: '1.2.3' })
  )
  fs.mkdirSync(path.join(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'src', 'main.tsx'), '// entry\n')
  return dir
}

test('autodetects src/main.tsx', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.entry, path.join(dir, 'src', 'main.tsx'))
  assert.strictEqual(cfg.appName, 'demo')
  assert.strictEqual(cfg.window.width, 1024)
})

test('explicit folder entry resolves inside it', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, { entry: 'src' })
  assert.strictEqual(cfg.entry, path.join(dir, 'src', 'main.tsx'))
})

test('cli overrides win over defaults', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, { title: 'Custom', width: 800 })
  assert.strictEqual(cfg.window.title, 'Custom')
  assert.strictEqual(cfg.window.width, 800)
})

test('missing entry throws a helpful error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbf-empty-'))
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}')
  assert.throws(() => resolveConfig(dir, {}), /Could not find an entry file/)
})

test('prepareAppDir writes html + shim pointing at the entry', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, {})
  const { htmlFile, entryShim } = prepareAppDir(cfg)
  const html = fs.readFileSync(htmlFile, 'utf8')
  const shim = fs.readFileSync(entryShim, 'utf8')
  assert.ok(html.includes('<div id="root">'))
  assert.ok(html.includes('./entry.ts'))
  assert.ok(shim.includes('../../src/main.tsx'))
})

// eslint-disable-next-line no-console
console.log(`\n${passed} tests passed`)
