import { readdir } from 'node:fs/promises'
import { defineServer } from 'quick-brown-fox/server'

// The server is a single micro-service handler. It runs in Node with full
// access to the filesystem, databases, etc. The React UI calls it over the
// local server URL that quick-brown-fox wires up automatically.
//
// `ctx.request` gives you the method, path, query params and a parsed body.
// Return a value to send it as JSON, or use `ctx.response` for full control.
export default defineServer(async (ctx) => {
  const { method, path } = ctx.request

  if (method === 'GET' && path === '/time') {
    return { now: new Date().toLocaleTimeString() }
  }

  if (method === 'GET' && path === '/files') {
    const entries = await readdir(process.cwd(), { withFileTypes: true })
    return { files: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)) }
  }

  if (method === 'POST' && path === '/echo') {
    // ctx.request.body is already parsed when the payload is JSON.
    return { youSent: ctx.request.body }
  }

  ctx.response.notFound()
})
