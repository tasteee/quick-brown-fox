'use strict'

const net = require('net')

/**
 * Find an available TCP port on the loopback interface. If `preferred` is given
 * and free, it is returned; otherwise the OS assigns one.
 */
function getFreePort(preferred) {
  return new Promise((resolve) => {
    const tryListen = (p, fallback) => {
      const srv = net.createServer()
      srv.unref()
      srv.on('error', () => {
        if (fallback) tryListen(0, false)
        else resolve(0)
      })
      srv.listen(p, '127.0.0.1', () => {
        const port = srv.address().port
        srv.close(() => resolve(port))
      })
    }
    tryListen(preferred || 0, !!preferred)
  })
}

module.exports = { getFreePort }
