import { copyFile, cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const { Arch } = require('builder-util')
const { getRceditBundle, getWindowsKitsBundle } = require('app-builder-lib/out/toolsets/windows')

const projectRoot = dirname(fileURLToPath(import.meta.url))
const cacheRoot = resolve(projectRoot, 'output', 'cache', 'electron-builder')
const legacyWinCodeSignReleaseName = 'winCodeSign-2.6.0'
const legacyWinCodeSignCacheDir = resolve(cacheRoot, 'winCodeSign', legacyWinCodeSignReleaseName)
const legacyWinCodeSignWindows10Dir = resolve(legacyWinCodeSignCacheDir, 'windows-10')
const defaultWindowsTargets = ['nsis', 'portable']
const allowedWindowsTargets = new Set(['nsis', 'portable', 'appx'])

function resolveWindowsTargets(argvTargets) {
  const targets = argvTargets.length > 0 ? argvTargets : defaultWindowsTargets

  for (const target of targets) {
    if (!allowedWindowsTargets.has(target)) {
      throw new Error(`Unsupported Windows packaging target: ${target}`)
    }
  }

  return targets
}

const requestedWindowsTargets = resolveWindowsTargets(process.argv.slice(2))
const hasExplicitWindowsSigningMaterial = Boolean(
  process.env.WIN_CSC_LINK ||
    process.env.CSC_LINK ||
    process.env.WIN_CSC_KEY_PASSWORD ||
    process.env.CSC_KEY_PASSWORD
)

if (!hasExplicitWindowsSigningMaterial && process.env.CSC_IDENTITY_AUTO_DISCOVERY == null) {
  // Keep the default packaging commands independent from any development cert
  // sitting in the current user's Windows certificate store.
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}

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

  if (!requestedWindowsTargets.includes('appx')) {
    return
  }

  const windowsKitsBundle = await getWindowsKitsBundle({ winCodeSign: '1.1.0', arch: Arch.x64 })
  await mkdir(legacyWinCodeSignWindows10Dir, { recursive: true })
  await cp(resolve(windowsKitsBundle.appxAssets, 'appxAssets'), resolve(legacyWinCodeSignCacheDir, 'appxAssets'), {
    force: true,
    recursive: true
  })
  await cp(resolve(windowsKitsBundle.appxAssets, 'x64'), resolve(legacyWinCodeSignWindows10Dir, 'x64'), {
    force: true,
    recursive: true
  })
  await cp(resolve(windowsKitsBundle.appxAssets, 'x86'), resolve(legacyWinCodeSignWindows10Dir, 'x86'), {
    force: true,
    recursive: true
  })
}

async function runWindowsPackaging() {
  const cliPath = resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js')
  // Keep the default release flow on nsis + portable unless the caller asks for another allowed target set.
  const windowsPackagingArgs = ['--win', ...requestedWindowsTargets]

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
