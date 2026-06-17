// quick-brown-fox/server — optional helper for authoring the backend handler.
//
// It is just an identity function that gives you full type inference and
// autocomplete on the context argument:
//
//   import { defineServer } from 'quick-brown-fox/server'
//   export default defineServer((ctx) => {
//     return { ok: true }
//   })
//
// You never have to use it — `export default (ctx) => { ... }` works the same.

export function defineServer(handler) {
  return handler
}

export default defineServer
