import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { electronExecutable, launchFocusFlow, projectRoot, removeTestDirectory } from './electron-test-helpers.mjs'

const taskTitle = `E2E persistence ${Date.now()}`
const userDataDirectory = await mkdtemp(join(tmpdir(), 'focusflow-e2e-'))
const mainEntry = resolve(projectRoot, 'output', 'build', 'main', 'index.js')
let application = null

try {
  const firstLaunch = await launchFocusFlow({
    executablePath: electronExecutable,
    args: [mainEntry],
    userDataDirectory
  })
  application = firstLaunch.application
  const { window } = firstLaunch

  assert.equal(await window.title(), 'FocusFlow')
  const rendererSecurity = await window.evaluate(() => ({
    processType: typeof process,
    requireType: typeof require,
    childWindowDenied: window.open('https://example.com') === null
  }))
  assert.deepEqual(rendererSecurity, {
    processType: 'undefined',
    requireType: 'undefined',
    childWindowDenied: true
  })

  const invalidMonthResult = await window.evaluate(async () => {
    try {
      await window.focusFlow.stats.getMonth({ year: 2026, month: 13 })
      return 'accepted'
    } catch (error) {
      return String(error)
    }
  })
  assert.match(invalidMonthResult, /month must be between 1 and 12/)

  await window.getByRole('button', { name: '待办', exact: true }).click()
  await window.getByRole('textbox', { name: '任务标题' }).fill(taskTitle)
  await window.getByRole('button', { name: '新增任务', exact: true }).click()
  await window.getByText(taskTitle, { exact: true }).waitFor()
  await window.getByRole('button', { name: `绑定任务 ${taskTitle}` }).click()
  await window.waitForFunction(async () => (await window.focusFlow.timer.getSnapshot()).status === 'running')

  await window.getByRole('button', { name: '计时', exact: true }).click()
  await window.getByRole('button', { name: '暂停', exact: true }).click()
  await window.waitForFunction(async () => (await window.focusFlow.timer.getSnapshot()).status === 'paused')

  await application.close()
  application = null

  const secondLaunch = await launchFocusFlow({
    executablePath: electronExecutable,
    args: [mainEntry],
    userDataDirectory
  })
  application = secondLaunch.application
  const restored = await secondLaunch.window.evaluate(async () => ({
    snapshot: await window.focusFlow.timer.getSnapshot(),
    board: await window.focusFlow.tasks.getBoard()
  }))

  assert.equal(restored.snapshot.status, 'paused')
  assert.equal(restored.snapshot.taskId, restored.board.activeItems.find((task) => task.title === taskTitle)?.id)

  console.log('Electron E2E passed: security, IPC validation, task flow, and restart persistence')
} finally {
  await application?.close().catch(() => undefined)
  await removeTestDirectory(userDataDirectory).catch((error) => {
    console.warn(`Temporary Electron profile cleanup deferred: ${error?.code ?? error}`)
  })
}
