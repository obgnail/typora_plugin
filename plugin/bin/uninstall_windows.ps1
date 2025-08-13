Set-StrictMode -Version Latest
$Host.UI.RawUI.WindowTitle = "Typora Plugin Uninstaller"

$pluginScript = '<script src="./plugin/index.js" defer="defer"></script>'
$oldFrameScript = '<script src="./app/window/frame.js" defer="defer"></script>'
$newFrameScript = '<script src="./appsrc/window/frame.js" defer="defer"></script>'
$targetHtmlFile = "window.html"

$banner = @"
     ______                                      __            _
    /_  __/_  ______  ____  _________ _   ____  / /_  ______ _(_)___
     / / / / / / __ \/ __ \/ ___/ __ ``/  / __ \/ / / / / __ ``/ / __ \
    / / / /_/ / /_/ / /_/ / /  / /_/ /  / /_/ / / /_/ / /_/ / / / / /
   /_/  \__, / .___/\____/_/   \__,_/  / .___/_/\__,_/\__, /_/_/ /_/
       /____/_/                       /_/            /____/
"@

Write-Host $banner -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "[1/5] Defining script paths..." -ForegroundColor Yellow
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $rootDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    Write-Host "      -> Assuming Typora root is at: $rootDir"

    $windowHtmlPath = Join-Path -Path $rootDir -ChildPath $targetHtmlFile
    if (!(Test-Path $windowHtmlPath)) {
        throw "Could not find '$targetHtmlFile' at the expected location: '$windowHtmlPath'."
    }

    $windowHtmlBakPath = Join-Path -Path $rootDir -ChildPath "$targetHtmlFile.bak"
    $appPath = Join-Path -Path $rootDir -ChildPath "app"
    $appsrcPath = Join-Path -Path $rootDir -ChildPath "appsrc"

    Write-Host "[2/5] Checking Typora version..." -ForegroundColor Yellow
    $frameScript = ""
    if (Test-Path -Path $appsrcPath) {
        $frameScript = $newFrameScript
        Write-Host "      -> 'appsrc' folder found. Using new version."
    } elseif (Test-Path -Path $appPath) {
        $frameScript = $oldFrameScript
        Write-Host "      -> 'app' folder found. Using old version."
    } else {
        throw "Neither 'app' nor 'appsrc' directory could be found in '$rootDir'."
    }

    Write-Host "[3/5] Reading and validating '$targetHtmlFile'..." -ForegroundColor Yellow
    $fileContent = Get-Content -Path $windowHtmlPath -Encoding UTF8 -Raw

    if (!($fileContent -match [Regex]::Escape($frameScript))) {
        throw "'$targetHtmlFile' seems to be modified or corrupted. The expected frame script was not found."
    }

    if (!($fileContent -match [Regex]::Escape($pluginScript))) {
        Write-Host "Plugin has already been uninstalled. Nothing to do." -ForegroundColor Green
        return
    }
    Write-Host "      -> Plugin found. Proceeding with uninstallation."

    Write-Host "[4/5] Removing plugin script from '$targetHtmlFile'..." -ForegroundColor Yellow
    $newFileContent = $fileContent -replace [Regex]::Escape($pluginScript), ''
    $newFileContent = $newFileContent -replace '(?m)^\s*$', ''

    Set-Content -Path $windowHtmlPath -Value $newFileContent -Encoding UTF8 -NoNewline
    Write-Host "      -> File updated successfully."

    Write-Host "[5/5] Removing backup file '$($windowHtmlBakPath)'..." -ForegroundColor Yellow
    if (Test-Path $windowHtmlBakPath) {
        Remove-Item -Path $windowHtmlBakPath -Force
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
