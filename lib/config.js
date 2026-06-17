'use strict'

const fs = require('fs')
const path = require('path')

// Candidate UI entry files, in priority order, relative to the project root.
// The UI lives in `source/` — always the full word, never `src`.
const DEFAULT_ENTRIES = [
  'source/main.tsx',
  'source/main.ts',
  'source/index.tsx',
  'source/index.ts',
  'source/main.jsx',
  'source/index.jsx',
  'source/App.tsx',
]

// Candidate server entry files, in priority order. The server is optional; if
// there is no `server/` folder the app runs UI-only.
const SERVER_ENTRIES = [
  'server/main.ts',
  'server/index.ts',
  'server/main.js',
  'server/index.js',
  'server/server.ts',
]

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Resolve everything QBF needs to run, from a project root + CLI options.
 *
 * The user only has to provide a package.json and a tsconfig.json, a
 * `source/` folder for the React UI, and optionally a `server/` folder for a
 * Node backend. Window options and so on are read from an optional `qbf`
 * field in package.json and can be overridden on the command line.
 */
function resolveConfig(cwd, cliOptions = {}) {
  const projectRoot = path.resolve(cwd)
  const pkgPath = path.join(projectRoot, 'package.json')

  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      `No package.json found in ${projectRoot}. Run qbf from your project root.`
    )
  }

  const pkg = readJSON(pkgPath) || {}
  const fileCfg = pkg.qbf || {}

  const entry = resolveEntry(projectRoot, cliOptions.entry || fileCfg.entry)
  const server = resolveServer(projectRoot, fileCfg.server)

  const appName =
    cliOptions.title || fileCfg.name || pkg.productName || pkg.name || 'App'

  const window = Object.assign(
    {
      width: 1024,
      height: 768,
      title: appName,
      // The classic File/Edit/View/Window/Help bar. Off by default — most
      // small apps built with QBF don't need it and it looks out of place.
      menuBar: false,
      // The native OS title bar + border. Turn off for a borderless window
      // (you're then responsible for your own drag handle / close button).
      frame: true,
      resizable: true,
      maximizable: true,
      minimizable: true,
      fullscreenable: true,
      fullscreen: false,
      alwaysOnTop: false,
    },
    fileCfg.window || {},
    pruneUndefined({
      width: cliOptions.width,
      height: cliOptions.height,
      title: cliOptions.title,
    })
  )

  const outDir = path.resolve(
    projectRoot,
    cliOptions.out || fileCfg.outDir || 'dist-qbf'
  )

  return {
    projectRoot,
    pkg,
    entry,
    server, // null, or { entry, port }
    appName,
    window,
    outDir,
    // Cache dir holds generated html + entry shims. Lives in node_modules so
    // it is git-ignored by default and never pollutes the user's source.
    qbfDir: path.join(projectRoot, 'node_modules', '.qbf'),
    port: cliOptions.port,
    devtools: cliOptions.devtools !== false,
    openDevtools: cliOptions.devtools !== false,
  }
}

function resolveEntry(projectRoot, requested) {
  if (requested) {
    let entry = path.resolve(projectRoot, requested)
    if (fs.existsSync(entry) && fs.statSync(entry).isDirectory()) {
      const found = findIn(entry, DEFAULT_ENTRIES.map((e) => path.basename(e)))
      if (!found) {
        throw new Error(
          `Could not find an entry file inside ${entry}. ` +
            `Expected one of: ${DEFAULT_ENTRIES.map((e) => path.basename(e)).join(', ')}`
        )
      }
      return found
    }
    if (!fs.existsSync(entry)) throw new Error(`Entry file not found: ${entry}`)
    return entry
  }

  const auto = firstExisting(projectRoot, DEFAULT_ENTRIES)
  if (!auto) {
    throw new Error(
      `Could not find a UI entry file. Looked for: ${DEFAULT_ENTRIES.join(', ')}.\n` +
        `Pass one explicitly, e.g. \`qbf dev source/main.tsx\`.`
    )
  }
  return auto
}

function resolveServer(projectRoot, serverCfg) {
  serverCfg = serverCfg || {}
  const serverDir = path.join(projectRoot, 'server')

  // Explicit entry from config wins.
  let entry = null
  if (serverCfg.entry) {
    entry = path.resolve(projectRoot, serverCfg.entry)
    if (!fs.existsSync(entry)) throw new Error(`Server entry not found: ${entry}`)
  } else if (fs.existsSync(serverDir) && fs.statSync(serverDir).isDirectory()) {
    entry = firstExisting(projectRoot, SERVER_ENTRIES)
    if (!entry) {
      throw new Error(
        `A server/ folder exists but no entry file was found. ` +
          `Expected one of: ${SERVER_ENTRIES.map((e) => path.basename(e)).join(', ')}`
      )
    }
  }

  if (!entry) return null

  return {
    entry,
    // Preferred fixed port (optional). When omitted, a free port is chosen at
    // runtime and handed to the renderer automatically.
    port: serverCfg.port || null,
  }
}

function firstExisting(root, relPaths) {
  for (const rel of relPaths) {
    const p = path.join(root, rel)
    if (fs.existsSync(p)) return p
  }
  return null
}

function findIn(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

function pruneUndefined(obj) {
  const out = {}
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}

module.exports = { resolveConfig, DEFAULT_ENTRIES, SERVER_ENTRIES }
