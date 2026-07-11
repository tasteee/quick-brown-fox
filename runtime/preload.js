'use strict'

// Minimal, safe preload. Apps are written as plain web UIs; QBF only exposes
// declared capabilities plus the local server URL.
const { contextBridge, ipcRenderer } = require('electron')

// Values are passed in via additionalArguments.
function readArg(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

const serverUrl = readArg('--qbf-server-url=')
const filesystemEnabled = readArg('--qbf-filesystem-enabled=') === 'true'

function openFilesystem(mode, options) {
  return ipcRenderer.invoke('qbf:filesystem:open', { mode, options })
}

try {
  contextBridge.exposeInMainWorld('qbf', {
    isDesktop: true,
    platform: process.platform,
    serverUrl,
    filesystem: filesystemEnabled
      ? {
          enabled: true,
          openFile: (options) => openFilesystem('file', options),
          openFiles: (options) => openFilesystem('files', options),
          openFolder: (options) => openFilesystem('folder', options),
          openFolders: (options) => openFilesystem('folders', options),
        }
      : { enabled: false },
  })
} catch {
  // contextIsolation disabled or already exposed - safe to ignore.
}
