<#
.SYNOPSIS
  在 Windows 上构建 Typora 插件安装器。

.EXAMPLE
  .\build\build.ps1
  自包含单文件 win-x64 exe（目标机无需安装 .NET）。

.EXAMPLE
  .\build\build.ps1 -Test
  先跑单元测试再发布。

.EXAMPLE
  .\build\build.ps1 -FrameworkDependent -CliOnly
  只发布命令行版本，且为框架依赖（体积小，目标机需要 .NET 8 运行时）。
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
# 自包含单文件默认开启压缩：43MB vs 92MB，代价是启动时解压（GUI 工具可接受）
$compress = $selfContained

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "找不到 dotnet（需要 .NET 8 SDK）。"
}

Write-Host "==> dotnet    : $(dotnet --version)"
Write-Host "==> 目标平台  : $Rid   配置: $Configuration   自包含: $selfContained"

if ($Test) {
    Write-Host "==> 单元测试"
    dotnet test (Join-Path $root "tests\TyporaPluginInstaller.Tests\TyporaPluginInstaller.Tests.csproj") -c $Configuration --nologo
    if ($LASTEXITCODE -ne 0) { throw "单元测试失败。" }
}

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

function Publish-Project([string]$project, [string]$label) {
    Write-Host "==> 发布 $label"
    dotnet publish (Join-Path $root $project) `
        -c $Configuration `
        -r $Rid `
        --self-contained $selfContained `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:EnableCompressionInSingleFile=$compress `
        -o $out `
        --nologo
    if ($LASTEXITCODE -ne 0) { throw "$label 发布失败。" }
}

if (-not $CliOnly) {
    Publish-Project "src\TyporaPluginInstaller.Gui\TyporaPluginInstaller.Gui.csproj" "GUI"
}
Publish-Project "src\TyporaPluginInstaller.Cli\TyporaPluginInstaller.Cli.csproj" "CLI"

Get-ChildItem $out -Filter *.pdb | Remove-Item -Force

Write-Host ""
Write-Host "==> 产物：$out"
Get-ChildItem $out | Format-Table Name, Length
