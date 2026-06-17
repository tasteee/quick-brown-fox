'use strict'

const fs = require('fs')
const path = require('path')
const log = require('./log')
const { prepareAppDir } = require('./html')
const { createViteConfig } = require('./vite-config')

/**
 * `qbf build` — produce a distributable desktop app.
 *
 *   1. Bundle the renderer (the React app) with Vite.
 *   2. Assemble a staging app directory: Electron main/preload + renderer +
 *      a generated package.json and runtime config.
 *   3. Package it into an installer/executable with electron-builder.
 *
 * Pass `{ packageApp: false }` to stop after step 2 (useful for debugging or
 * when you only want the bundled assets).
 */
async function build(config, opts = {}) {
  const packageApp = opts.packageApp !== false
  const vite = require('vite')

  const rendererOut = path.join(config.outDir, 'app', 'renderer')
  const appDir = path.join(config.outDir, 'app')
  const releaseDir = path.join(config.outDir, 'release')

  log.step(`entry ${log.c.cyan(path.relative(config.projectRoot, config.entry))}`)

  // 1. Bundle the renderer.
  const { htmlFile } = prepareAppDir(config)
  const viteConfig = createViteConfig({
    projectRoot: config.projectRoot,
    qbfDir: config.qbfDir,
    htmlFile,
    mode: 'production',
    outDir: rendererOut,
  })

  log.step('bundling renderer with vite…')
  await vite.build(viteConfig)
  log.success(`renderer → ${log.c.cyan(path.relative(config.projectRoot, rendererOut))}`)

  // 2. Assemble the Electron app directory.
  log.step('assembling app…')
  stageApp(config, appDir)

  if (!packageApp) {
    log.success(`app assembled → ${log.c.cyan(path.relative(config.projectRoot, appDir))}`)
    return { appDir }
  }

  // 3. Package with electron-builder.
  log.step('packaging with electron-builder (this can take a while)…')
  await packageWithBuilder(config, appDir, releaseDir)
  log.success(`desktop app → ${log.c.cyan(path.relative(config.projectRoot, releaseDir))}`)

  return { appDir, releaseDir }
}

function stageApp(config, appDir) {
  fs.mkdirSync(appDir, { recursive: true })

  // Copy the Electron runtime in next to the renderer.
  const runtimeDir = path.join(__dirname, '..', 'runtime')
  for (const file of ['main.js', 'preload.js']) {
    fs.copyFileSync(path.join(runtimeDir, file), path.join(appDir, file))
  }

  // Runtime config (window options) consumed by main.js in production.
  fs.writeFileSync(
    path.join(appDir, 'qbf.config.json'),
    JSON.stringify({ window: config.window }, null, 2)
  )

  // A minimal package.json describing the Electron app. No electron dep here —
  // electron-builder pulls the runtime via the electronVersion we pass below.
  const pkg = config.pkg
  const appPkg = {
    name: sanitizeName(pkg.name || 'app'),
    productName: config.appName,
    version: pkg.version || '0.0.0',
    description: pkg.description || '',
    author: normalizeAuthor(pkg.author),
    main: 'main.js',
    private: true,
  }
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2))
}

async function packageWithBuilder(config, appDir, releaseDir) {
  const builder = require('electron-builder')
  const electronVersion = getElectronVersion()

  const userBuild = (config.pkg.build || {})
  const builderConfig = Object.assign(
    {
      appId: `com.qbf.${sanitizeName(config.pkg.name || 'app')}`,
      productName: config.appName,
      electronVersion,
      directories: { output: releaseDir },
      files: ['**/*'],
      // Sensible single-file-ish defaults per platform.
      linux: { target: ['AppImage'], category: 'Utility' },
      mac: { target: ['dmg'] },
      win: { target: ['nsis'] },
    },
    userBuild
  )

  await builder.build({
    projectDir: appDir,
    config: builderConfig,
  })
}

function getElectronVersion() {
  try {
    const pkgPath = require.resolve('electron/package.json', { paths: [__dirname] })
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version
  } catch {
    return undefined
  }
}

function sanitizeName(name) {
  return String(name)
    .replace(/^@.*\//, '')
    .replace(/[^a-z0-9-_]/gi, '-')
    .toLowerCase()
}

function normalizeAuthor(author) {
  if (!author) return 'quick-brown-fox'
  if (typeof author === 'string') return author
  if (author.name) return author.email ? `${author.name} <${author.email}>` : author.name
  return 'quick-brown-fox'
}

module.exports = { build }
