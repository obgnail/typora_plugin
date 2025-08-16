Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Typora Plugin Permissions Ensurer"

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
    $appDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    $pluginDir = Join-Path -Path $appDir -ChildPath "plugin"
    $settingsDir = Join-Path -Path $pluginDir -ChildPath "global/settings"

    Write-Host "[1/3] Assuming Typora app directory is at: $appDir" -ForegroundColor Yellow
    if (!(Test-Path -Path $appDir -PathType Container)) {
        throw "Could not determine the app directory. Ensure this script is in the correct plugin folder structure."
    }
    if (!(Test-Path -Path $pluginDir -PathType Container)) {
        throw "Could not determine the plugin directory. Ensure this script is in the correct plugin folder structure."
    }
    if (!(Test-Path -Path $settingsDir -PathType Container)) {
        throw "Could not determine the settings directory. Ensure this script is in the correct plugin folder structure."
    }

    Write-Host "[2/3] Processing permissions for 'plugin' directory..." -ForegroundColor Yellow
    $usersSid = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinUsersSid, $null)
    $dirAcl = Get-Acl -Path $pluginDir
    $directoryAccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $usersSid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    Write-Host "      -> Setting 'FullControl' with inheritance for Users group..."
    $dirAcl.SetAccessRule($directoryAccessRule)
    Set-Acl -Path $pluginDir -AclObject $dirAcl
    Write-Host "      -> Permissions set successfully for 'plugin' directory."

    Write-Host "[3/3] Processing permissions for settings files..." -ForegroundColor Yellow
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
            Write-Host "     -> Processing permissions for '$fileName'..."
            $acl = Get-Acl -Path $file
            Write-Host "          -> Resetting permissions and applying 'FullControl' for Users group..."
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
