// quick-brown-fox/client — the typed helper your React UI uses to talk to the
// server/ backend. quick-brown-fox injects the server URL at runtime, so you
// never hard-code a port.
//
//   import { api } from 'quick-brown-fox/client'
//   const res = await api('/files')
//   const { files } = await res.json()

function base() {
  if (typeof window !== 'undefined' && window.qbf && window.qbf.serverUrl) {
    return window.qbf.serverUrl
  }
  // Running outside the desktop shell (e.g. plain browser preview): assume
  // same origin so relative paths still resolve.
  return ''
}

/** The base URL of the local server, e.g. "http://127.0.0.1:5197". */
export const serverUrl = base()

/** True when running inside the quick-brown-fox desktop shell. */
export const isDesktop =
  typeof window !== 'undefined' && !!(window.qbf && window.qbf.isDesktop)

function toUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const b = base()
  return b + (path.startsWith('/') ? path : '/' + path)
}

/** fetch() against the local server. Returns the raw Response. */
export function api(path, init) {
  return fetch(toUrl(path), init)
}

/** GET a path and parse the JSON response. */
api.get = async function get(path, init) {
  const res = await api(path, init)
  return res.json()
}

/** POST a JSON body to a path and parse the JSON response. */
api.post = async function post(path, body, init) {
  const res = await api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init && init.headers) },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  })
  return res.json()
}

export default api
