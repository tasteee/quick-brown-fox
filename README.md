# 🦊 quick-brown-fox

**Zero-config bundler for desktop apps.** Write a normal web UI
and an optional Node server, and run the whole thing as a real desktop app. No
Electron wiring, no `BrowserWindow`, no `main` / `preload` boilerplate —
quick-brown-fox owns all of that.

Think of it like Parcel, but the output is a desktop application instead of a
website.

```
source/   ──►  your web UI              (runs in the window)
server/   ──►  your Node backend        (runs alongside it, full Node access)

qbf dev    ──►  the app in a desktop window, with hot reload
qbf build  ──►  a Windows installer (.exe)
```

## Why

You want to ship a small desktop app. You like React, Solid, Vue, Svelte, or
plain TypeScript. You do **not** want to learn Electron's process model, configure Vite, write a main
process, or wire up a preload script.

With quick-brown-fox you write:

- **`source/`** — an ordinary web app, the exact code you'd write for the
  browser. No Electron imports anywhere.
- **`server/`** — an optional Node backend with full access to the filesystem,
  databases, native modules, and so on.

The UI talks to the server over a local URL that quick-brown-fox wires up for
you, so the renderer stays sandboxed and plain while privileged work
happens in the server.

```jsonc
// package.json
{
  "scripts": {
    "dev": "qbf dev",
    "build": "qbf build"
  },
  "devDependencies": {
    "quick-brown-fox": "^0.2.0"
  }
}
```

All you need in your project is a `package.json`, a `tsconfig.json`, a
`source/` folder, and (optionally) a `server/` folder.

## Install

```sh
npm install -D quick-brown-fox
```

React, Solid, Vue, Svelte, Vite and Electron all come bundled with
quick-brown-fox. If your app depends on one of those framework packages,
quick-brown-fox auto-detects it. You can also set `qbf.framework` to `react`,
`solid`, `vue`, `svelte`, or `vanilla`.

