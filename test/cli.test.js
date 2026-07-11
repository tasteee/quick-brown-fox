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
    '--framework',
    'solid',
    '--port',
    '4000',
    '--no-devtools',
    '--title',
    'My App',
  ])
  assert.strictEqual(command, 'build')
  assert.strictEqual(options.entry, 'source/index.tsx')
  assert.strictEqual(options.framework, 'solid')
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

function makeProject({ withServer, serverEntry = 'main.ts', pkg = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbf-test-'))
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(Object.assign({ name: 'demo', version: '1.2.3' }, pkg))
  )
  fs.mkdirSync(path.join(dir, 'source'))
  fs.writeFileSync(path.join(dir, 'source', 'main.tsx'), '// entry\n')
  if (withServer) {
    fs.mkdirSync(path.join(dir, 'server'))
    fs.writeFileSync(path.join(dir, 'server', serverEntry), 'export default () => {}\n')
  }
  return dir
}

test('autodetects source/main.tsx', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.entry, path.join(dir, 'source', 'main.tsx'))
  assert.strictEqual(cfg.framework.name, 'react')
  assert.deepStrictEqual(cfg.filesystem, { enabled: false })
  assert.strictEqual(cfg.appName, 'demo')
  assert.strictEqual(cfg.window.width, 1024)
})

test('filesystem access is enabled only when declared', () => {
  const dir = makeProject({ pkg: { qbf: { filesystem: true } } })
  const cfg = resolveConfig(dir, {})
  assert.deepStrictEqual(cfg.filesystem, { enabled: true })
})

test('filesystem access can use permissions alias', () => {
  const dir = makeProject({ pkg: { qbf: { permissions: { filesystem: true } } } })
  const cfg = resolveConfig(dir, {})
  assert.deepStrictEqual(cfg.filesystem, { enabled: true })
})

test('filesystem access can preserve object config', () => {
  const dir = makeProject({ pkg: { qbf: { filesystem: { bookmarks: true } } } })
  const cfg = resolveConfig(dir, {})
  assert.deepStrictEqual(cfg.filesystem, { enabled: true, bookmarks: true })
})

test('detects solid framework from dependencies', () => {
  const dir = makeProject({ pkg: { dependencies: { 'solid-js': '^1.9.0' } } })
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.framework.name, 'solid')
})

test('detects vue framework from dependencies', () => {
  const dir = makeProject({ pkg: { dependencies: { vue: '^3.5.0' } } })
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.framework.name, 'vue')
})

test('detects svelte framework from dependencies', () => {
  const dir = makeProject({ pkg: { devDependencies: { svelte: '^5.0.0' } } })
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.framework.name, 'svelte')
})

test('explicit framework config wins over dependency detection', () => {
  const dir = makeProject({
    pkg: {
      dependencies: { react: '^18.0.0' },
      qbf: { framework: { name: 'solid', options: { hot: false } } },
    },
  })
  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.framework.name, 'solid')
  assert.deepStrictEqual(cfg.framework.options, { hot: false })
})

test('cli framework overrides package config', () => {
  const dir = makeProject({ pkg: { qbf: { framework: 'react' } } })
  const cfg = resolveConfig(dir, { framework: 'vanilla' })
  assert.strictEqual(cfg.framework.name, 'vanilla')
})

test('unknown framework throws a helpful error', () => {
  const dir = makeProject()
  assert.throws(() => resolveConfig(dir, { framework: 'mystery' }), /Unknown framework/)
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

test('detects common server module formats', () => {
  for (const entry of ['main.mts', 'main.cts', 'main.mjs', 'main.cjs']) {
    const dir = makeProject({ withServer: true, serverEntry: entry })
    const cfg = resolveConfig(dir, {})
    assert.ok(cfg.server)
    assert.strictEqual(cfg.server.entry, path.join(dir, 'server', entry))
  }
})

test('explicit folder entry resolves inside it', () => {
  const dir = makeProject()
  const cfg = resolveConfig(dir, { entry: 'source' })
  assert.strictEqual(cfg.entry, path.join(dir, 'source', 'main.tsx'))
})

test('window has sane chrome defaults: no menu bar, framed, resizable', () => {
  const cfg = resolveConfig(makeProject(), {})
  assert.strictEqual(cfg.window.menuBar, false)
  assert.strictEqual(cfg.window.frame, true)
  assert.strictEqual(cfg.window.resizable, true)
  assert.strictEqual(cfg.window.fullscreen, false)
  assert.strictEqual(cfg.window.alwaysOnTop, false)
})

test('package.json qbf.window overrides chrome defaults', () => {
  const dir = makeProject()
  const pkgPath = path.join(dir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.qbf = { window: { menuBar: true, resizable: false, minWidth: 400 } }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg))

  const cfg = resolveConfig(dir, {})
  assert.strictEqual(cfg.window.menuBar, true)
  assert.strictEqual(cfg.window.resizable, false)
  assert.strictEqual(cfg.window.minWidth, 400)
  // untouched keys keep their defaults
  assert.strictEqual(cfg.window.frame, true)
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
  const { htmlFile, entryShim, renderShim } = prepareAppDir(cfg, 'development')
  const html = fs.readFileSync(htmlFile, 'utf8')
  const shim = fs.readFileSync(entryShim, 'utf8')
  const render = fs.readFileSync(renderShim, 'utf8')
  assert.ok(html.includes('<div id="root">'))
  assert.ok(html.includes('./entry.ts'))
  assert.ok(!html.includes('Content-Security-Policy')) // dev: no CSP
  assert.ok(shim.includes('../../source/main.tsx'))
  assert.ok(render.includes('react-dom/client'))
  assert.ok(render.includes('export function render'))
})

test('prepareAppDir writes a framework-specific render shim', () => {
  const dir = makeProject({ pkg: { qbf: { framework: 'solid' } } })
  const cfg = resolveConfig(dir, {})
  const { renderShim } = prepareAppDir(cfg, 'development')
  const render = fs.readFileSync(renderShim, 'utf8')
  assert.ok(render.includes('solid-js/web'))
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
  assert.ok(code.includes("mod.default || pick('handler') || pick('server') || mod"))
  assert.ok(code.includes('export default handler'))
  assert.ok(code.includes('../../server/main.ts'))
})

// eslint-disable-next-line no-console
console.log(`\n${passed} tests passed`)
