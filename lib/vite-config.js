'use strict'

const fs = require('fs')
const path = require('path')
const {
  createFrameworkPlugin,
  createFrameworkResolveOptions,
} = require('./frameworks')

/**
 * Vite config for the UI renderer, shared by the dev server and the
 * production build.
 *
 * Root is the generated QBF cache dir (which holds index.html). The user's
 * source lives outside that root, so we widen `server.fs.allow` and alias
 * framework runtimes to a single resolved copy to avoid duplicate-package bugs.
 */
async function createViteConfig({
  projectRoot,
  qbfDir,
  htmlFile,
  mode,
  outDir,
  port,
  framework,
}) {
  const plugins = []
  const frameworkPlugin = await createFrameworkPlugin(framework, projectRoot)
  if (frameworkPlugin) plugins.push(frameworkPlugin)

  const resolveOptions = createFrameworkResolveOptions(framework, projectRoot)
  const hasTsconfig = fs.existsSync(path.join(projectRoot, 'tsconfig.json'))
  const alias = [
    { find: 'quick-brown-fox/render', replacement: path.join(qbfDir, 'render.ts') },
    { find: 'quick-brown-fox/client', replacement: path.join(__dirname, '..', 'runtime', 'client.mjs') },
    ...resolveOptions.alias,
  ]

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
      dedupe: resolveOptions.dedupe,
      tsconfigPaths: hasTsconfig,
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
async function createServerViteConfig({ projectRoot, qbfDir, shim, outDir, watch }) {
  const hasTsconfig = fs.existsSync(path.join(projectRoot, 'tsconfig.json'))

  /** @type {import('vite').InlineConfig} */
  return {
    root: qbfDir,
    mode: watch ? 'development' : 'production',
    configFile: false,
    envDir: projectRoot,
    cacheDir: path.join(projectRoot, 'node_modules', '.vite-qbf-server'),
    clearScreen: false,
    logLevel: 'warn',
    plugins: [],
    resolve: {
      alias: [
        { find: 'quick-brown-fox/server', replacement: path.join(__dirname, '..', 'runtime', 'server.mjs') },
      ],
      tsconfigPaths: hasTsconfig,
    },
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
          codeSplitting: false,
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
