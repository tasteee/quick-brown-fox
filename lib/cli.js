'use strict'

const log = require('./log')

const VERSION = require('../package.json').version

const HELP = `
${log.c.magenta(log.c.bold('quick-brown-fox'))} — run a normal React + TypeScript app as a desktop app.

${log.c.bold('Usage')}
  qbf <command> [entry] [options]

${log.c.bold('Commands')}
  dev [entry]      Start the dev server and open the app in a desktop window
  start [entry]    Alias for "dev"
  build [entry]    Build a distributable desktop app (installer/executable)
  bundle [entry]   Build only the app folder, skip packaging
  help             Show this help
  version          Print the version

${log.c.bold('Arguments')}
  entry            Path to your entry file or source folder.
                   Defaults to src/main.tsx (then a few common fallbacks).

${log.c.bold('Options')}
  -e, --entry <path>     Entry file or folder (alternative to positional arg)
  -o, --out <dir>        Output directory for builds (default: dist-qbf)
  -p, --port <number>    Dev server port (default: 5193)
      --title <string>   Window title / product name
      --width <number>   Window width  (default: 1024)
      --height <number>  Window height (default: 768)
      --no-devtools      Don't auto-open devtools in dev

${log.c.bold('Example')}
  // package.json
  {
    "scripts": {
      "dev": "qbf dev src/main.tsx",
      "build": "qbf build src/main.tsx"
    }
  }
`

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(HELP)
}

/**
 * Parse argv into a { command, options } pair. Hand-rolled to keep QBF
 * dependency-free at the CLI layer.
 */
function parseArgs(argv) {
  const options = {}
  const positionals = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]

    switch (arg) {
      case '-e':
      case '--entry':
        options.entry = next()
        break
      case '-o':
      case '--out':
        options.out = next()
        break
      case '-p':
      case '--port':
        options.port = toInt(next())
        break
      case '--title':
        options.title = next()
        break
      case '--width':
        options.width = toInt(next())
        break
      case '--height':
        options.height = toInt(next())
        break
      case '--devtools':
        options.devtools = true
        break
      case '--no-devtools':
        options.devtools = false
        break
      case '-h':
      case '--help':
        options.help = true
        break
      case '-v':
      case '--version':
        options.version = true
        break
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`)
        }
        positionals.push(arg)
    }
  }

  const command = positionals.shift()
  // A leftover positional is treated as the entry path.
  if (positionals.length && options.entry === undefined) {
    options.entry = positionals[0]
  }

  return { command, options }
}

function toInt(v) {
  const n = parseInt(v, 10)
  if (Number.isNaN(n)) throw new Error(`Expected a number but got: ${v}`)
  return n
}

async function run(argv) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (err) {
    log.error(err.message)
    printHelp()
    return 1
  }

  const { command, options } = parsed

  if (options.version || command === 'version') {
    // eslint-disable-next-line no-console
    console.log(VERSION)
    return 0
  }

  if (options.help || !command || command === 'help') {
    printHelp()
    return command && command !== 'help' ? 1 : 0
  }

  const KNOWN = ['dev', 'start', 'build', 'bundle']
  if (!KNOWN.includes(command)) {
    log.error(`Unknown command: ${command}`)
    printHelp()
    return 1
  }

  // Resolve config lazily so `help`/`version` work outside a project.
  const { resolveConfig } = require('./config')

  let config
  try {
    config = resolveConfig(process.cwd(), options)
  } catch (err) {
    log.error(err.message)
    return 1
  }

  switch (command) {
    case 'dev':
    case 'start': {
      const { dev } = require('./dev')
      await dev(config)
      return 0
    }
    case 'build': {
      const { build } = require('./build')
      await build(config, { packageApp: true })
      return 0
    }
    case 'bundle': {
      const { build } = require('./build')
      await build(config, { packageApp: false })
      return 0
    }
    default:
      log.error(`Unknown command: ${command}`)
      printHelp()
      return 1
  }
}

module.exports = { run, parseArgs, printHelp }
