# 🦊 quick-brown-fox

**Zero-config bundler for desktop apps.** Write a normal React + TypeScript app,
run it as a real desktop app. No Electron wiring, no `BrowserWindow`, no
`main` / `preload` boilerplate — quick-brown-fox owns all of that.

Think of it like Parcel, but the output is a desktop application instead of a
website.

```
src/main.tsx  ──►  qbf dev    ──►  your app in a desktop window (with HMR)
              ──►  qbf build  ──►  a distributable installer / executable
```

## Why

You want to ship a small desktop app. You like React and TypeScript. You do
**not** want to learn Electron's process model, configure Vite, write a main
process, or wire up a preload script.

With quick-brown-fox you write an ordinary React app — the exact same code you'd
write for the browser — and point the tool at your entry file:

```jsonc
// package.json
{
  "scripts": {
    "dev": "qbf dev src/main.tsx",
    "build": "qbf build src/main.tsx"
  },
  "devDependencies": {
    "quick-brown-fox": "^0.1.0"
  }
}
```

That's the whole setup. All you need in your project is a `package.json` and a
`tsconfig.json`.

## Install

```sh
npm install -D quick-brown-fox
```

React, React DOM, Vite and Electron all come bundled with quick-brown-fox, so
you don't have to install or configure them yourself. (If you'd rather pin your
own version of React, just add it to your `dependencies` and it will be used.)

## Your first app

```
my-app/
  package.json
  tsconfig.json
  src/
    main.tsx
    App.tsx
```

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
```

```tsx
// src/App.tsx
import { useState } from 'react'

export function App() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>Clicked {n} times</button>
}
```

```sh
npm run dev      # opens a desktop window with hot reloading
npm run build    # produces an installer in dist-qbf/release
```

There is no `index.html` to write and no Electron code anywhere. It's just a
React app.

A complete, runnable example lives in [`examples/hello-world`](examples/hello-world).

## Commands

| Command           | What it does                                                    |
| ----------------- | -------------------------------------------------------------- |
| `qbf dev [entry]` | Start the Vite dev server and open the app in a desktop window |
| `qbf start`       | Alias for `dev`                                                |
| `qbf build`       | Build a distributable desktop app (installer / executable)     |
| `qbf bundle`      | Build just the app folder, skip packaging                      |
| `qbf help`        | Show help                                                      |

If you don't pass an entry, quick-brown-fox auto-detects one
(`src/main.tsx`, then `src/index.tsx`, `src/App.tsx`, …). You can also pass a
folder and it'll find the entry inside it.

### Options

| Option              | Default    | Description                          |
| ------------------- | ---------- | ------------------------------------ |
| `-e, --entry <p>`   | autodetect | Entry file or source folder          |
| `-o, --out <dir>`   | `dist-qbf` | Build output directory               |
| `-p, --port <n>`    | `5193`     | Dev server port                      |
| `--title <s>`       | app name   | Window title / product name          |
| `--width <n>`       | `1024`     | Window width                         |
| `--height <n>`      | `768`      | Window height                        |
| `--no-devtools`     | —          | Don't auto-open devtools in dev      |

### Configuration (optional)

Everything can be configured from the CLI, but you can also set defaults via a
`qbf` field in `package.json`:

```jsonc
{
  "qbf": {
    "entry": "src/main.tsx",
    "outDir": "dist-qbf",
    "window": {
      "width": 900,
      "height": 640,
      "title": "Hello World",
      "backgroundColor": "#1e1e1e"
    }
  }
}
```

Packaging is handled by [electron-builder](https://www.electron.build/). To
customise targets, signing, icons, etc., add a standard `build` field to your
`package.json` — quick-brown-fox merges it into its defaults.

## How it works

quick-brown-fox is a thin orchestration layer over **Vite** (renderer bundling +
HMR) and **Electron** (the desktop shell):

1. It generates an `index.html` and an entry shim inside `node_modules/.qbf`
   that import your real entry file. Your source tree is never modified.
2. `qbf dev` starts a Vite dev server and launches Electron pointed at it, so
   you get fast refresh in a native window.
3. `qbf build` bundles the renderer with Vite, stages an Electron app
   (main + preload + assets + a generated `package.json`), and hands it to
   electron-builder to produce an installer/executable.

Your app code runs in a sandboxed renderer with `contextIsolation` on and
`nodeIntegration` off — quick-brown-fox is deliberately **not** about exposing
native/Electron APIs. It's for shipping straightforward React apps as desktop
apps.

The only global it exposes is an inert `window.qbf = { isDesktop, platform }`
marker, in case your app wants to know it's running on the desktop.

## Requirements

- Node.js >= 18
- A `package.json` and (recommended) a `tsconfig.json`

## License

MIT
