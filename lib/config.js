'use strict'

const fs = require('fs')
const path = require('path')

// Candidate entry files, in priority order, relative to the project root.
const DEFAULT_ENTRIES = [
  'src/main.tsx',
  'src/main.ts',
  'src/index.tsx',
  'src/index.ts',
  'src/main.jsx',
  'src/index.jsx',
  'src/App.tsx',
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
 * The user only has to provide a package.json and a tsconfig.json. Window
 * options, the app name, and so on are read from an optional `qbf` field in
 * package.json and can be overridden on the command line.
 */
function resolveConfig(cwd, cliOptions = {}) {
  const projectRoot = path.resolve(cwd)
  const pkgPath = path.join(projectRoot, 'package.json')
  const pkg = readJSON(pkgPath) || {}

  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      `No package.json found in ${projectRoot}. Run qbf from your project root.`
    )
  }

  const fileCfg = pkg.qbf || {}

  // Entry resolution: explicit CLI arg > package.json `qbf.entry` > autodetect.
  let entry = cliOptions.entry || fileCfg.entry
  if (entry) {
    entry = path.resolve(projectRoot, entry)
    // Allow pointing at a folder; look for a conventional entry inside it.
    if (fs.existsSync(entry) && fs.statSync(entry).isDirectory()) {
      const found = findEntryInDir(entry)
      if (!found) {
        throw new Error(
          `Could not find an entry file inside ${entry}. ` +
            `Expected one of: ${DEFAULT_ENTRIES.map((e) => path.basename(e)).join(', ')}`
        )
      }
      entry = found
    }
    if (!fs.existsSync(entry)) {
      throw new Error(`Entry file not found: ${entry}`)
    }
  } else {
    entry = autodetectEntry(projectRoot)
    if (!entry) {
      throw new Error(
        `Could not find an entry file. Looked for: ${DEFAULT_ENTRIES.join(', ')}.\n` +
          `Pass one explicitly, e.g. \`qbf dev src/main.tsx\`.`
      )
    }
  }

  const appName =
    cliOptions.title || fileCfg.name || pkg.productName || pkg.name || 'App'

  const window = Object.assign(
    { width: 1024, height: 768, title: appName },
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
    appName,
    window,
    outDir,
    // Cache dir holds the generated html + entry shim. Lives in node_modules
    // so it is git-ignored by default and never pollutes the user's source.
    qbfDir: path.join(projectRoot, 'node_modules', '.qbf'),
    port: cliOptions.port,
    devtools: cliOptions.devtools !== false,
    openDevtools: cliOptions.devtools !== false,
  }
}

function findEntryInDir(dir) {
  for (const name of DEFAULT_ENTRIES.map((e) => path.basename(e))) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

function autodetectEntry(projectRoot) {
  for (const rel of DEFAULT_ENTRIES) {
    const p = path.join(projectRoot, rel)
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

module.exports = { resolveConfig, DEFAULT_ENTRIES }
