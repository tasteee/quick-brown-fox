'use strict'

// Tiny zero-dependency colour helper. Honours NO_COLOR and non-TTY output.
const enabled =
  process.stdout.isTTY && !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb'

function wrap(open, close) {
  return (s) => (enabled ? `[${open}m${s}[${close}m` : String(s))
}

const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
}

const TAG = c.magenta(c.bold('qbf'))

function info(msg) {
  // eslint-disable-next-line no-console
  console.log(`${TAG} ${msg}`)
}

function step(msg) {
  // eslint-disable-next-line no-console
  console.log(`${TAG} ${c.cyan('›')} ${msg}`)
}

function success(msg) {
  // eslint-disable-next-line no-console
  console.log(`${TAG} ${c.green('✓')} ${msg}`)
}

function warn(msg) {
  // eslint-disable-next-line no-console
  console.warn(`${TAG} ${c.yellow('!')} ${msg}`)
}

function error(msg) {
  // eslint-disable-next-line no-console
  console.error(`${TAG} ${c.red('✗')} ${msg}`)
}

module.exports = { c, info, step, success, warn, error }