> **Using pnpm?** pnpm blocks dependency build scripts by default, which stops
> Electron from downloading its binary (you'll see _"Electron failed to install
> correctly"_). Allow it by adding the following to your `package.json` and
> reinstalling, or run `pnpm approve-builds` and select `electron`:
>
> ```yaml
> # pnpm-workspace.yaml
> allowBuilds:
>   electron: true
>   esbuild: true
> ```

## Project layout

```
my-app/
  package.json
  tsconfig.json
  source/
    main.tsx        # UI entry
    App.tsx
  server/           # optional
    main.ts         # one handler function (.ts, .js, .mjs, .cjs, .mts, .cts)
```

### The UI (`source/`)

```tsx
// source/main.tsx
import { render } from 'quick-brown-fox/render'
import { App } from './App'

render(App)
```

```tsx
// source/App.tsx
import { useEffect, useState } from 'react'
import { api } from 'quick-brown-fox/client'

export function App() {
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    api.get<{ files: string[] }>('/files').then((d) => setFiles(d.files))
  }, [])

  return <ul>{files.map((f) => <li key={f}>{f}</li>)}</ul>
}
```

There is no `index.html` to write and no Electron code anywhere — it's just a
web app; React is only the default.

The helper mounts with the configured framework, defaults to React, and uses
`#root` unless you pass `render(App, { target: '#app', props: { ... } })`.

#### UI framework

React is the default. Solid, Vue, Svelte, and vanilla Vite apps are supported
too. quick-brown-fox auto-detects the framework from your package dependencies,
or you can set it explicitly:

```jsonc
{
  "qbf": {
    "framework": "solid"
  }
}
```

Use `qbf dev --framework vue` or `qbf build --framework svelte` when you want a
CLI override. Framework plugin options can be passed as JSON:

```jsonc
{
  "qbf": {
    "framework": {
      "name": "solid",
      "options": {}
    }
  }
}
```

### The server (`server/`)

The backend is a single micro-service handler. It runs in Node, so it can do
anything Node can. You get a `context` with the request already parsed for you;
return a value and it's sent as JSON.

```ts
// server/main.ts
import { readdir } from 'node:fs/promises'
import { defineServer } from 'quick-brown-fox/server'

export default defineServer(async (ctx) => {
  const { method, path, query, body } = ctx.request

  if (method === 'GET' && path === '/files') {
    const entries = await readdir(process.cwd())
    return { files: entries } // returned value → JSON response
  }

  if (method === 'POST' && path === '/echo') {
    return { youSent: body } // JSON bodies are parsed automatically
  }

  ctx.response.notFound()
})
```

`defineServer` is optional sugar for type inference — `export default (ctx) => …`
works exactly the same.

You can also export a plain Node request listener from `.js`, `.mjs`, `.cjs`,
`.ts`, `.mts`, or `.cts`:

```js
// server/main.cjs
module.exports = (req, res) => {
  res.end('ok')
}
```

#### The `context` object

| `ctx.request`     | Description                                                  |
| ----------------- | ----------------------------------------------------------- |
| `method`          | `"GET"`, `"POST"`, …                                         |
| `path`            | URL pathname, e.g. `/files`                                  |
| `query` / `params`| Parsed query-string parameters                              |
| `body`            | Parsed body (object for JSON/form, string for text, Buffer for binary) |
| `headers`         | Request headers                                             |

| `ctx.response`            | Description                                |
| ------------------------- | ------------------------------------------ |
| `json(data, code?)`       | Send JSON                                  |
| `text(data, code?)`       | Send plain text                            |
| `html(markup, code?)`     | Send HTML                                  |
| `status(code)`            | Set the status (chainable)                 |
| `header(name, value)`     | Set a header (chainable)                   |
| `redirect(url, code?)`    | Redirect                                   |
| `notFound(message?)`      | 404 JSON response                          |
| `raw`                     | The underlying Node response, for anything else |

`ctx.req` / `ctx.res` give you the raw Node objects if you want to plug in
middleware. Right now it's deliberately one function — compose your own
middleware by wrapping the handler.

### Talking to the server from the UI

```ts
import { api, serverUrl, isDesktop } from 'quick-brown-fox/client'

await api('/files')                 // → Response (like fetch)
await api.get('/files')             // → parsed JSON
await api.post('/echo', { a: 1 })   // → parsed JSON
```

quick-brown-fox injects the server URL at runtime, so you never hard-code a
port. (It's also on `window.qbf.serverUrl` if you'd rather not import anything.)

### Filesystem access

Filesystem access is opt-in. Declare it in `package.json`:

```jsonc
{
  "qbf": {
    "filesystem": true
  }
}
```

Then ask the user to choose files or folders from the UI:

```ts
import { filesystem } from 'quick-brown-fox/client'

const folder = await filesystem.openFolder({ title: 'Choose a project folder' })
const file = await filesystem.openFile({
  title: 'Choose a document',
  filters: [{ name: 'Documents', extensions: ['txt', 'md', 'json'] }],
})
```

The helpers return absolute paths, or `null` / `[]` when the user cancels.
Send selected paths to your `server/` handler when your app needs to watch,
read, write, or otherwise operate on them.

## Run it

```sh
npm run dev      # opens a desktop window with hot reloading (UI + server)
npm run build    # produces a Windows installer in dist-qbf/release
```

A complete, runnable example lives in
[`examples/hello-world`](examples/hello-world).

## Commands

| Command           | What it does                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `qbf dev [entry]` | Start the server + Vite dev server and open the app in a window   |
| `qbf start`       | Alias for `dev`                                                   |
| `qbf build`       | Build a Windows desktop installer                                 |
| `qbf bundle`      | Build just the app folder (UI + server), skip packaging          |
| `qbf help`        | Show help                                                         |

If you don't pass an entry, quick-brown-fox auto-detects one
(`source/main.tsx`, then `source/index.tsx`, …). The server entry is
auto-detected from `server/` (`server/main.ts`, …).

### Options

| Option              | Default    | Description                          |
| ------------------- | ---------- | ------------------------------------ |
| `-e, --entry <p>`   | autodetect | UI entry file or folder              |
| `--framework <name>`| autodetect | `react`, `solid`, `vue`, `svelte`, or `vanilla` |
| `-o, --out <dir>`   | `dist-qbf` | Build output directory               |
| `-p, --port <n>`    | `5193`     | Dev server port                      |
| `--title <s>`       | app name   | Window title / product name          |
| `--width <n>`       | `1024`     | Window width                         |
| `--height <n>`      | `768`      | Window height                        |
| `--no-devtools`     | —          | Don't auto-open devtools in dev      |

Server entries can be TypeScript or JavaScript, ESM or CommonJS: `.ts`, `.js`,
`.mjs`, `.cjs`, `.mts`, and `.cts` are all supported.

### Configuration (optional)

Everything can be set from the CLI, but you can also set defaults via a `qbf`
field in `package.json`:

```jsonc
{
  "qbf": {
    "entry": "source/main.tsx",
    "framework": "solid",
    "filesystem": true,
    "outDir": "dist-qbf",
    "server": { "entry": "server/main.ts", "port": 5197 },
    "window": {
      "width": 900,
      "height": 640,
      "title": "Hello World",
      "backgroundColor": "#1e1e1e",
      "menuBar": false,
      "resizable": true
    }
  }
}
```

#### Window options (`qbf.window`)

All of these are plain JSON — no Electron code required. Anything you don't
set falls back to a sensible default.

| Option            | Default     | Description                                          |
| ----------------- | ----------- | ----------------------------------------------------- |
| `width` / `height`| `1024`/`768`| Initial window size                                  |
| `minWidth` / `minHeight` | —     | Minimum size the window can be resized to             |
| `maxWidth` / `maxHeight` | —     | Maximum size the window can be resized to             |
| `title`           | app name    | Window title                                          |
| `backgroundColor` | `#ffffff`   | Background shown before the UI paints                 |
| `menuBar`         | `false`     | Show the native File/Edit/View/Window/Help menu bar    |
| `frame`           | `true`      | Show the OS window frame (title bar + border). `false` gives a borderless window |
| `resizable`       | `true`      | Whether the user can resize the window                |
| `maximizable`     | `true`      | Whether the maximize button/gesture works              |
| `minimizable`     | `true`      | Whether the minimize button/gesture works              |
| `fullscreenable`  | `true`      | Whether the window can go fullscreen                  |
| `fullscreen`      | `false`     | Start the window in fullscreen                         |
| `alwaysOnTop`     | `false`     | Keep the window above all others                       |

A common "simple utility app" setup — no menu bar, fixed size:

```jsonc
"window": { "width": 480, "height": 320, "menuBar": false, "resizable": false }
```

Packaging is handled by [electron-builder](https://www.electron.build/). The
build currently targets **Windows** (NSIS installer) and ships **without an
icon** by default. To customise targets, signing, icons, etc., add a standard
`build` field to your `package.json` — quick-brown-fox merges it into its
defaults.

## Troubleshooting

**"Electron failed to install correctly, please delete node_modules/electron
and try installing again"** — Electron's postinstall step (which downloads the
actual Electron binary) didn't run or didn't finish.

- **pnpm** blocks dependency install scripts by default. Add this to your
  `package.json` and reinstall, or run `pnpm approve-builds` and select
  `electron`:
  ```yaml
  # pnpm-workspace.yaml
  allowBuilds:
    electron: true
    esbuild: true
  ```
- **npm** runs install scripts by default, so this usually means a stale or
  interrupted install — often from switching package managers (e.g. running
  `npm install` over a `node_modules` that pnpm created) or a network blip
  mid-download. Fix: delete `node_modules` (and the lockfile if you switched
  package managers) and reinstall from scratch.

**`qbf build` fails with "Cannot create symbolic link : A required privilege is
not held by the client"** — this comes from electron-builder downloading its
`winCodeSign` package, whose archive contains macOS symlinks that Windows won't
extract without the symlink privilege.

quick-brown-fox avoids this for normal unsigned builds by skipping the
code-signing step (`win.signAndEditExecutable: false`), so you shouldn't hit it.
If you opt back into code signing (by adding your own `build.win` config), you'll
need that step — enable **Windows Developer Mode** (Settings → Privacy &
security → For developers → Developer Mode) or run the build from an
Administrator terminal, and clear the stale cache at
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` if a previous attempt left it
half-extracted.

## How it works

quick-brown-fox is a thin orchestration layer over **Vite** (bundling + HMR) and
**Electron** (the desktop shell):

1. It generates an `index.html` and entry shims inside `node_modules/.qbf` that
   import your real entry files. Your source tree is never modified.
2. The **server** is bundled into a single self-contained CJS file and run as a
   Node child process on a free local port. The UI receives that port at runtime
   via the preload bridge.
3. `qbf dev` starts the server, a Vite dev server for the UI, and Electron
   pointed at it — fast refresh for the UI, auto-restart for the server.
4. `qbf build` bundles the UI and server, stages an Electron app, and hands it
   to electron-builder to produce a Windows installer.

The UI runs in a sandboxed renderer with `contextIsolation` on and
`nodeIntegration` off — privileged work belongs in `server/`. The only global
exposed to the UI is `window.qbf = { isDesktop, platform, serverUrl }`.

## Requirements

- Node.js >= 20.19.0
- A `package.json`, a `tsconfig.json`, and a `source/` folder

## License

MIT
