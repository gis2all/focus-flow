import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

type BuildConfig = {
  author: {
    name: string
  }
  scripts: {
    package: string
    'package:appx:dev': string
    'package:appx'?: string
    'appx:prepare-cert'?: string
    'package:all'?: string
  }
  build: {
    toolsets?: {
      winCodeSign?: string
    }
    directories?: {
      buildResources?: string
    }
    win: {
      icon: string
      executableName: string
      target: string[]
      signAndEditExecutable?: boolean
    }
    nsis: {
      oneClick?: boolean
      allowToChangeInstallationDirectory?: boolean
      selectPerMachineByDefault?: boolean
      artifactName: string
      uninstallDisplayName: string
    }
    portable: {
      artifactName: string
    }
    appx: {
      identityName: string
      applicationId: string
      displayName: string
      backgroundColor?: string
      publisherDisplayName: string
      publisher: string
      artifactName: string
    }
  }
}

const packageJsonPath = resolve(process.cwd(), 'package.json')
const packageHelperPath = resolve(process.cwd(), 'package-win.mjs')
const appxAssetPath = resolve(process.cwd(), 'main', 'assets', 'appx')
const packageConfig = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as BuildConfig

describe('package.json build config', () => {
  test('keeps the default Windows packaging flow on nsis and portable', () => {
    expect(existsSync(packageHelperPath)).toBe(true)
    expect(packageConfig.author.name).toBe('Github Gis2all')
    expect(packageConfig.scripts.package).toBe('npm run build && node ./package-win.mjs')
    expect(packageConfig.build.win.target).toEqual(['nsis', 'portable'])
    expect(packageConfig.build.win.icon).toBe('main/assets/focusflow-icon.ico')
    expect(packageConfig.build.win.executableName).toBe('focusflow')
    expect(packageConfig.build.nsis.oneClick).toBe(false)
    expect(packageConfig.build.nsis.allowToChangeInstallationDirectory).toBe(true)
    expect(packageConfig.build.nsis.selectPerMachineByDefault).toBe(false)
    expect(packageConfig.build.nsis.artifactName).toBe('focusflow-setup.${ext}')
    expect(packageConfig.build.nsis.uninstallDisplayName).toBe('FocusFlow')
    expect(packageConfig.build.portable.artifactName).toBe('focusflow-single.${ext}')
  })

  test('keeps appx packaging on a single signed development entrypoint', () => {
    expect(packageConfig.scripts['package:appx:dev']).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -File .\\tools\\appx\\package-dev.ps1'
    )
    expect(packageConfig.scripts['package:appx']).toBeUndefined()
    expect(packageConfig.scripts['appx:prepare-cert']).toBeUndefined()
    expect(packageConfig.scripts['package:all']).toBeUndefined()
    expect(packageConfig.build.toolsets?.winCodeSign).toBe('1.1.0')
    expect(packageConfig.build.directories?.buildResources).toBe('main/assets')
    expect(packageConfig.build.appx.identityName).toBe('FocusFlow.Desktop')
    expect(packageConfig.build.appx.applicationId).toBe('FocusFlow')
    expect(packageConfig.build.appx.displayName).toBe('FocusFlow')
    expect(packageConfig.build.appx.backgroundColor).toBe('transparent')
    expect(packageConfig.build.appx.publisherDisplayName).toBe('Github Gis2all')
    expect(packageConfig.build.appx.publisher).toBe('CN=gis2all')
    expect(packageConfig.build.appx.artifactName).toBe('focusflow-appx.${ext}')
  })

  test('includes unplated appx taskbar icon assets', () => {
    expect(existsSync(resolve(appxAssetPath, 'Square44x44Logo.png'))).toBe(true)
    expect(existsSync(resolve(appxAssetPath, 'Square44x44Logo.targetsize-24_altform-unplated.png'))).toBe(true)
    expect(existsSync(resolve(appxAssetPath, 'Square44x44Logo.targetsize-24_altform-lightunplated.png'))).toBe(true)
    expect(existsSync(resolve(appxAssetPath, 'Square44x44Logo.targetsize-32_altform-unplated.png'))).toBe(true)
    expect(existsSync(resolve(appxAssetPath, 'Square44x44Logo.targetsize-48_altform-unplated.png'))).toBe(true)
  })

  test('does not disable Windows executable icon editing', () => {
    expect(packageConfig.build.win.signAndEditExecutable).not.toBe(false)
  })
})
