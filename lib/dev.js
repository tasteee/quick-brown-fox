'use strict'

const path = require('path')
const { spawn } = require('child_process')
const log = require('./log')
const { prepareAppDir } = require('./html')
const { createViteConfig } = require('./vite-config')

/**
 * `qbf dev` — start the Vite dev server and launch Electron pointed at it.
 * Provides HMR for the renderer; closing the window (or Ctrl+C) tears
 * everything down.
 */
async function dev(config) {
  const vite = require('vite')

  log.step(`entry ${log.c.cyan(path.relative(config.projectRoot, config.entry))}`)

  const { htmlFile } = prepareAppDir(config)

  const viteConfig = createViteConfig({
    projectRoot: config.projectRoot,
    qbfDir: config.qbfDir,
    htmlFile,
    mode: 'development',
    outDir: path.join(config.outDir, 'renderer'),
    port: config.port,
  })

  const server = await vite.createServer(viteConfig)
  await server.listen()

  const url = resolveServerUrl(server)
  if (!url) {
    await server.close()
    throw new Error('Vite dev server did not report a URL.')
  }

  log.success(`dev server ${log.c.cyan(url)}`)
  log.step('launching electron…')

  const electronProc = launchElectron(config, url)

  let shuttingDown = false
  const shutdown = async (code) => {
    if (shuttingDown) return
    shuttingDown = true
    try {
      if (electronProc && electronProc.exitCode === null) electronProc.kill()
    } catch {
      /* ignore */
    }
    try {
      await server.close()
    } catch {
      /* ignore */
    }
    process.exit(code || 0)
  }

  electronProc.on('close', (code) => {
    log.info('electron exited')
    shutdown(code)
  })
  electronProc.on('error', (err) => {
    log.error(`failed to launch electron: ${err.message}`)
    shutdown(1)
  })

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))

  // Keep the process alive; resolution happens via process.exit in shutdown.
  return new Promise(() => {})
}

function resolveServerUrl(server) {
  const urls = server.resolvedUrls
  if (urls && urls.local && urls.local.length) return urls.local[0]
  const addr = server.httpServer && server.httpServer.address()
  if (addr && typeof addr === 'object') {
    const host = addr.address === '::' || addr.address === '0.0.0.0' ? 'localhost' : addr.address
    return `http://${host}:${addr.port}/`
  }
  return null
}

function launchElectron(config, devUrl) {
  // The `electron` package exports the path to its binary when required in Node.
  const electronBinary = require('electron')
  const mainEntry = path.join(__dirname, '..', 'runtime', 'main.js')

  const env = Object.assign({}, process.env, {
    QBF_DEV_URL: devUrl,
    QBF_WINDOW: JSON.stringify(config.window),
    QBF_OPEN_DEVTOOLS: config.openDevtools ? 'true' : 'false',
    // Helps Electron run in restricted/headless CI sandboxes.
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  })

  return spawn(electronBinary, [mainEntry], {
    stdio: 'inherit',
    env,
    windowsHide: false,
  })
}

module.exports = { dev }
