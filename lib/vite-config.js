'use strict'

const fs = require('fs')
const path = require('path')

function tryResolve(id, fromDir) {
  try {
    return require.resolve(id, { paths: [fromDir] })
  } catch {
    return null
  }
}

// Directory of an installed package, resolved from `fromDir` first (so the
// user's own copy wins) and falling back to QBF's bundled copy.
function packageDir(id, fromDir) {
  const found =
    tryResolve(`${id}/package.json`, fromDir) ||
    tryResolve(`${id}/package.json`, __dirname)
  return found ? path.dirname(found) : null
}

/**
 * Produce a Vite inline config shared by the dev server and the build.
 *
 * Root is the generated QBF cache dir (which holds index.html). The user's
 * source lives outside that root, so we widen `server.fs.allow` and alias
 * react/react-dom to a single resolved copy to avoid duplicate-React bugs.
 */
function createViteConfig({ projectRoot, qbfDir, htmlFile, mode, outDir, port }) {
  const reactPlugin = require('@vitejs/plugin-react').default || require('@vitejs/plugin-react')
  const tsconfigPaths =
    require('vite-tsconfig-paths').default || require('vite-tsconfig-paths')

  const plugins = [reactPlugin()]

  // Honour the user's tsconfig `paths` aliases without extra config on their end.
  if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
    plugins.push(tsconfigPaths({ root: projectRoot, projects: ['tsconfig.json'] }))
  }

  const alias = {}
  const reactDir = packageDir('react', projectRoot)
  const reactDomDir = packageDir('react-dom', projectRoot)
  if (reactDir) alias['react'] = reactDir
  if (reactDomDir) alias['react-dom'] = reactDomDir

  // Public assets: respect a conventional <project>/public folder.
  const publicDir = fs.existsSync(path.join(projectRoot, 'public'))
    ? path.join(projectRoot, 'public')
    : false

  /** @type {import('vite').InlineConfig} */
  const config = {
    root: qbfDir,
    base: './', // relative asset URLs so file:// loading works in production
    mode,
    configFile: false,
    publicDir,
    envDir: projectRoot,
    cacheDir: path.join(projectRoot, 'node_modules', '.vite-qbf'),
    clearScreen: false,
    plugins,
    resolve: {
      alias,
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: port || 5193,
      strictPort: false,
      fs: {
        // Allow importing the user's source, which lives above the QBF root.
        allow: [projectRoot, qbfDir, path.dirname(__dirname)],
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: htmlFile ? { input: htmlFile } : undefined,
      target: 'chrome120', // matches a modern Electron runtime
    },
  }

  return config
}

module.exports = { createViteConfig }
