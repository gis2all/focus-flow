import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const { getRceditBundle } = require('app-builder-lib/out/toolsets/windows')

const projectRoot = dirname(fileURLToPath(import.meta.url))
const cacheRoot = resolve(projectRoot, 'output', 'cache', 'electron-builder')
const legacyWinCodeSignReleaseName = 'winCodeSign-2.6.0'
const legacyWinCodeSignCacheDir = resolve(cacheRoot, 'winCodeSign', legacyWinCodeSignReleaseName)
const windowsPackagingArgs = ['--win', 'nsis', 'portable']

async function prepareWinCodeSignCompatibilityCache() {
  process.env.ELECTRON_BUILDER_CACHE = cacheRoot

  const rceditBundle = await getRceditBundle('1.1.0')

  // electron-builder still looks up this legacy release name on Windows when it
  // needs rcedit for exe icon/resource editing. We pre-seed only the files that
  // path actually needs so packaging stays stable on machines where extracting
  // the original upstream archive fails because it contains symlinks.
  await mkdir(legacyWinCodeSignCacheDir, { recursive: true })
  await copyFile(rceditBundle.x64, resolve(legacyWinCodeSignCacheDir, 'rcedit-x64.exe'))
  await copyFile(rceditBundle.x86, resolve(legacyWinCodeSignCacheDir, 'rcedit-ia32.exe'))
}

async function runWindowsPackaging() {
  const cliPath = resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js')

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cliPath, ...windowsPackagingArgs], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit'
    })

    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`electron-builder exited with code ${code ?? 'unknown'}`))
    })
  })
}

await prepareWinCodeSignCompatibilityCache()
await runWindowsPackaging()
