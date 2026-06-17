'use strict'

const path = require('path')
const { spawn } = require('child_process')
const log = require('./log')
const { prepareAppDir, prepareServerShim } = require('./html')
const { createViteConfig, createServerViteConfig } = require('./vite-config')
const { getFreePort } = require('../runtime/net-utils')
const { startServerProcess } = require('../runtime/server-runner')

/**
 * `qbf dev` — start the backend (if any) and the Vite dev server, then launch
 * Electron pointed at it. The renderer gets HMR; the server is rebundled and
 * restarted on change. Closing the window (or Ctrl+C) tears everything down.
 */
async function dev(config) {
  const vite = await import('vite')

  log.step(`ui      ${log.c.cyan(path.relative(config.projectRoot, config.entry))}`)
  if (config.server) {
    log.step(`server  ${log.c.cyan(path.relative(config.projectRoot, config.server.entry))}`)
  }

  const cleanups = []
  let serverChild = null

  // ---- backend ------------------------------------------------------------
  let serverUrl = null
  if (config.server) {
    const port = await getFreePort(config.server.port)
    serverUrl = `http://127.0.0.1:${port}`

    const { shim } = prepareServerShim(config)
    // Output to a subfolder of the Vite root (not the root itself, which Vite
    // rightly refuses to overwrite).
    const serverOutDir = path.join(config.qbfDir, 'server-build')
    const bundleFile = path.join(serverOutDir, 'server.bundle.cjs')
    const serverConfig = createServerViteConfig({
      projectRoot: config.projectRoot,
      qbfDir: config.qbfDir,
      shim,
      outDir: serverOutDir,
      watch: true,
    })

    const restart = () => {
      if (serverChild && serverChild.exitCode === null) serverChild.kill()
      const started = startServerProcess({
        bundlePath: bundleFile,
        port,
        hostDir: path.join(__dirname, '..', 'runtime'),
      })
      serverChild = started.child
    }

    const watcher = await vite.build(serverConfig)
    let firstBuild = true
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END') {
        event.result && event.result.close()
        if (firstBuild) {
          firstBuild = false
          log.success(`server ready ${log.c.cyan(serverUrl)}`)
        } else {
          log.info('server changed — restarting')
        }
        restart()
      } else if (event.code === 'ERROR') {
        log.error(`server build error: ${event.error.message}`)
      }
    })
    cleanups.push(() => watcher.close())
  }

  // ---- renderer -----------------------------------------------------------
  const { htmlFile } = prepareAppDir(config, 'development')
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
  cleanups.push(() => server.close())

  const url = resolveServerUrl(server)
  if (!url) {
    await runCleanups(cleanups)
    throw new Error('Vite dev server did not report a URL.')
  }
  log.success(`dev server ${log.c.cyan(url)}`)

  // ---- electron -----------------------------------------------------------
  log.step('launching electron…')
  const electronProc = launchElectron(config, url, serverUrl)

  let shuttingDown = false
  const shutdown = async (code) => {
    if (shuttingDown) return
    shuttingDown = true
    safeKill(electronProc)
    safeKill(serverChild)
    await runCleanups(cleanups)
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
    const host =
      addr.address === '::' || addr.address === '0.0.0.0' ? 'localhost' : addr.address
    return `http://${host}:${addr.port}/`
  }
  return null
}

function launchElectron(config, devUrl, serverUrl) {
  const electronBinary = require('electron')
  const mainEntry = path.join(__dirname, '..', 'runtime', 'main.js')

  const env = Object.assign({}, process.env, {
    QBF_DEV_URL: devUrl,
    QBF_WINDOW: JSON.stringify(config.window),
    QBF_OPEN_DEVTOOLS: config.openDevtools ? 'true' : 'false',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  })
  if (serverUrl) env.QBF_SERVER_URL = serverUrl

  return spawn(electronBinary, [mainEntry], { stdio: 'inherit', env, windowsHide: false })
}

function safeKill(child) {
  try {
    if (child && child.exitCode === null) child.kill()
  } catch {
    /* ignore */
  }
}

async function runCleanups(cleanups) {
  for (const fn of cleanups.reverse()) {
    try {
      await fn()
    } catch {
      /* ignore */
    }
  }
}

module.exports = { dev }
