$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = $scriptDir | Split-Path -Parent | Split-Path -Parent
$appPath = Join-Path -Path $rootDir -ChildPath "app"
$appsrcPath = Join-Path -Path $rootDir -ChildPath "appsrc"
$windowHTMLPath = Join-Path -Path $rootDir -ChildPath "window.html"
$windowHTMLBakPath = Join-Path -Path $rootDir -ChildPath "window.html.bak"
$pluginScript = "<script src=`"./plugin/index.js`" defer=`"defer`"></script>"
$oldFrameScript = "<script src=`"./app/window/frame.js`" defer=`"defer`"></script>"
$newFrameScript = "<script src=`"./appsrc/window/frame.js`" defer=`"defer`"></script>"
$frameScript = ""
$banner = @"
____________________________________________________________________
   ______                                      __            _
  /_  __/_  ______  ____  _________ _   ____  / /_  ______ _(_)___
   / / / / / / __ \/ __ \/ ___/ __ ``/  / __ \/ / / / / __ ``/ / __ \
  / / / /_/ / /_/ / /_/ / /  / /_/ /  / /_/ / / /_/ / /_/ / / / / /
 /_/  \__, / .___/\____/_/   \__,_/  / .___/_/\__,_/\__, /_/_/ /_/
     /____/_/                       /_/            /____/
                        Designed by obgnail
              https://github.com/obgnail/typora_plugin
____________________________________________________________________
"@

function finish {[CmdletBinding()]param ($msg) Write-Host $msg; PAUSE; Exit}
function panic {[CmdletBinding()]param ($msg) Write-Error $msg; PAUSE; Exit}

Write-Host $banner
Write-Host ""
Write-Host "[1/5] Check if file window.html exists in $rootDir"
if (!(Test-Path -Path $windowHTMLPath)) {
    panic "window.html does not exist in $rootDir"
}

Write-Host "[2/5] Check if folder app/appsrc exists in $rootDir"
if (Test-Path -Path $appsrcPath) {
    $frameScript = $newFrameScript
} elseif (Test-Path -Path $appPath) {
    $frameScript = $oldFrameScript
} else {
    panic "appsrc/app does not exist in $rootDir"
}

$fileContent = Get-Content -Path $windowHTMLPath -Encoding UTF8 -Raw
$replacement = ""

Write-Host "[3/5] Check window.html content"
if (!$fileContent.Contains($frameScript)) {
    panic "window.html does not contain $frameScript"
}
if (!$fileContent.Contains($pluginScript)) {
    finish "Plugin has already been uninstalled"
}

Write-Host "[4/5] Delete window.html.bak"
Remove-Item -Path $windowHTMLBakPath

Write-Host "[5/5] Update window.html"
$newFileContent = $fileContent -Replace [Regex]::Escape($pluginScript), $replacement
Set-Content -Path $windowHTMLPath -Value $newFileContent -Encoding UTF8
finish "Plugin uninstalled successfully"
