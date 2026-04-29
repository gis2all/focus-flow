param(
  [switch]$ImportMachineTrustOnly,
  [string]$CerPath,
  [string]$Thumbprint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Utf8NoBomEncoding {
  return [System.Text.UTF8Encoding]::new($false)
}

function Read-Utf8Text([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, (Get-Utf8NoBomEncoding))
}

function Write-Utf8Text([string]$Path, [string]$Content) {
  $directory = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  }

  [System.IO.File]::WriteAllText($Path, $Content, (Get-Utf8NoBomEncoding))
}

function Get-ProjectRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Test-IsAdministrator {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-AppxPublisher([string]$ProjectRoot) {
  $packageJsonPath = Join-Path $ProjectRoot 'package.json'
  $packageConfig = Read-Utf8Text $packageJsonPath | ConvertFrom-Json
  $publisher = [string]$packageConfig.build.appx.publisher

  if ([string]::IsNullOrWhiteSpace($publisher)) {
    throw 'package.json build.appx.publisher is required for AppX development certificates.'
  }

  return $publisher
}

function Get-DevCertPaths([string]$ProjectRoot) {
  $certDirectory = Join-Path $ProjectRoot 'output\dev-cert'

  return @{
    Directory = $certDirectory
    Pfx = Join-Path $certDirectory 'focusflow-appx-dev.pfx'
    Cer = Join-Path $certDirectory 'focusflow-appx-dev.cer'
    Password = Join-Path $certDirectory 'focusflow-appx-dev-password.txt'
    Metadata = Join-Path $certDirectory 'metadata.json'
  }
}

function Read-Metadata([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  try {
    return Read-Utf8Text -Path $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function New-DevCertPassword {
  return ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
}

function Find-ReusableCertificate([string]$Publisher) {
  $now = Get-Date

  return Get-ChildItem -Path 'Cert:\CurrentUser\My' |
    Where-Object {
      $_.Subject -eq $Publisher -and
      $_.HasPrivateKey -and
      $_.NotAfter -gt $now
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
}

function New-DevelopmentCertificate([string]$Publisher) {
  $expiresAt = (Get-Date).AddYears(3)

  return New-SelfSignedCertificate `
    -Type Custom `
    -Subject $Publisher `
    -FriendlyName 'FocusFlow AppX Development' `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm 'SHA256' `
    -TextExtension @(
      '2.5.29.37={text}1.3.6.1.5.5.7.3.3',
      '2.5.29.19={text}'
    ) `
    -NotAfter $expiresAt
}

function Export-DevelopmentCertificate([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate, [hashtable]$Paths) {
  $password = New-DevCertPassword
  $securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force

  [System.IO.Directory]::CreateDirectory($Paths.Directory) | Out-Null

  Export-PfxCertificate -Cert $Certificate -FilePath $Paths.Pfx -Password $securePassword -Force | Out-Null
  Export-Certificate -Cert $Certificate -FilePath $Paths.Cer -Type CERT -Force | Out-Null
  Write-Utf8Text -Path $Paths.Password -Content $password

  return $password
}

function Ensure-CertificateImported([string]$StorePath, [string]$CerPath, [string]$CertificateThumbprint) {
  $existing = Get-ChildItem -Path $StorePath | Where-Object { $_.Thumbprint -eq $CertificateThumbprint } | Select-Object -First 1
  if ($null -eq $existing) {
    Import-Certificate -FilePath $CerPath -CertStoreLocation $StorePath | Out-Null
  }
}

function Ensure-CurrentUserTrust([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate, [string]$CerPath) {
  foreach ($storePath in @('Cert:\CurrentUser\TrustedPeople', 'Cert:\CurrentUser\TrustedPublisher')) {
    Ensure-CertificateImported -StorePath $storePath -CerPath $CerPath -CertificateThumbprint $Certificate.Thumbprint
  }
}

function Ensure-LocalMachineTrust([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate, [string]$CerPath) {
  $storePath = 'Cert:\LocalMachine\TrustedPeople'
  $existing = Get-ChildItem -Path $storePath | Where-Object { $_.Thumbprint -eq $Certificate.Thumbprint } | Select-Object -First 1
  if ($null -ne $existing) {
    return 'reused'
  }

  if (Test-IsAdministrator) {
    Ensure-CertificateImported -StorePath $storePath -CerPath $CerPath -CertificateThumbprint $Certificate.Thumbprint
    return 'imported'
  }

  $scriptPath = $PSCommandPath
  if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    throw 'Unable to determine script path for AppX machine trust import.'
  }

  Write-Host 'Requesting administrator elevation to import the AppX certificate into LocalMachine\TrustedPeople'
  $elevatedProcess = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @(
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      $scriptPath,
      '-ImportMachineTrustOnly',
      '-CerPath',
      $CerPath,
      '-Thumbprint',
      $Certificate.Thumbprint
    ) `
    -Verb RunAs `
    -Wait `
    -PassThru `
    -WindowStyle Hidden

  if ($elevatedProcess.ExitCode -ne 0) {
    throw "Failed to import the AppX certificate into LocalMachine\TrustedPeople. Exit code: $($elevatedProcess.ExitCode)"
  }

  $verifiedImport = Get-ChildItem -Path $storePath | Where-Object { $_.Thumbprint -eq $Certificate.Thumbprint } | Select-Object -First 1
  if ($null -eq $verifiedImport) {
    throw 'The AppX certificate was not found in LocalMachine\TrustedPeople after elevation.'
  }

  return 'imported'
}

function Write-CertificateMetadata([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate, [hashtable]$Paths, [string]$Publisher, [string]$State, [string]$MachineTrustState) {
  $metadata = [ordered]@{
    publisher = $Publisher
    thumbprint = $Certificate.Thumbprint
    subject = $Certificate.Subject
    notAfter = $Certificate.NotAfter.ToString('o')
    pfxPath = $Paths.Pfx
    cerPath = $Paths.Cer
    passwordPath = $Paths.Password
    state = $State
    machineTrustState = $MachineTrustState
    updatedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json -Depth 4

  Write-Utf8Text -Path $Paths.Metadata -Content $metadata
}

if ($ImportMachineTrustOnly) {
  if ([string]::IsNullOrWhiteSpace($CerPath)) {
    throw 'CerPath is required when -ImportMachineTrustOnly is used.'
  }

  if ([string]::IsNullOrWhiteSpace($Thumbprint)) {
    throw 'Thumbprint is required when -ImportMachineTrustOnly is used.'
  }

  if (-not (Test-Path -LiteralPath $CerPath)) {
    throw "Certificate file not found: $CerPath"
  }

  if (-not (Test-IsAdministrator)) {
    throw 'Administrator rights are required to import the AppX certificate into LocalMachine\TrustedPeople.'
  }

  Ensure-CertificateImported -StorePath 'Cert:\LocalMachine\TrustedPeople' -CerPath $CerPath -CertificateThumbprint $Thumbprint
  Write-Host "Imported AppX development certificate into LocalMachine\TrustedPeople"

  [pscustomobject]@{
    Thumbprint = $Thumbprint
    CertStoreLocation = 'LocalMachine\TrustedPeople'
    State = 'trusted'
  }
  return
}

$projectRoot = Get-ProjectRoot
$publisher = Get-AppxPublisher -ProjectRoot $projectRoot
$paths = Get-DevCertPaths -ProjectRoot $projectRoot

$certificate = Find-ReusableCertificate -Publisher $publisher
$state = 'reused'

if ($null -eq $certificate) {
  $certificate = New-DevelopmentCertificate -Publisher $publisher
  $state = 'created'
}

$hasExportFiles =
  (Test-Path -LiteralPath $paths.Pfx) -and
  (Test-Path -LiteralPath $paths.Cer) -and
  (Test-Path -LiteralPath $paths.Password)

$metadata = Read-Metadata -Path $paths.Metadata
$needsExport =
  ($state -eq 'created') -or
  (-not $hasExportFiles) -or
  ($null -eq $metadata) -or
  ($metadata.publisher -ne $publisher) -or
  ($metadata.thumbprint -ne $certificate.Thumbprint)

if ($needsExport) {
  Export-DevelopmentCertificate -Certificate $certificate -Paths $paths | Out-Null
} else {
  $storedPassword = Read-Utf8Text -Path $paths.Password
  if ([string]::IsNullOrWhiteSpace($storedPassword)) {
    Export-DevelopmentCertificate -Certificate $certificate -Paths $paths | Out-Null
  }
}

Ensure-CurrentUserTrust -Certificate $certificate -CerPath $paths.Cer
$machineTrustState = Ensure-LocalMachineTrust -Certificate $certificate -CerPath $paths.Cer
Write-CertificateMetadata -Certificate $certificate -Paths $paths -Publisher $publisher -State $state -MachineTrustState $machineTrustState

Write-Host "Prepared AppX development certificate for $publisher"
Write-Host "Thumbprint: $($certificate.Thumbprint)"
Write-Host "PFX: $($paths.Pfx)"
Write-Host "CER: $($paths.Cer)"
Write-Host "Machine trust: $machineTrustState"

[pscustomobject]@{
  Publisher = $publisher
  Thumbprint = $certificate.Thumbprint
  Subject = $certificate.Subject
  PfxPath = $paths.Pfx
  CerPath = $paths.Cer
  PasswordPath = $paths.Password
  MetadataPath = $paths.Metadata
  State = $state
  MachineTrustState = $machineTrustState
}
