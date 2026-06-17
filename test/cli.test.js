'use strict'

// Lightweight assertion-based tests, runnable with plain `node` — no test
// framework dependency.
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { parseArgs } = require('../lib/cli')
const { resolveConfig } = require('../lib/config')
const { prepareAppDir, prepareServerShim } = require('../lib/html')

let passed = 0
function test(name, fn) {
  fn()
  passed++
  // eslint-disable-next-line no-console
  console.log(`  ok  ${name}`)
}

// ---- arg parsing -----------------------------------------------------------

test('parses command + positional entry', () => {
  const { command, options } = parseArgs(['dev', 'source/main.tsx'])
  assert.strictEqual(command, 'dev')
  assert.strictEqual(options.entry, 'source/main.tsx')
})

test('parses flags and aliases', () => {
  const { command, options } = parseArgs([
    'build',
    '-e',
    'source/index.tsx',
    '--port',
    '4000',
    '--no-devtools',
    '--title',
    'My App',
  ])
  assert.strictEqual(command, 'build')
  assert.strictEqual(options.entry, 'source/index.tsx')
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

function makeProject({ withServer } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbf-test-'))
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', version: '1.2.3' })
  )
  fs.mkdirSync(path.join(dir, 'source'))
  fs.writeFileSync(path.join(dir, 'source', 'main.tsx'), '// entry\n')
  if (withServer) {
    fs.mkdirSync(path.join(dir, 'server'))
    fs.writeFileSync(path.join(dir, 'server', 'main.ts'), 'export default () => {}\n')
  }
  return dir
}

test('autodetects source/main.tsx', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.entry, path.join(dir, 'source', 'main.tsx'))
  assert.strictEqual(cfg.appName, 'demo')
  assert.strictEqual(cfg.window.width, 1024)
})

test('server is null when there is no server/ folder', () => {
  const cfg = resolveConfig(makeProject(), {})
  assert.strictEqual(cfg.server, null)
})

test('detects server/main.ts when present', () => {
  const dir = makeProject({ withServer: true })
  const cfg = resolveConfig(dir, {})
  assert.ok(cfg.server)
  assert.strictEqual(cfg.server.entry, path.join(dir, 'server', 'main.ts'))
})

test('explicit folder entry resolves inside it', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, { entry: 'source' })
  assert.strictEqual(cfg.entry, path.join(dir, 'source', 'main.tsx'))
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
  assert.throws(() => resolveConfig(dir, {}), /Could not find a UI entry file/)
})

test('prepareAppDir writes html + shim pointing at the entry', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, {})
  const { htmlFile, entryShim } = prepareAppDir(cfg, 'development')
  const html = fs.readFileSync(htmlFile, 'utf8')
  const shim = fs.readFileSync(entryShim, 'utf8')
  assert.ok(html.includes('<div id="root">'))
  assert.ok(html.includes('./entry.ts'))
  assert.ok(!html.includes('Content-Security-Policy')) // dev: no CSP
  assert.ok(shim.includes('../../source/main.tsx'))
})

test('production html includes a CSP', () => {
  const cfg = resolveConfig(makeProject(), {})
  const { htmlFile } = prepareAppDir(cfg, 'production')
  assert.ok(fs.readFileSync(htmlFile, 'utf8').includes('Content-Security-Policy'))
})

test('prepareServerShim re-exports the server entry', () => {
  const dir = makeProject({ withServer: true })
  const cfg = resolveConfig(dir, {})
  const { shim } = prepareServerShim(cfg)
  const code = fs.readFileSync(shim, 'utf8')
  assert.ok(code.includes('export { default }'))
  assert.ok(code.includes('../../server/main.ts'))
})

// eslint-disable-next-line no-console
console.log(`\n${passed} tests passed`)
