import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

type BuildConfig = {
  scripts: {
    package: string
  }
  build: {
    win: {
      icon: string
      executableName: string
      signAndEditExecutable?: boolean
    }
    nsis: {
      artifactName: string
    }
    portable: {
      artifactName: string
    }
  }
}

const packageJsonPath = resolve(process.cwd(), 'package.json')
const packageHelperPath = resolve(process.cwd(), 'package-windows-compat.mjs')
const packageConfig = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as BuildConfig

describe('package.json build config', () => {
  test('routes Windows packaging through the compatibility helper and keeps the expected artifact names', () => {
    expect(existsSync(packageHelperPath)).toBe(true)
    expect(packageConfig.scripts.package).toBe('npm run build && node ./package-windows-compat.mjs')
    expect(packageConfig.build.win.icon).toBe('main/assets/focusflow-icon.ico')
    expect(packageConfig.build.win.executableName).toBe('focusflow')
    expect(packageConfig.build.nsis.artifactName).toBe('focusflow-setup.${ext}')
    expect(packageConfig.build.portable.artifactName).toBe('focusflow.${ext}')
  })

  test('does not disable Windows executable icon editing', () => {
    expect(packageConfig.build.win.signAndEditExecutable).not.toBe(false)
  })
})
