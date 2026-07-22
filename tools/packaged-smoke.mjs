import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { launchFocusFlow, projectRoot, removeTestDirectory } from './electron-test-helpers.mjs'

const releaseDirectory = process.env.FOCUSFLOW_RELEASE_DIR
  ? resolve(process.env.FOCUSFLOW_RELEASE_DIR)
  : resolve(projectRoot, 'output', 'release')
const setupPath = resolve(releaseDirectory, 'focusflow-setup.exe')
const portablePath = resolve(releaseDirectory, 'focusflow-single.exe')
const unpackedPath = resolve(releaseDirectory, 'win-unpacked', 'focusflow.exe')
const metadataPath = resolve(releaseDirectory, 'latest.yml')

await Promise.all([setupPath, portablePath, unpackedPath, metadataPath].map((path) => access(path)))
const [setupStats, portableStats, unpackedStats, metadataStats] = await Promise.all(
  [setupPath, portablePath, unpackedPath, metadataPath].map((path) => stat(path))
)
for (const [label, artifactStats] of [
  ['focusflow-setup.exe', setupStats],
  ['focusflow-single.exe', portableStats],
  ['latest.yml', metadataStats]
]) {
  assert.ok(artifactStats.mtimeMs >= unpackedStats.mtimeMs, `${label} is older than the unpacked application`)
}
const metadata = await readFile(metadataPath, 'utf8')
assert.match(metadata, /path:\s+focusflow-setup\.exe/)

const userDataDirectory = await mkdtemp(join(tmpdir(), 'focusflow-packaged-smoke-'))
let application = null

try {
  const launched = await launchFocusFlow({
    executablePath: unpackedPath,
    userDataDirectory
  })
  application = launched.application
  assert.equal(await launched.window.title(), 'FocusFlow')
  assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
  assert.equal(await launched.window.evaluate(() => typeof window.focusFlow), 'object')
  console.log('Packaged smoke passed: artifacts, metadata, executable launch, and preload API')
} finally {
  await application?.close().catch(() => undefined)
  await removeTestDirectory(userDataDirectory).catch((error) => {
    console.warn(`Temporary packaged profile cleanup deferred: ${error?.code ?? error}`)
  })
}
