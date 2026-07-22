import { createRequire } from 'node:module'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const require = createRequire(import.meta.url)

export const projectRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'))

export const electronExecutable = require('electron')

const createElectronEnvironment = (userDataDirectory) => {
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  environment.FOCUSFLOW_E2E_USER_DATA_DIR = userDataDirectory
  return environment
}

export const launchFocusFlow = async ({ executablePath, args = [], userDataDirectory }) => {
  const application = await electron.launch({
    executablePath,
    args,
    cwd: projectRoot,
    env: createElectronEnvironment(userDataDirectory),
    timeout: 30_000
  })
  const window = await application.firstWindow({ timeout: 30_000 })
  await window.waitForLoadState('domcontentloaded')
  await window.waitForFunction(() => typeof window.focusFlow === 'object', undefined, { timeout: 30_000 })
  return { application, window }
}

export const removeTestDirectory = async (directory) => {
  let lastError = null
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error?.code)) throw error
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 200))
    }
  }
  throw lastError
}
