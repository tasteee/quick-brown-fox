'use strict'

// Minimal, safe preload. quick-brown-fox is intentionally NOT about exposing
// Electron/native APIs — apps are written as plain React. We expose only an
// inert marker plus the local server URL so the UI can talk to the backend.
const { contextBridge } = require('electron')

// The server URL is passed in via additionalArguments as --qbf-server-url=...
function readArg(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

const serverUrl = readArg('--qbf-server-url=')

try {
  contextBridge.exposeInMainWorld('qbf', {
    isDesktop: true,
    platform: process.platform,
    serverUrl,
  })
} catch {
  // contextIsolation disabled or already exposed — safe to ignore.
}
