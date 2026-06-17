'use strict'

// Minimal, safe preload. quick-brown-fox is intentionally NOT about exposing
// Electron/native APIs — apps are written as plain React. We expose only a
// tiny, inert marker so app code can detect it is running inside the desktop
// shell if it ever needs to, without granting any privileged access.
const { contextBridge } = require('electron')

try {
  contextBridge.exposeInMainWorld('qbf', {
    isDesktop: true,
    platform: process.platform,
  })
} catch {
  // contextIsolation disabled or already exposed — safe to ignore.
}
