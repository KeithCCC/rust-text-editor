[CmdletBinding()]
param(
  [string]$ProjectRoot,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PackageIdentityName,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Publisher,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PublisherDisplayName,

  [string]$Version,

  [ValidateSet("x64")]
  [string]$Architecture = "x64",

  [string]$IconPath,
  [string]$OutputPath,
  [string]$MakeAppxPath,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$BasePath
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function ConvertTo-MsixVersion {
  param([Parameter(Mandatory = $true)][string]$Value)

  if ($Value -notmatch '^\d+(\.\d+){0,3}$') {
    throw "MSIX version must contain one to four numeric components: $Value"
  }

  $parts = @($Value.Split('.') | ForEach-Object { [int]$_ })
  while ($parts.Count -lt 4) {
    $parts += 0
  }
  foreach ($part in $parts) {
    if ($part -lt 0 -or $part -gt 65535) {
      throw "Every MSIX version component must be between 0 and 65535: $Value"
    }
  }
  if ($parts[0] -eq 0) {
    throw "Microsoft Store package version first component must be between 1 and 65535: $Value"
  }
  if ($parts[3] -ne 0) {
    throw "Microsoft Store package version revision (fourth component) must be 0: $Value"
  }
  return ($parts -join '.')
}

function Find-MakeAppx {
  param([string]$RequestedPath)

  if ($RequestedPath) {
    $resolved = Resolve-FullPath -Path $RequestedPath -BasePath (Get-Location).Path
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      throw "MakeAppx.exe was not found at: $resolved"
    }
    return $resolved
  }

  $command = Get-Command makeappx.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $sdkRoot = "C:\Program Files (x86)\Windows Kits\10\bin"
  $candidate = Get-ChildItem -LiteralPath $sdkRoot -Recurse -Filter makeappx.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\makeappx\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $candidate) {
    throw "MakeAppx.exe was not found. Install the Windows 10/11 SDK."
  }
  return $candidate.FullName
}

function New-SquarePng {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][int]$Size
  )

  Add-Type -AssemblyName System.Drawing
  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  try {
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $scale = [Math]::Min($Size / $sourceImage.Width, $Size / $sourceImage.Height)
        $width = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $scale))
        $height = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $scale))
        $x = [int](($Size - $width) / 2)
        $y = [int](($Size - $height) / 2)
        $graphics.DrawImage($sourceImage, $x, $y, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

if (-not $ProjectRoot) {
  $ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
} else {
  $ProjectRoot = Resolve-FullPath -Path $ProjectRoot -BasePath (Get-Location).Path
}

$packageJsonPath = Join-Path $ProjectRoot "package.json"
$tauriConfigPath = Join-Path $ProjectRoot "src-tauri\tauri.conf.json"
if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $tauriConfigPath -PathType Leaf)) {
  throw "ProjectRoot is not the Koharu repository root: $ProjectRoot"
}

$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
if ($tauriConfig.productName -ne "Koharu") {
  throw "Expected Tauri productName 'Koharu', found '$($tauriConfig.productName)'"
}

if (-not $Version) {
  $Version = [string]$tauriConfig.version
}
$msixVersion = ConvertTo-MsixVersion -Value $Version

if (-not $IconPath) {
  $iconCandidates = @(
    (Join-Path $ProjectRoot "public\koharu-release-icon.png"),
    (Join-Path $ProjectRoot "src-tauri\icons\icon-source.png")
  )
  $IconPath = $iconCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
} else {
  $IconPath = Resolve-FullPath -Path $IconPath -BasePath $ProjectRoot
}
if (-not $IconPath -or -not (Test-Path -LiteralPath $IconPath -PathType Leaf)) {
  throw "A PNG source icon is required. Use -IconPath or add public/koharu-release-icon.png."
}

if (-not $SkipBuild) {
  $runningKoharu = Get-Process -Name koharu -ErrorAction SilentlyContinue
  if ($runningKoharu) {
    throw "Koharu is running. Close it before building; this script will not terminate it."
  }

  Push-Location $ProjectRoot
  try {
    & npm.cmd run tauri -- build --no-bundle
    if ($LASTEXITCODE -ne 0) {
      throw "Tauri release build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$releaseExe = Join-Path $ProjectRoot "target\release\koharu.exe"
if (-not (Test-Path -LiteralPath $releaseExe -PathType Leaf)) {
  throw "Koharu release executable is missing: $releaseExe"
}

if (-not $OutputPath) {
  $OutputPath = Join-Path $ProjectRoot "target\release\bundle\msix\Koharu_${msixVersion}_${Architecture}.msix"
} else {
  $OutputPath = Resolve-FullPath -Path $OutputPath -BasePath $ProjectRoot
}
$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$makeAppx = Find-MakeAppx -RequestedPath $MakeAppxPath
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("koharu-msix-" + [guid]::NewGuid().ToString("N"))
$assetsDirectory = Join-Path $stagingRoot "Assets"

try {
  New-Item -ItemType Directory -Path $assetsDirectory -Force | Out-Null
  Copy-Item -LiteralPath $releaseExe -Destination (Join-Path $stagingRoot "koharu.exe")
  New-SquarePng -Source $IconPath -Destination (Join-Path $assetsDirectory "StoreLogo.png") -Size 50
  New-SquarePng -Source $IconPath -Destination (Join-Path $assetsDirectory "Square44x44Logo.png") -Size 44
  New-SquarePng -Source $IconPath -Destination (Join-Path $assetsDirectory "Square150x150Logo.png") -Size 150

  $escapedIdentityName = [System.Security.SecurityElement]::Escape($PackageIdentityName)
  $escapedPublisher = [System.Security.SecurityElement]::Escape($Publisher)
  $escapedPublisherDisplayName = [System.Security.SecurityElement]::Escape($PublisherDisplayName)
  $manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap3 rescap">
  <Identity Name="$escapedIdentityName" Publisher="$escapedPublisher" Version="$msixVersion" ProcessorArchitecture="$Architecture" />
  <Properties>
    <DisplayName>Koharu</DisplayName>
    <PublisherDisplayName>$escapedPublisherDisplayName</PublisherDisplayName>
    <Description>Local-first Markdown editor</Description>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
    <Resource Language="ja-JP" />
  </Resources>
  <Applications>
    <Application Id="Koharu" Executable="koharu.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="Koharu"
        Description="Local-first Markdown editor"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png" />
      <Extensions>
        <uap3:Extension Category="windows.fileTypeAssociation">
          <uap3:FileTypeAssociation Name="markdown" Parameters="&quot;%1&quot;">
            <uap:SupportedFileTypes>
              <uap:FileType>.md</uap:FileType>
            </uap:SupportedFileTypes>
          </uap3:FileTypeAssociation>
        </uap3:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
  Set-Content -LiteralPath (Join-Path $stagingRoot "AppxManifest.xml") -Value $manifest -Encoding UTF8

  & $makeAppx pack /v /o /d $stagingRoot /p $OutputPath
  if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx failed with exit code $LASTEXITCODE"
  }
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
  throw "MSIX output was not created: $OutputPath"
}

$artifact = Get-Item -LiteralPath $OutputPath
$hash = Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
[pscustomobject]@{
  Path = $artifact.FullName
  Version = $msixVersion
  Architecture = $Architecture
  SizeBytes = $artifact.Length
  SHA256 = $hash.Hash
  Signed = $false
  SigningNote = "Microsoft Store signs this package after certification; sign separately only for local testing."
}
