import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

const temporaryDirectories = []
const smokeScript = resolve('tools', 'packaged-smoke.mjs')

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe('packaged smoke artifact validation', () => {
  test('rejects installers older than the unpacked application', async () => {
    const releaseDirectory = await mkdtemp(join(tmpdir(), 'focusflow-stale-package-'))
    temporaryDirectories.push(releaseDirectory)

    const unpackedDirectory = join(releaseDirectory, 'win-unpacked')
    const setupPath = join(releaseDirectory, 'focusflow-setup.exe')
    const portablePath = join(releaseDirectory, 'focusflow-single.exe')
    const unpackedPath = join(unpackedDirectory, 'focusflow.exe')
    const metadataPath = join(releaseDirectory, 'latest.yml')
    await mkdir(unpackedDirectory, { recursive: true })
    await Promise.all([
      writeFile(setupPath, 'stale setup'),
      writeFile(portablePath, 'stale portable'),
      writeFile(unpackedPath, 'fresh unpacked'),
      writeFile(metadataPath, 'path: focusflow-setup.exe\n')
    ])

    const staleTime = new Date('2025-01-01T00:00:00Z')
    const freshTime = new Date('2025-01-01T00:05:00Z')
    await Promise.all([
      utimes(setupPath, staleTime, staleTime),
      utimes(portablePath, staleTime, staleTime),
      utimes(metadataPath, staleTime, staleTime),
      utimes(unpackedPath, freshTime, freshTime)
    ])

    const result = spawnSync(process.execPath, [smokeScript], {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: { ...process.env, FOCUSFLOW_RELEASE_DIR: releaseDirectory }
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('older than the unpacked application')
  })
})
