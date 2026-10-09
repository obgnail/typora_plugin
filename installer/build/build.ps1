<#
.SYNOPSIS
  Build the Typora plugin installer on Windows.

.DESCRIPTION
  Keep this file PURE ASCII (every byte 0x00-0x7F). Windows PowerShell 5.1 reads
  a BOM-less .ps1 with the system ANSI code page instead of UTF-8, so any
  non-ASCII byte here turns into garbage -- and a stray lead byte can swallow the
  byte after it, which is usually a closing quote, producing bogus parse errors
  such as "unexpected token }". Pure ASCII reads the same under every code page,
  so no BOM is needed and this works on any Windows locale.

  If the machine blocks unsigned scripts, run it through a bypassing host:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\build\build.ps1

.EXAMPLE
  .\build\build.ps1
  Self-contained single-file win-x64 exe (no .NET needed on the target machine).

.EXAMPLE
  .\build\build.ps1 -Test
  Run the unit tests before publishing.

.EXAMPLE
  .\build\build.ps1 -FrameworkDependent -CliOnly
  Publish the CLI only and framework-dependent (smaller; needs the .NET 8 runtime).
#>
[CmdletBinding()]
param(
    [string]$Rid = "win-x64",
    [string]$Configuration = "Release",
    [switch]$FrameworkDependent,
    [switch]$CliOnly,
    [switch]$Test
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "dist\$Rid"
$selfContained = if ($FrameworkDependent) { "false" } else { "true" }
# Compress the self-contained single file by default: 43 MB instead of 92 MB,
# paid for with extraction time on startup (acceptable for a desktop tool).
$compress = $selfContained

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet not found (the .NET 8 SDK is required)."
}

Write-Host "==> dotnet   : $(dotnet --version)"
Write-Host "==> target   : $Rid   config: $Configuration   self-contained: $selfContained"

if ($Test) {
    Write-Host "==> unit tests"
    dotnet test (Join-Path $root "tests\TyporaPluginInstaller.Tests\TyporaPluginInstaller.Tests.csproj") -c $Configuration --nologo
    if ($LASTEXITCODE -ne 0) { throw "unit tests failed." }
}

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

function Publish-Project([string]$project, [string]$label) {
    Write-Host "==> publishing $label"
    dotnet publish (Join-Path $root $project) `
        -c $Configuration `
        -r $Rid `
        --self-contained $selfContained `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:EnableCompressionInSingleFile=$compress `
        -o $out `
        --nologo
    if ($LASTEXITCODE -ne 0) { throw "$label failed to publish." }
}

if (-not $CliOnly) {
    Publish-Project "src\TyporaPluginInstaller.Gui\TyporaPluginInstaller.Gui.csproj" "GUI"
}
Publish-Project "src\TyporaPluginInstaller.Cli\TyporaPluginInstaller.Cli.csproj" "CLI"

Get-ChildItem $out -Filter *.pdb | Remove-Item -Force

Write-Host ""
Write-Host "==> output: $out"
Get-ChildItem $out | Format-Table Name, Length
