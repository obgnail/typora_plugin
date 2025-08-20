Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Typora Plugin Installer"

# --- Self elevation ---
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Administrator privileges are required. Attempting to elevate..."
    try {
        $scriptPath = $MyInvocation.MyCommand.Definition
        $processArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-NoProfile",
            "-File", "`"$scriptPath`""
        )
        $startProcessParams = @{
            FilePath     = "powershell.exe"
            ArgumentList = $processArgs
            Verb         = "RunAs"
        }
        Start-Process @startProcessParams
    } catch {
        Write-Host "`nElevation failed or was cancelled by the user. Cannot continue." -ForegroundColor Red
        Write-Host "`nPress any key to exit..."
        $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
        exit 1
    }
    exit
}

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
    Write-Host "[1/6] Defining script paths..." -ForegroundColor Yellow
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

    Write-Host "[2/6] Checking Typora version..." -ForegroundColor Yellow
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

    Write-Host "[3/6] Reading and validating '$targetHtmlFile'..." -ForegroundColor Yellow
    $fileContent = Get-Content -Path $windowHtmlPath -Encoding UTF8 -Raw

    if ($fileContent -match [Regex]::Escape($pluginScript)) {
        Write-Host "`nPlugin has already been installed. Nothing to do." -ForegroundColor Green
        return
    }

    if (!($fileContent -match [Regex]::Escape($frameScript))) {
        throw "'$targetHtmlFile' does not contain the expected script tag: $frameScript"
    }
    Write-Host "      -> Validation successful."

    Write-Host "[4/6] Ensuring permissions..." -ForegroundColor Yellow
    $pluginDir = Join-Path -Path $rootDir -ChildPath "plugin"
    $settingsDir = Join-Path -Path $pluginDir -ChildPath "global/settings"

    if (!(Test-Path -Path $pluginDir -PathType Container)) {
        throw "Could not find the plugin directory at '$pluginDir'."
    }
    if (!(Test-Path -Path $settingsDir -PathType Container)) {
        throw "Could not find the settings directory at '$settingsDir'."
    }

    $usersSid = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinUsersSid, $null)

    Write-Host "      -> Processing permissions for 'plugin' directory..."
    $dirAcl = Get-Acl -Path $pluginDir
    $directoryAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    $dirAcl.SetAccessRule($directoryAccessRule)
    Set-Acl -Path $pluginDir -AclObject $dirAcl

    Write-Host "      -> Processing permissions for settings files..."
    $filesToProcess = @(
        Join-Path -Path $settingsDir -ChildPath "settings.user.toml"
        Join-Path -Path $settingsDir -ChildPath "custom_plugin.user.toml"
    )
    $fileAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    foreach ($file in $filesToProcess) {
        $fileName = Split-Path $file -Leaf
        if (Test-Path -Path $file -PathType Leaf) {
            Write-Host "         -> Processing '$fileName'..."
            $acl = Get-Acl -Path $file
            $acl.ResetAccessRule($fileAccessRule)
            Set-Acl -Path $file -AclObject $acl
        } else {
            Write-Warning "         -> $fileName not found. Skipping."
        }
    }

    Write-Host "[5/6] Backing up '$targetHtmlFile' to '$windowHtmlBakPath'..." -ForegroundColor Yellow
    Copy-Item -Path $windowHtmlPath -Destination $windowHtmlBakPath -Force
    Write-Host "      -> Backup complete."

    Write-Host "[6/6] Injecting plugin script..." -ForegroundColor Yellow
    $replacement = $frameScript + "`n    " + $pluginScript
    $newFileContent = $fileContent -replace [Regex]::Escape($frameScript), $replacement

    Set-Content -Path $windowHtmlPath -Value $newFileContent -Encoding UTF8 -NoNewline

    Write-Host "`nPlugin installed successfully! Please restart Typora." -ForegroundColor Green
} catch {
    Write-Host "`n[ERROR] An error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nInstallation failed." -ForegroundColor Red
} finally {
    Write-Host "`nPress any key to exit..."
    $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
}
