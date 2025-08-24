Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Typora Plugin Uninstaller"

$banner = @"
    ______                        ___  __          _
   /_  __/_ _____  ___  _______ _/ _ \/ /_ _____ _(_)__
    / / / // / _ \/ _ \/ __/ _ ``/ ___/ / // / _ ``/ / _ \
   /_/  \_, / .__/\___/_/  \_,_/_/  /_/\_,_/\_, /_/_//_/
       /___/_/                             /___/
"@

Write-Host $banner -ForegroundColor Cyan
Write-Host ""

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $rootDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    $paths = [PSCustomObject]@{
        RootDir       = $rootDir
        AppDir        = Join-Path -Path $rootDir -ChildPath "app"
        AppSrcDir     = Join-Path -Path $rootDir -ChildPath "appsrc"
        WindowHtml    = Join-Path -Path $rootDir -ChildPath "window.html"
        WindowHtmlBak = Join-Path -Path $rootDir -ChildPath "window.html.bak"
    }

    Write-Host "[1/5] Validating paths" -ForegroundColor Yellow
    Write-Host "      -> Assuming Typora root is at '$($paths.RootDir)'."
    if (!(Test-Path $paths.WindowHtml)) {
        throw "Could not find 'window.html' at the expected location: '$($paths.WindowHtml)'."
    }

    Write-Host "[2/5] Checking Typora version" -ForegroundColor Yellow
    $frameScript = ""
    if (Test-Path -Path $paths.AppSrcDir) {
        $frameScript = '<script src="./appsrc/window/frame.js" defer="defer"></script>'
        Write-Host "      -> 'appsrc' folder found. Using new version."
    } elseif (Test-Path -Path $paths.AppDir) {
        $frameScript = '<script src="./app/window/frame.js" defer="defer"></script>'
        Write-Host "      -> 'app' folder found. Using old version."
    } else {
        throw "Neither 'app' nor 'appsrc' directory could be found in '$($paths.RootDir)'."
    }

    Write-Host "[3/5] Reading and validating 'window.html'" -ForegroundColor Yellow
    $pluginScript = '<script src="./plugin/index.js" defer="defer"></script>'
    $fileContent = Get-Content -Path $paths.WindowHtml -Encoding UTF8 -Raw
    if (!($fileContent -match [Regex]::Escape($frameScript))) {
        throw "'window.html' seems to be modified or corrupted. The expected frame script was not found."
    }
    if (!($fileContent -match [Regex]::Escape($pluginScript))) {
        Write-Host "      -> No plugin script detected."
        Write-Host "`nPlugin has already been uninstalled. Nothing to do." -ForegroundColor Green
        return
    }
    Write-Host "      -> Plugin found. Proceeding with uninstallation."

    Write-Host "[4/5] Removing plugin script from 'window.html'" -ForegroundColor Yellow
    $newFileContent = $fileContent -replace [Regex]::Escape($pluginScript), ''
    $newFileContent = $newFileContent -replace '(?m)^\s*$', ''
    Set-Content -Path $paths.WindowHtml -Value $newFileContent -Encoding UTF8 -NoNewline
    Write-Host "      -> File updated successfully."

    Write-Host "[5/5] Removing backup file '$($paths.WindowHtmlBak)'" -ForegroundColor Yellow
    if (Test-Path $paths.WindowHtmlBak) {
        Remove-Item -Path $paths.WindowHtmlBak -Force
        Write-Host "      -> Backup file removed."
    } else {
        Write-Host "      -> No backup file found to remove."
    }

    Write-Host "`nPlugin uninstalled successfully! Please restart Typora." -ForegroundColor Green
} catch {
    Write-Host "`n[ERROR] An error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nUninstallation failed. Please check the error message above." -ForegroundColor Red
} finally {
    Write-Host "`nPress any key to exit..."
    $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
}
