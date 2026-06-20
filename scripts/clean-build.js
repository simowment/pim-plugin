const fs = require('fs')
const path = require('path')

const SERVER_DIRECTORY = path.join(__dirname, '..', '.medusa', 'server')
const SERVER_SRC_DIRECTORY = path.join(SERVER_DIRECTORY, 'src')
const DUPLICATE_BUILD_ENTRIES = [
  'admin',
  'api',
  'lib',
  'links',
  'modules',
  'scripts',
  'subscribers',
  'workflows',
  'index.js',
  'index.d.ts',
]

function removeRuntimeTestArtifacts(directory) {
  if (!fs.existsSync(directory)) {
    return
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        fs.rmSync(fullPath, { recursive: true, force: true })
        continue
      }

      removeRuntimeTestArtifacts(fullPath)
      continue
    }

    if (/\.(spec|test)\.(js|d\.ts|js\.map)$/.test(entry.name)) {
      fs.rmSync(fullPath, { force: true })
    }
  }
}

function removeDuplicateBuildEntries() {
  for (const entry of DUPLICATE_BUILD_ENTRIES) {
    fs.rmSync(path.join(SERVER_DIRECTORY, entry), { recursive: true, force: true })
  }
}

removeRuntimeTestArtifacts(SERVER_SRC_DIRECTORY)
removeDuplicateBuildEntries()
