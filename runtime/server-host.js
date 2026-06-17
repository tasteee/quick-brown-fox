'use strict'

// The QBF server host. This is the actual process entry for the user's
// backend. It loads the Vite-bundled user handler and serves it over HTTP with
// a friendly, pre-processed context object.
//
// The user writes a single micro-service handler:
//
//   // server/main.ts
//   export default async function (ctx) {
//     if (ctx.request.path === '/files') {
//       return { files: await listFiles() }   // returned value -> JSON response
//     }
//     ctx.response.notFound()
//   }
//
// ctx.request  : { method, path, url, query, params, headers, body }
//                (body is parsed automatically for JSON / form payloads)
// ctx.response : { json, text, html, status, header, send, redirect, notFound, raw }
//
// Returning a value from the handler sends it as JSON. Throwing yields a 500.

const http = require('http')

const bundlePath = process.env.QBF_SERVER_BUNDLE
const port = parseInt(process.env.QBF_SERVER_PORT || '0', 10)

function loadHandler() {
  if (!bundlePath) fail('QBF_SERVER_BUNDLE was not provided.')
  let mod
  try {
    mod = require(bundlePath)
  } catch (err) {
    fail(`failed to load server bundle:\n${err && err.stack ? err.stack : err}`)
  }
  const handler = mod && (mod.default || mod)
  if (typeof handler !== 'function') {
    fail(
      'your server entry must `export default` a handler function, e.g.\n' +
        '  export default (ctx) => { ctx.response.json({ ok: true }) }'
    )
  }
  return handler
}

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(`[qbf:server] ${msg}`)
  process.exit(1)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return undefined
  const raw = Buffer.concat(chunks)
  const type = String(req.headers['content-type'] || '')
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw.toString('utf8'))
    } catch {
      return raw.toString('utf8')
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')))
  }
  if (type.startsWith('text/') || type === '') return raw.toString('utf8')
  return raw // binary payloads stay as a Buffer
}

function makeResponse(res) {
  const sent = () => res.headersSent || res.writableEnded
  const api = {
    raw: res,
    status(code) {
      res.statusCode = code
      return api
    },
    header(name, value) {
      res.setHeader(name, value)
      return api
    },
    send(body, contentType) {
      if (sent()) return api
      if (contentType) res.setHeader('Content-Type', contentType)
      res.end(body)
      return api
    },
    json(data, code) {
      if (code) res.statusCode = code
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return api.send(JSON.stringify(data))
    },
    text(data, code) {
      if (code) res.statusCode = code
      return api.send(String(data), 'text/plain; charset=utf-8')
    },
    html(markup, code) {
      if (code) res.statusCode = code
      return api.send(String(markup), 'text/html; charset=utf-8')
    },
    redirect(location, code) {
      res.statusCode = code || 302
      res.setHeader('Location', location)
      return api.send('')
    },
    notFound(message) {
      return api.json({ error: message || 'Not found' }, 404)
    },
    get sent() {
      return sent()
    },
  }
  return api
}

const handler = loadHandler()

const server = http.createServer(async (req, res) => {
  // The renderer may run from a file:// origin (production) or a localhost
  // origin (dev), so allow cross-origin calls from the desktop shell.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const response = makeResponse(res)
  try {
    const parsed = new URL(req.url, 'http://localhost')
    const request = {
      method: req.method,
      path: parsed.pathname,
      url: req.url,
      query: Object.fromEntries(parsed.searchParams),
      params: Object.fromEntries(parsed.searchParams), // alias for "any parameters"
      headers: req.headers,
      body: await readBody(req),
    }

    const ctx = { request, response, req, res }
    const result = await handler(ctx)

    // A returned value (when nothing was sent yet) becomes the JSON response.
    if (!response.sent) {
      if (result !== undefined) response.json(result)
      else response.notFound()
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[qbf:server] handler error:', err && err.stack ? err.stack : err)
    if (!response.sent) response.json({ error: 'Internal server error' }, 500)
  }
})

server.listen(port, '127.0.0.1', () => {
  const actual = server.address().port
  // eslint-disable-next-line no-console
  console.log(`[qbf:server] listening on http://127.0.0.1:${actual}`)
  if (process.send) process.send({ qbfReady: true, port: actual })
})

server.on('error', (err) => fail(`could not start: ${err.message}`))
