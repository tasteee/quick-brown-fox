'use strict'

// Electron main process used by quick-brown-fox for both `dev` and the
// packaged production app. The user never writes or imports this — QBF owns
// all of the Electron wiring.
//
//   dev  : QBF passes QBF_DEV_URL (+ QBF_SERVER_URL if a backend is running)
//          via the environment. The dev orchestrator owns the server process.
//   prod : a sibling qbf.config.json holds the window options; the renderer is
//          loaded from ./renderer/index.html and, if a bundled server exists,
//          this process starts it.

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const { startServerProcess } = require('./server-runner')
const { getFreePort } = require('./net-utils')

function loadConfig() {
  let fileCfg = {}
  try {
    fileCfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'qbf.config.json'), 'utf8'))
  } catch {
    /* dev mode, or no file — fall back to env */
  }

  const envWindow = safeJSON(process.env.QBF_WINDOW) || {}
  return {
    devUrl: process.env.QBF_DEV_URL || null,
    serverUrl: process.env.QBF_SERVER_URL || null,
    serverPort: fileCfg.serverPort || null,
    openDevtools: process.env.QBF_OPEN_DEVTOOLS === 'true',
    window: Object.assign(
      { width: 1024, height: 768, title: 'App' },
      fileCfg.window,
      envWindow
    ),
  }
}

function safeJSON(s) {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

let serverChild = null

// In production this process owns the backend. In dev the orchestrator already
// started it and passes the URL via QBF_SERVER_URL.
async function ensureServer(cfg) {
  if (cfg.serverUrl) return cfg.serverUrl

  const bundlePath = path.join(__dirname, 'server.bundle.cjs')
  if (!fs.existsSync(bundlePath)) return null

  const port = await getFreePort(cfg.serverPort)
  const { child, ready } = startServerProcess({ bundlePath, port, hostDir: __dirname })
  serverChild = child
  await ready
  return `http://127.0.0.1:${port}`
}

function createWindow(cfg, serverUrl) {
  const win = new BrowserWindow({
    width: cfg.window.width,
    height: cfg.window.height,
    title: cfg.window.title,
    backgroundColor: cfg.window.backgroundColor || '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: serverUrl ? [`--qbf-server-url=${serverUrl}`] : [],
    },
  })

  win.once('ready-to-show', () => win.show())

  // Open external links in the user's browser, not a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (cfg.devUrl) {
    win.loadURL(cfg.devUrl)
    if (cfg.openDevtools) win.webContents.openDevTools({ mode: 'right' })
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }

  return win
}

function start() {
  const cfg = loadConfig()

  // Single-instance lock so re-launching focuses the existing window.
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  let mainWindow = null

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    let serverUrl = null
    try {
      serverUrl = await ensureServer(cfg)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[qbf] failed to start server:', err)
    }

    mainWindow = createWindow(cfg, serverUrl)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(cfg, serverUrl)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    if (serverChild && serverChild.exitCode === null) {
      try {
        serverChild.kill()
      } catch {
        /* ignore */
      }
    }
  })
}

start()
