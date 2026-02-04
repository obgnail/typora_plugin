Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Typora Plugin Permissions Ensurer"

$banner = @"
    ______                        ___  __          _
   /_  __/_ _____  ___  _______ _/ _ \/ /_ _____ _(_)__
    / / / // / _ \/ _ \/ __/ _ ``/ ___/ / // / _ ``/ / _ \
   /_/  \_, / .__/\___/_/  \_,_/_/  /_/\_,_/\_, /_/_//_/
       /___/_/                             /___/
"@

Write-Host $banner -ForegroundColor Cyan
Write-Host ""

function Pause-And-Exit {
    param(
        [int]$ExitCode = 0,
        [string]$Message
    )
    if (-not ([string]::IsNullOrWhiteSpace($Message))) {
        $color = if ($ExitCode -eq 0) { "Green" } else { "Red" }
        Write-Host "`n$Message" -ForegroundColor $color
    }
    Write-Host "`nPress any key to exit..."
    if ($Host.Name -eq 'ConsoleHost') {
        $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
    } else {
        Read-Host "Script finished. Press Enter to exit"
    }
    exit $ExitCode
}

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
        Pause-And-Exit -ExitCode 1 -Message "Elevation failed or was cancelled by the user. Cannot set permissions."
    }
    exit
}

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $rootDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    $paths = [PSCustomObject]@{
        RootDir         = $rootDir
        PluginDir       = Join-Path -Path $rootDir -ChildPath "plugin"
        SettingsDir     = Join-Path -Path $rootDir -ChildPath "plugin\global\settings"
        BasePluginCfg   = Join-Path -Path $rootDir -ChildPath "plugin\global\settings\settings.user.toml"
        CustomPluginCfg = Join-Path -Path $rootDir -ChildPath "plugin\global\settings\custom_plugin.user.toml"
    }

    Write-Host "[1/3] Validating paths" -ForegroundColor Yellow
    $dirsToValidate = @(
        $paths.RootDir
        $paths.PluginDir
        $paths.SettingsDir
    )
    foreach ($dir in $dirsToValidate) {
        if (!(Test-Path -Path $dir -PathType Container)) {
            throw "Could not determine '$dir' directory."
        }
    }

    Write-Host "[2/3] Processing directory permissions" -ForegroundColor Yellow
    $usersSid = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinUsersSid, $null)
    $directoryAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
    )

    Write-Host "      -> Setting 'FullControl' for 'plugin' directory."
    $pluginAcl = Get-Acl -Path $paths.PluginDir
    $pluginAcl.SetAccessRule($directoryAccessRule)
    Set-Acl -Path $paths.PluginDir -AclObject $pluginAcl

    Write-Host "      -> Setting 'FullControl' for 'settings' directory."
    $settingsAcl = Get-Acl -Path $paths.SettingsDir
    $settingsAcl.SetAccessRule($directoryAccessRule)
    Set-Acl -Path $paths.SettingsDir -AclObject $settingsAcl

    Write-Host "      -> Directory permissions set successfully."
    Write-Host "[3/3] Processing specific settings files" -ForegroundColor Yellow
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
            Write-Host "     -> Processing permissions for '$fileName'."
            $acl = Get-Acl -Path $file
            Write-Host "          -> Resetting permissions and applying 'FullControl'."
            $acl.ResetAccessRule($fileAccessRule)
            Set-Acl -Path $file -AclObject $acl
            Write-Host "          -> Permissions set successfully for '$fileName'."
        } else {
            Write-Warning "     -> $fileName file not found. Skipping permission set for it."
        }
    }

    Pause-And-Exit -ExitCode 0 -Message "Permissions-Ensurer finished successfully! Please restart Typora."
} catch {
    $errorMessage = "[ERROR] An error occurred: $($_.Exception.Message)"
    $errorLocation = "Error on line: $($_.InvocationInfo.ScriptLineNumber) in script: $($_.InvocationInfo.ScriptName)"
    Pause-And-Exit -ExitCode 1 -Message "$errorMessage`n$errorLocation"
}
