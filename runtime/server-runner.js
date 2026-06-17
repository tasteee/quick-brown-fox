'use strict'

const { spawn } = require('child_process')
const path = require('path')

/**
 * Spawn the user's backend as a child process running server-host.js.
 *
 * Works from both contexts:
 *   - dev (parent is Node)     → process.execPath is node
 *   - prod (parent is Electron) → process.execPath is electron, so we set
 *     ELECTRON_RUN_AS_NODE to run it as a plain Node process.
 *
 * Returns { child, ready } where `ready` resolves once the server reports it is
 * listening (or after a timeout / early exit, so callers never hang).
 */
function startServerProcess({ bundlePath, port, hostDir }) {
  const hostScript = path.join(hostDir || __dirname, 'server-host.js')

  const env = Object.assign({}, process.env, {
    QBF_SERVER_BUNDLE: bundlePath,
    QBF_SERVER_PORT: String(port || 0),
  })
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1'

  const child = spawn(process.execPath, [hostScript], {
    env,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })

  const ready = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ port }), 8000)
    child.on('message', (msg) => {
      if (msg && msg.qbfReady) {
        clearTimeout(timer)
        resolve({ port: msg.port || port })
      }
    })
    child.on('exit', () => {
      clearTimeout(timer)
      resolve({ port })
    })
  })

  return { child, ready }
}

module.exports = { startServerProcess }
