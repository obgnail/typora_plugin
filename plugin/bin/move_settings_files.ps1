<#
.SYNOPSIS
    Robustly move settings.user.toml and custom_plugin.user.toml between
    ../global/settings/ (relative to script) and $env:USERPROFILE\.config\typora_plugin\
.PARAMETER f
    Overwrite existing files without prompting
.PARAMETER n
    Skip if target file exists, no prompt
.PARAMETER restore
    Move config files from typora_plugin back to global/settings
.PARAMETER NoPause
    Do not pause at script end
.EXAMPLE
    .\move_settings_files.ps1 -f
    .\move_settings_files.ps1 -n
    .\move_settings_files.ps1 -restore
    .\move_settings_files.ps1 -NoPause
#>

param(
    [switch]$f,
    [switch]$n,
    [switch]$restore,
    [switch]$NoPause
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Show-Usage {
    Write-Host "Usage: .\move_settings_files.ps1 [-f] [-n] [-restore] [-NoPause]"
    Write-Host "  -f         Overwrite existing files without prompting"
    Write-Host "  -n         Skip if target file exists, no prompt"
    Write-Host "  -restore   Move config files from typora_plugin back to global/settings"
    Write-Host "  -NoPause   Do not pause at script end"
    exit 1
}

if ($f -and $n) {
    Write-Host "Cannot use both -f and -n"
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$GlobalSettingsDir = Join-Path $ScriptDir "..\global\settings" | Resolve-Path -ErrorAction Stop | Select-Object -ExpandProperty Path
$TyporaPluginDir = Join-Path $env:USERPROFILE ".config\typora_plugin"
$Files = @("settings.user.toml", "custom_plugin.user.toml")

function Move-Or-CreateEmpty {
    param(
        [string]$From,
        [string]$To,
        [string]$FileDesc,
        [string]$Direction,
        [bool]$CreateEmptyIfMissing = $false
    )
    if (-not (Test-Path $From)) {
        if ($CreateEmptyIfMissing) {
            if (-not (Test-Path $To)) {
                try {
                    New-Item -Path $To -ItemType File -Force | Out-Null
                    # Set user permissions
                    $acl = Get-Acl $To
                    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
                    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($user, "Read,Write", "Allow")
                    $acl.SetAccessRule($accessRule)
                    Set-Acl $To $acl
                    Write-Host "Notice: $From not found, created empty file at $To"
                } catch {
                    Write-Host "Error: Failed to create empty file at $To"
                }
            } else {
                Write-Host "Notice: $From not found, $To already exists."
            }
        } else {
            Write-Host "Skipped: Source file $From does not exist."
        }
        return
    }

    if (Test-Path $To) {
        if ($f) {
            # Force overwrite, do nothing
        } elseif ($n) {
            Write-Host "Skipped: $To already exists (-n)"
            return
        } else {
            $ans = Read-Host "Target file $To exists. Overwrite? [y/N]"
            if ($ans -notmatch '^[Yy]$') {
                Write-Host "Skipped: $FileDesc"
                return
            }
        }
    }

    try {
        Move-Item -Force -Path $From -Destination $To -ErrorAction Stop
        # Set user permissions
        $acl = Get-Acl $To
        $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($user, "Read,Write", "Allow")
        $acl.SetAccessRule($accessRule)
        Set-Acl $To $acl
        Write-Host "Success: $Direction and set permissions for $FileDesc → $To"
    } catch {
        Write-Host "Error: Failed to $Direction $FileDesc. Details: $($_.Exception.Message)"
    }
}

function Move-To-ConfigDir {
    if (-not (Test-Path $TyporaPluginDir)) {
        try {
            New-Item -Path $TyporaPluginDir -ItemType Directory -Force | Out-Null
            Write-Host "Created destination directory: $TyporaPluginDir"
        } catch {
            Write-Host "Error: Failed to create directory $TyporaPluginDir. Check your permissions."
            if (-not $NoPause) { Write-Host ""; pause }
            exit 1
        }
    }
    foreach ($File in $Files) {
        $Src = Join-Path $GlobalSettingsDir $File
        $Dest = Join-Path $TyporaPluginDir $File
        Move-Or-CreateEmpty -From $Src -To $Dest -FileDesc $File -Direction "Moved" -CreateEmptyIfMissing:$false
    }
}

function Restore-To-GlobalSettings {
    if (-not (Test-Path $GlobalSettingsDir)) {
        try {
            New-Item -Path $GlobalSettingsDir -ItemType Directory -Force | Out-Null
            Write-Host "Created directory: $GlobalSettingsDir"
        } catch {
            Write-Host "Error: Failed to create directory $GlobalSettingsDir. Check your permissions."
            if (-not $NoPause) { Write-Host ""; pause }
            exit 1
        }
    }
    foreach ($File in $Files) {
        $From = Join-Path $TyporaPluginDir $File
        $To = Join-Path $GlobalSettingsDir $File
        Move-Or-CreateEmpty -From $From -To $To -FileDesc $File -Direction "Restored" -CreateEmptyIfMissing:$true
    }
}

if (-not $restore) {
    Move-To-ConfigDir
} else {
    Restore-To-GlobalSettings
}

if (-not $NoPause) {
    Write-Host ""
    pause
}
