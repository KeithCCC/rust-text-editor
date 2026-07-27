$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$skillRoot = Join-Path $repoRoot ".codex\skills\build-koharu-msix"
$skillFile = Join-Path $skillRoot "SKILL.md"
$buildScript = Join-Path $skillRoot "scripts\build-koharu-msix.ps1"

if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
  throw "Expected skill file is missing: $skillFile"
}
if (-not (Test-Path -LiteralPath $buildScript -PathType Leaf)) {
  throw "Expected build script is missing: $buildScript"
}

$scratch = Join-Path ([System.IO.Path]::GetTempPath()) ("koharu-msix-skill-" + [guid]::NewGuid().ToString("N"))
$fixture = Join-Path $scratch "fixture"
$unpacked = Join-Path $scratch "unpacked"
$output = Join-Path $scratch "Koharu_1.2.3.0_x64.msix"

try {
  New-Item -ItemType Directory -Path (Join-Path $fixture "scripts") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $fixture "src-tauri\icons") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $fixture "target\release") -Force | Out-Null

  @'
{
  "productName": "Koharu",
  "version": "1.2.3",
  "identifier": "lab.dailyai.koharu",
  "bundle": { "icon": ["icons/icon-source.png"] }
}
'@ | Set-Content -LiteralPath (Join-Path $fixture "src-tauri\tauri.conf.json") -Encoding UTF8

  Set-Content -LiteralPath (Join-Path $fixture "package.json") -Value '{"name":"koharu","version":"1.2.3","scripts":{"tauri":"node scripts/fake-tauri.cjs"}}' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $fixture "scripts\fake-tauri.cjs") -Value 'process.exit(0);' -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $fixture "target\release\koharu.exe") -Value "fixture executable" -Encoding ASCII

  Add-Type -AssemblyName System.Drawing
  $bitmap = [System.Drawing.Bitmap]::new(256, 256)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::CornflowerBlue)
    } finally {
      $graphics.Dispose()
    }
    $bitmap.Save((Join-Path $fixture "src-tauri\icons\icon-source.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bitmap.Dispose()
  }

  $invalidRevisionRejected = $false
  try {
    & $buildScript `
      -ProjectRoot $fixture `
      -PackageIdentityName "12345DailyAILab.Koharu" `
      -Publisher "CN=01234567-89AB-CDEF-0123-456789ABCDEF" `
      -PublisherDisplayName "Daily AI Lab" `
      -Version "1.2.3.4" `
      -OutputPath (Join-Path $scratch "invalid-revision.msix") `
      -SkipBuild
  } catch {
    if ($_.Exception.Message -match "revision") {
      $invalidRevisionRejected = $true
    } else {
      throw
    }
  }
  if (-not $invalidRevisionRejected) {
    throw "Store package versions with a non-zero revision must be rejected"
  }

  $zeroMajorRejected = $false
  try {
    & $buildScript `
      -ProjectRoot $fixture `
      -PackageIdentityName "12345DailyAILab.Koharu" `
      -Publisher "CN=01234567-89AB-CDEF-0123-456789ABCDEF" `
      -PublisherDisplayName "Daily AI Lab" `
      -Version "0.2.3.0" `
      -OutputPath (Join-Path $scratch "invalid-major.msix") `
      -SkipBuild
  } catch {
    if ($_.Exception.Message -match "first component") {
      $zeroMajorRejected = $true
    } else {
      throw
    }
  }
  if (-not $zeroMajorRejected) {
    throw "Store package versions with a zero first component must be rejected"
  }

  & $buildScript `
    -ProjectRoot $fixture `
    -PackageIdentityName "12345DailyAILab.Koharu" `
    -Publisher "CN=01234567-89AB-CDEF-0123-456789ABCDEF" `
    -PublisherDisplayName "Daily AI Lab" `
    -OutputPath $output

  if ($LASTEXITCODE -ne 0) {
    throw "MSIX build script exited with code $LASTEXITCODE"
  }
  if (-not (Test-Path -LiteralPath $output -PathType Leaf)) {
    throw "Expected MSIX output is missing: $output"
  }

  $makeAppx = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter makeappx.exe |
    Where-Object FullName -Match '\\x64\\makeappx\.exe$' |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $makeAppx) {
    throw "Windows SDK MakeAppx.exe was not found for fixture verification"
  }

  & $makeAppx unpack /p $output /d $unpacked /o | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx failed to unpack the fixture package"
  }

  [xml]$manifest = Get-Content -Raw (Join-Path $unpacked "AppxManifest.xml")
  $identity = $manifest.Package.Identity
  if ($identity.Name -ne "12345DailyAILab.Koharu") { throw "Package identity name was not preserved" }
  if ($identity.Publisher -ne "CN=01234567-89AB-CDEF-0123-456789ABCDEF") { throw "Publisher was not preserved" }
  if ($identity.Version -ne "1.2.3.0") { throw "Version was not normalized to four components" }
  if ($identity.ProcessorArchitecture -ne "x64") { throw "Architecture was not set to x64" }

  $resourceLanguages = @($manifest.Package.Resources.Resource | ForEach-Object { $_.Language })
  if ($resourceLanguages -notcontains "en-US") { throw "English package resource declaration is missing" }
  if ($resourceLanguages -notcontains "ja-JP") { throw "Japanese package resource declaration is missing" }

  foreach ($relativePath in @(
    "koharu.exe",
    "Assets\StoreLogo.png",
    "Assets\Square44x44Logo.png",
    "Assets\Square150x150Logo.png"
  )) {
    if (-not (Test-Path -LiteralPath (Join-Path $unpacked $relativePath) -PathType Leaf)) {
      throw "Expected packaged file is missing: $relativePath"
    }
  }

  Write-Output "PASS: build-koharu-msix contract and fixture package"
} finally {
  if (Test-Path -LiteralPath $scratch) {
    Remove-Item -LiteralPath $scratch -Recurse -Force
  }
}
