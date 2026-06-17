#!/usr/bin/env node
'use strict'

// Thin entry point. All real logic lives in lib/cli.js so it can be unit
// tested without going through the shebang wrapper.
require('../lib/cli.js')
  .run(process.argv.slice(2))
  .then((code) => {
    if (typeof code === 'number' && code !== 0) process.exitCode = code
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err && err.stack ? err.stack : String(err))
    process.exitCode = 1
  })
