<#
.SYNOPSIS
    Robustly move settings.user.toml between
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
    Write-Host "[ERROR] Cannot use both -f and -n" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$GlobalSettingsDir = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($ScriptDir, "..\global\settings"))
$TyporaPluginDir = Join-Path $env:USERPROFILE ".config\typora_plugin"
$Files = @("settings.user.toml")

function Set-TargetAcl {
    param([string]$FilePath)
    try {
        $acl = Get-Acl $FilePath
        $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($user, "Read,Write", "Allow")
        $acl.SetAccessRule($accessRule)
        Set-Acl $FilePath $acl
        Write-Host ("  -> [ACL] Permissions granted for {0}" -f $user) -ForegroundColor DarkGray
    } catch {
        Write-Host ("  -> [WARN] Failed to set ACL for {0}. Details: {1}" -f $FilePath, $_.Exception.Message) -ForegroundColor Yellow
    }
}

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
                    Set-TargetAcl -FilePath $To
                    Write-Host ("[NOTICE] '{0}' not found. Created empty template at '{1}'." -f $From, $To) -ForegroundColor Cyan
                } catch {
                    Write-Host ("[ERROR] Failed to create empty file at '{0}'." -f $To) -ForegroundColor Red
                }
            } else {
                Write-Host ("[NOTICE] '{0}' not found, but target '{1}' already exists. Skipped." -f $From, $To) -ForegroundColor DarkGray
            }
        } else {
            Write-Host ("[SKIP] Source file '{0}' does not exist." -f $From) -ForegroundColor DarkGray
        }
        return
    }

    if (Test-Path $To) {
        if ($f) {
            Write-Host ("[INFO] Force flag (-f) detected. Overwriting '{0}'." -f $To) -ForegroundColor Cyan
        } elseif ($n) {
            Write-Host ("[SKIP] Target '{0}' already exists (-n)." -f $To) -ForegroundColor DarkGray
            return
        } else {
            Write-Host ("[PROMPT] Target file '{0}' exists." -f $To) -ForegroundColor Magenta
            $ans = Read-Host "Overwrite? [y/N]"
            if ($ans -notmatch '^[Yy]$') {
                Write-Host ("[SKIP] User cancelled overwrite for '{0}'." -f $FileDesc) -ForegroundColor DarkGray
                return
            }
        }
    }

    try {
        Move-Item -Force -Path $From -Destination $To -ErrorAction Stop
        Write-Host ("[SUCCESS] {0}: '{1}'" -f $Direction, $FileDesc) -ForegroundColor Green
        Write-Host ("  -> Path: {0}" -f $To) -ForegroundColor DarkGray
        Set-TargetAcl -FilePath $To
    } catch {
        Write-Host ("[ERROR] Failed to {0} '{1}'. Details: {2}" -f $Direction, $FileDesc, $_.Exception.Message) -ForegroundColor Red
    }
}

function Move-To-ConfigDir {
    Write-Host "[START] Moving settings to Plugin config directory..." -ForegroundColor Cyan
    if (-not (Test-Path $TyporaPluginDir)) {
        try {
            New-Item -Path $TyporaPluginDir -ItemType Directory -Force | Out-Null
            Write-Host ("[SUCCESS] Created destination directory: {0}" -f $TyporaPluginDir) -ForegroundColor Green
        } catch {
            Write-Host ("[ERROR] Failed to create directory {0}. Check permissions." -f $TyporaPluginDir) -ForegroundColor Red
            if (-not $NoPause) { Write-Host ""; pause }
            exit 1
        }
    }
    foreach ($File in $Files) {
        $Src = Join-Path $GlobalSettingsDir $File
        $Dest = Join-Path $TyporaPluginDir $File
        Move-Or-CreateEmpty -From $Src -To $Dest -FileDesc $File -Direction "Moved" -CreateEmptyIfMissing $false
    }
}

function Restore-To-GlobalSettings {
    Write-Host "[START] Restoring settings back to Global settings directory..." -ForegroundColor Cyan
    if (-not (Test-Path $GlobalSettingsDir)) {
        try {
            New-Item -Path $GlobalSettingsDir -ItemType Directory -Force | Out-Null
            Write-Host ("[SUCCESS] Created directory: {0}" -f $GlobalSettingsDir) -ForegroundColor Green
        } catch {
            Write-Host ("[ERROR] Failed to create directory {0}. Check permissions." -f $GlobalSettingsDir) -ForegroundColor Red
            if (-not $NoPause) { Write-Host ""; pause }
            exit 1
        }
    }
    foreach ($File in $Files) {
        $From = Join-Path $TyporaPluginDir $File
        $To = Join-Path $GlobalSettingsDir $File
        Move-Or-CreateEmpty -From $From -To $To -FileDesc $File -Direction "Restored" -CreateEmptyIfMissing $true
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
