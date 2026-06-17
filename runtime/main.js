'use strict'

// Electron main process used by quick-brown-fox for both `dev` and the
// packaged production app. The user never writes or imports this — QBF owns
// all of the Electron wiring.
//
// Behaviour is driven entirely by configuration so the same file works in
// dev (load a Vite dev-server URL) and in production (load a built
// index.html from disk):
//
//   dev  : QBF passes QBF_DEV_URL + QBF_WINDOW via the environment.
//   prod : a sibling qbf.config.json holds the window options; the renderer
//          is loaded from ./renderer/index.html.

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')

function loadConfig() {
  // Production: bundled config file written at build time.
  const cfgFile = path.join(__dirname, 'qbf.config.json')
  let fileCfg = {}
  try {
    fileCfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'))
  } catch {
    /* dev mode, or no file — fall back to env */
  }

  const envWindow = safeJSON(process.env.QBF_WINDOW) || {}
  return {
    devUrl: process.env.QBF_DEV_URL || null,
    openDevtools: process.env.QBF_OPEN_DEVTOOLS === 'true',
    window: Object.assign({ width: 1024, height: 768, title: 'App' }, fileCfg.window, envWindow),
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

function createWindow(cfg) {
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
    },
  })

  win.once('ready-to-show', () => win.show())

  // Open target=_blank / external links in the user's browser, not a new
  // Electron window.
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
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
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

  app.whenReady().then(() => {
    mainWindow = createWindow(cfg)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(cfg)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

start()
