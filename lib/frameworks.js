'use strict'

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const FRAMEWORKS = {
  react: {
    plugin: '@vitejs/plugin-react',
    runtimePackages: ['react', 'react-dom'],
    aliasPackages: ['react', 'react-dom'],
    dedupe: ['react', 'react-dom'],
  },
  solid: {
    plugin: 'vite-plugin-solid',
    runtimePackages: ['solid-js'],
    aliasPackages: [],
    dedupe: ['solid-js'],
  },
  vue: {
    plugin: '@vitejs/plugin-vue',
    runtimePackages: ['vue'],
    aliasPackages: [],
    dedupe: ['vue'],
  },
  svelte: {
    plugin: '@sveltejs/vite-plugin-svelte',
    exportName: 'svelte',
    defaultOptions: svelteDefaultOptions,
    runtimePackages: ['svelte'],
    aliasPackages: [],
    dedupe: ['svelte'],
  },
  vanilla: {
    plugin: null,
    runtimePackages: [],
    aliasPackages: [],
    dedupe: [],
  },
}

const FRAMEWORK_ALIASES = {
  none: 'vanilla',
}

function normalizeFramework(framework) {
  if (!framework) return { name: null, options: {} }

  if (typeof framework === 'string') {
    return { name: normalizeFrameworkName(framework), options: {} }
  }

  if (typeof framework === 'object') {
    const rawName = framework.name || framework.type || framework.framework
    return {
      name: normalizeFrameworkName(rawName),
      options: framework.options || {},
    }
  }

  throw new Error('qbf.framework must be a string or an object.')
}

function normalizeFrameworkName(name) {
  const normalized = String(name || '').trim().toLowerCase()
  const resolved = FRAMEWORK_ALIASES[normalized] || normalized
  if (!FRAMEWORKS[resolved]) {
    throw new Error(
      `Unknown framework "${name}". Expected one of: ${Object.keys(FRAMEWORKS).join(', ')}`
    )
  }
  return resolved
}

function detectFramework(pkg, explicitFramework) {
  const explicit = normalizeFramework(explicitFramework)
  if (explicit.name) return explicit

  const deps = Object.assign(
    {},
    pkg.dependencies || {},
    pkg.devDependencies || {},
    pkg.peerDependencies || {}
  )

  if (deps['solid-js']) return { name: 'solid', options: {} }
  if (deps.vue) return { name: 'vue', options: {} }
  if (deps.svelte || deps['@sveltejs/vite-plugin-svelte']) {
    return { name: 'svelte', options: {} }
  }
  if (deps.react || deps['react-dom']) return { name: 'react', options: {} }

  return { name: 'react', options: {} }
}

function frameworkLabel(framework) {
  return framework && framework.name ? framework.name : 'react'
}

function resolveModule(id, fromDir) {
  try {
    return require.resolve(id, { paths: [fromDir] })
  } catch {
    return require.resolve(id, { paths: [path.dirname(__dirname)] })
  }
}

function packageDir(id, fromDir) {
  try {
    const found = require.resolve(`${id}/package.json`, { paths: [fromDir] })
    return path.dirname(found)
  } catch {
    try {
      const found = require.resolve(`${id}/package.json`, {
        paths: [path.dirname(__dirname)],
      })
      return path.dirname(found)
    } catch {
      return null
    }
  }
}

async function loadModule(id, fromDir) {
  const resolved = resolveModule(id, fromDir)
  try {
    return require(resolved)
  } catch (err) {
    if (err && err.code !== 'ERR_REQUIRE_ESM') throw err
    return import(pathToFileURL(resolved).href)
  }
}

async function createFrameworkPlugin(framework, projectRoot) {
  framework = framework || { name: 'react', options: {} }
  const def = FRAMEWORKS[framework.name]
  if (!def || !def.plugin) return null

  const mod = await loadModule(def.plugin, projectRoot)
  const pluginFactory = (def.exportName && mod[def.exportName]) || mod.default || mod
  if (typeof pluginFactory !== 'function') {
    throw new Error(`Framework plugin ${def.plugin} did not export a function.`)
  }
  return pluginFactory(Object.assign({}, defaultOptions(def, projectRoot), framework.options || {}))
}

function createFrameworkResolveOptions(framework, projectRoot) {
  framework = framework || { name: 'react', options: {} }
  const def = FRAMEWORKS[framework.name] || FRAMEWORKS.react
  const alias = []

  if (framework.name === 'svelte') {
    const dir = packageDir('svelte', projectRoot)
    if (dir) {
      const svelteSrc = normalizePath(path.join(dir, 'src'))
      alias.push(
        { find: /^svelte$/, replacement: `${svelteSrc}/index-client.js` },
        { find: /^svelte\/(.+)$/, replacement: `${svelteSrc}/$1` }
      )
    }
  }

  for (const id of def.aliasPackages) {
    const dir = packageDir(id, projectRoot)
    if (dir) alias.push({ find: id, replacement: dir })
  }

  return {
    alias,
    dedupe: def.dedupe.slice(),
  }
}

function normalizePath(file) {
  return file.split(path.sep).join('/')
}

function defaultOptions(def, projectRoot) {
  return typeof def.defaultOptions === 'function' ? def.defaultOptions(projectRoot) : {}
}

function svelteDefaultOptions(projectRoot) {
  for (const name of [
    'svelte.config.js',
    'svelte.config.mjs',
    'svelte.config.cjs',
    'svelte.config.ts',
  ]) {
    const file = path.join(projectRoot, name)
    if (fs.existsSync(file)) return { configFile: file }
  }
  return { configFile: false }
}

module.exports = {
  FRAMEWORKS,
  detectFramework,
  frameworkLabel,
  createFrameworkPlugin,
  createFrameworkResolveOptions,
}
