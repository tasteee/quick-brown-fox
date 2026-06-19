'use strict'

const fs = require('fs')
const path = require('path')
const log = require('./log')
const { prepareAppDir, prepareServerShim } = require('./html')
const { createViteConfig, createServerViteConfig } = require('./vite-config')

// Runtime files copied next to the renderer when staging the app.
const RUNTIME_FILES = ['main.js', 'preload.js', 'server-host.js', 'server-runner.js', 'net-utils.js']

/**
 * `qbf build` — produce a distributable Windows desktop app.
 *
 *   1. Bundle the renderer (the React app) with Vite.
 *   2. Bundle the server/ backend (if any) into a single self-contained CJS.
 *   3. Assemble a staging app directory: Electron runtime + renderer + server
 *      + a generated package.json and runtime config.
 *   4. Package it into a Windows installer with electron-builder.
 *
 * Pass `{ packageApp: false }` to stop after step 3.
 */
async function build(config, opts = {}) {
  const packageApp = opts.packageApp !== false
  const vite = await import('vite')

  const appDir = path.join(config.outDir, 'app')
  const rendererOut = path.join(appDir, 'renderer')
  const releaseDir = path.join(config.outDir, 'release')

  log.step(`ui      ${log.c.cyan(path.relative(config.projectRoot, config.entry))}`)
  if (config.server) {
    log.step(`server  ${log.c.cyan(path.relative(config.projectRoot, config.server.entry))}`)
  }

  // 1. Bundle the renderer.
  const { htmlFile } = prepareAppDir(config, 'production')
  log.step('bundling UI with vite…')
  await vite.build(
    createViteConfig({
      projectRoot: config.projectRoot,
      qbfDir: config.qbfDir,
      htmlFile,
      mode: 'production',
      outDir: rendererOut,
    })
  )
  log.success(`UI → ${log.c.cyan(path.relative(config.projectRoot, rendererOut))}`)

  // 2. Bundle the server (optional).
  let hasServer = false
  if (config.server) {
    const { shim } = prepareServerShim(config)
    log.step('bundling server with vite…')
    await vite.build(
      createServerViteConfig({
        projectRoot: config.projectRoot,
        qbfDir: config.qbfDir,
        shim,
        outDir: appDir, // emits appDir/server.bundle.cjs
        watch: false,
      })
    )
    hasServer = true
    log.success('server → server.bundle.cjs')
  }

  // 3. Assemble the Electron app directory.
  log.step('assembling app…')
  stageApp(config, appDir)

  if (!packageApp) {
    log.success(`app assembled → ${log.c.cyan(path.relative(config.projectRoot, appDir))}`)
    return { appDir, hasServer }
  }

  // 4. Package with electron-builder (Windows).
  log.step('packaging Windows app with electron-builder (this can take a while)…')
  await packageWithBuilder(config, appDir, releaseDir)
  log.success(`desktop app → ${log.c.cyan(path.relative(config.projectRoot, releaseDir))}`)

  return { appDir, releaseDir, hasServer }
}

function stageApp(config, appDir) {
  fs.mkdirSync(appDir, { recursive: true })

  const runtimeDir = path.join(__dirname, '..', 'runtime')
  for (const file of RUNTIME_FILES) {
    fs.copyFileSync(path.join(runtimeDir, file), path.join(appDir, file))
  }

  // Runtime config (window options) consumed by main.js in production.
  fs.writeFileSync(
    path.join(appDir, 'qbf.config.json'),
    JSON.stringify(
      { window: config.window, serverPort: config.server ? config.server.port : null },
      null,
      2
    )
  )

  // A minimal package.json describing the Electron app. No electron dep here —
  // electron-builder pulls the runtime via the electronVersion we pass below.
  const pkg = config.pkg
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify(
      {
        name: sanitizeName(pkg.name || 'app'),
        productName: config.appName,
        version: pkg.version || '0.0.0',
        description: pkg.description || '',
        author: normalizeAuthor(pkg.author),
        main: 'main.js',
        private: true,
      },
      null,
      2
    )
  )
}

async function packageWithBuilder(config, appDir, releaseDir) {
  const builder = require('electron-builder')
  const electronVersion = getElectronVersion()

  const builderConfig = Object.assign(
    {
      appId: `com.qbf.${sanitizeName(config.pkg.name || 'app')}`,
      productName: config.appName,
      electronVersion,
      directories: { output: releaseDir },
      files: ['**/*'],
      // No icon by design — electron-builder falls back to a default.
      //
      // signAndEditExecutable:false skips the code-sign + exe-metadata step.
      // We don't sign, and that step is what makes electron-builder download
      // the `winCodeSign` package — an archive full of macOS symlinks that
      // Windows refuses to extract without the symlink privilege ("A required
      // privilege is not held by the client"). Skipping it lets unsigned
      // builds work on a normal user account, no admin / Developer Mode needed.
      win: { target: ['nsis'], signAndEditExecutable: false },
      nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
    },
    config.pkg.build || {}
  )

  // Windows only, for now.
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['nsis'], builder.Arch.x64),
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
