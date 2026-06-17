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

function tsconfigPathsPlugin(projectRoot) {
  if (!fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) return null
  const tsconfigPaths =
    require('vite-tsconfig-paths').default || require('vite-tsconfig-paths')
  return tsconfigPaths({ root: projectRoot, projects: ['tsconfig.json'] })
}

/**
 * Vite config for the React UI (renderer), shared by the dev server and the
 * production build.
 *
 * Root is the generated QBF cache dir (which holds index.html). The user's
 * source lives outside that root, so we widen `server.fs.allow` and alias
 * react/react-dom to a single resolved copy to avoid duplicate-React bugs.
 */
function createViteConfig({ projectRoot, qbfDir, htmlFile, mode, outDir, port }) {
  const reactPlugin =
    require('@vitejs/plugin-react').default || require('@vitejs/plugin-react')

  const plugins = [reactPlugin()]
  const tsPaths = tsconfigPathsPlugin(projectRoot)
  if (tsPaths) plugins.push(tsPaths)

  const alias = {}
  const reactDir = packageDir('react', projectRoot)
  const reactDomDir = packageDir('react-dom', projectRoot)
  if (reactDir) alias['react'] = reactDir
  if (reactDomDir) alias['react-dom'] = reactDomDir

  const publicDir = fs.existsSync(path.join(projectRoot, 'public'))
    ? path.join(projectRoot, 'public')
    : false

  /** @type {import('vite').InlineConfig} */
  return {
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
}

/**
 * Vite config that bundles the user's server into a single self-contained CJS
 * file (Node target). All dependencies are inlined so the packaged app needs
 * no node_modules at runtime. Set `watch: true` for dev to get a RollupWatcher.
 */
function createServerViteConfig({ projectRoot, qbfDir, shim, outDir, watch }) {
  const plugins = []
  const tsPaths = tsconfigPathsPlugin(projectRoot)
  if (tsPaths) plugins.push(tsPaths)

  /** @type {import('vite').InlineConfig} */
  return {
    root: qbfDir,
    mode: watch ? 'development' : 'production',
    configFile: false,
    envDir: projectRoot,
    cacheDir: path.join(projectRoot, 'node_modules', '.vite-qbf-server'),
    clearScreen: false,
    logLevel: 'warn',
    plugins,
    build: {
      ssr: shim,
      outDir,
      emptyOutDir: false, // shares outDir with the renderer's parent folder
      target: 'node18',
      minify: false,
      sourcemap: false,
      watch: watch ? {} : null,
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'server.bundle.cjs',
          inlineDynamicImports: true,
        },
      },
    },
    ssr: {
      // Inline all deps so the packaged server is self-contained. Native
      // modules are the documented exception (add them to ssr.external).
      noExternal: true,
    },
  }
}

module.exports = { createViteConfig, createServerViteConfig }
