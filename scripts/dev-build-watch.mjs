import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WATCH_PATHS = ['src', 'package.json']
const POLL_INTERVAL_MS = 2000
const BUILD_COMMAND = 'pnpm'
const BUILD_ARGS = ['build']
const READY_FILE = '.medusa/.dev-build-ready'
const WATCH_SKIP_DIRS = new Set(['.medusa', 'node_modules'])

let lastSignature = ''

function getSignature() {
  return WATCH_PATHS.flatMap(getPathSignatures).sort().join('|')
}

function getPathSignatures(path) {
  const stats = statSync(path)

  if (!stats.isDirectory()) {
    return [`${path}:${stats.mtimeMs}:${stats.size}`]
  }

  const entries = readdirSync(path, { withFileTypes: true })
  return entries.flatMap((entry) => {
    if (entry.isDirectory() && WATCH_SKIP_DIRS.has(entry.name)) {
      return []
    }

    return getPathSignatures(join(path, entry.name))
  })
}

function build() {
  rmSync(READY_FILE, { force: true })
  execFileSync(BUILD_COMMAND, BUILD_ARGS, { stdio: 'inherit' })
  writeFileSync(READY_FILE, `${Date.now()}\n`)
}

function poll() {
  const signature = getSignature()

  if (signature !== lastSignature) {
    lastSignature = signature
    build()
  }
}

poll()
setInterval(poll, POLL_INTERVAL_MS)
