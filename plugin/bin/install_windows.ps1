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
        RootDir         = $rootDir
        AppDir          = Join-Path -Path $rootDir -ChildPath "app"
        AppSrcDir       = Join-Path -Path $rootDir -ChildPath "appsrc"
        PluginDir       = Join-Path -Path $rootDir -ChildPath "plugin"
        SettingsDir     = Join-Path -Path $rootDir -ChildPath "plugin\global\settings"
        BasePluginCfg   = Join-Path -Path $rootDir -ChildPath "plugin\global\settings\settings.user.toml"
        CustomPluginCfg = Join-Path -Path $rootDir -ChildPath "plugin\global\settings\custom_plugin.user.toml"
        WindowHtml      = Join-Path -Path $rootDir -ChildPath "window.html"
        WindowHtmlBak   = Join-Path -Path $rootDir -ChildPath "window.html.bak"
    }

    Write-Host "[1/6] Validating paths" -ForegroundColor Yellow
    Write-Host "      -> Assuming Typora root is at '$($paths.RootDir)'."
    if (!(Test-Path $paths.WindowHtml)) {
        throw "Could not find 'window.html' at the expected location: '$($paths.WindowHtml)'."
    }

    Write-Host "[2/6] Checking Typora version" -ForegroundColor Yellow
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

    Write-Host "[3/6] Reading and validating 'window.html'" -ForegroundColor Yellow
    $pluginScript = '<script src="./plugin/index.js" defer="defer"></script>'
    $fileContent = Get-Content -Path $paths.WindowHtml -Encoding UTF8 -Raw
    if ($fileContent -match [Regex]::Escape($pluginScript)) {
        Write-Host "      -> Plugin script Detected."
        Write-Host "`nPlugin has already been installed. Nothing to do." -ForegroundColor Green
        return
    }
    if (!($fileContent -match [Regex]::Escape($frameScript))) {
        throw "'window.html' does not contain the expected script tag: $frameScript"
    }
    Write-Host "      -> Validation successful."

    Write-Host "[4/6] Ensuring permissions" -ForegroundColor Yellow
    if (!(Test-Path -Path $paths.PluginDir -PathType Container)) {
        throw "Could not find the plugin directory at '$($paths.PluginDir)'."
    }
    if (!(Test-Path -Path $paths.SettingsDir -PathType Container)) {
        throw "Could not find the settings directory at '$($paths.SettingsDir)'."
    }
    $usersSid = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinUsersSid, $null)
    Write-Host "      -> Processing permissions for 'plugin' directory."
    $dirAcl = Get-Acl -Path $paths.PluginDir
    $directoryAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    $dirAcl.SetAccessRule($directoryAccessRule)
    Set-Acl -Path $paths.PluginDir -AclObject $dirAcl

    Write-Host "      -> Processing permissions for settings files."
    $filesToProcess = @(
        $paths.BasePluginCfg
        $paths.CustomPluginCfg
    )
    $fileAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    foreach ($file in $filesToProcess) {
        $fileName = Split-Path $file -Leaf
        if (Test-Path -Path $file -PathType Leaf) {
            Write-Host "         -> Processing '$fileName'."
            $acl = Get-Acl -Path $file
            $acl.ResetAccessRule($fileAccessRule)
            Set-Acl -Path $file -AclObject $acl
        } else {
            Write-Warning "         -> $fileName not found. Skipping."
        }
    }

    Write-Host "[5/6] Backing up 'window.html' to '$($paths.WindowHtmlBak)'" -ForegroundColor Yellow
    Copy-Item -Path $paths.WindowHtml -Destination $paths.WindowHtmlBak -Force
    Write-Host "      -> Backup complete."

    Write-Host "[6/6] Injecting plugin script" -ForegroundColor Yellow
    $replacement = $frameScript + $pluginScript
    $newFileContent = $fileContent -replace [Regex]::Escape($frameScript), $replacement
    Set-Content -Path $paths.WindowHtml -Value $newFileContent -Encoding UTF8 -NoNewline
    Write-Host "      -> Injection complete."

    Write-Host "`nPlugin installed successfully! Please restart Typora." -ForegroundColor Green
} catch {
    Write-Host "`n[ERROR] An error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nInstallation failed." -ForegroundColor Red
} finally {
    Write-Host "`nPress any key to exit..."
    $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
}
