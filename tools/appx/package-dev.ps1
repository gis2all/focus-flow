Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Utf8NoBomEncoding {
  return [System.Text.UTF8Encoding]::new($false)
}

function Read-Utf8Text([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, (Get-Utf8NoBomEncoding))
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$packageHelperPath = Join-Path $projectRoot 'package-win.mjs'
$prepareScriptPath = Join-Path $PSScriptRoot 'prepare-dev-cert.ps1'
$devCertDirectory = Join-Path $projectRoot 'output\dev-cert'
$pfxPath = Join-Path $devCertDirectory 'focusflow-appx-dev.pfx'
$passwordPath = Join-Path $devCertDirectory 'focusflow-appx-dev-password.txt'

& $prepareScriptPath | Out-Null

if (-not (Test-Path -LiteralPath $pfxPath)) {
  throw "Expected PFX certificate at $pfxPath"
}

if (-not (Test-Path -LiteralPath $passwordPath)) {
  throw "Expected certificate password file at $passwordPath"
}

$password = (Read-Utf8Text -Path $passwordPath).Trim()
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "Certificate password file is empty: $passwordPath"
}

$previousWinCscLink = $env:WIN_CSC_LINK
$previousWinCscKeyPassword = $env:WIN_CSC_KEY_PASSWORD

try {
  $env:WIN_CSC_LINK = (Resolve-Path $pfxPath).Path
  $env:WIN_CSC_KEY_PASSWORD = $password

  Write-Host 'Building app before signed AppX packaging'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE"
  }

  Write-Host "Packaging signed AppX using development certificate"
  Write-Host "PFX: $($env:WIN_CSC_LINK)"

  & node $packageHelperPath appx
  if ($LASTEXITCODE -ne 0) {
    throw "node package-win.mjs appx failed with exit code $LASTEXITCODE"
  }
} finally {
  $env:WIN_CSC_LINK = $previousWinCscLink
  $env:WIN_CSC_KEY_PASSWORD = $previousWinCscKeyPassword
}
