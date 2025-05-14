#!/bin/bash

rootDir=$(dirname "$(dirname "$PWD")")
pluginDir="$rootDir/plugin"
appPath="$rootDir/app"
appsrcPath="$rootDir/appsrc"
windowHTMLPath="$rootDir/window.html"
windowHTMLBakPath="$rootDir/window.html.bak"
pluginScript='<script src="./plugin/index.js" defer="defer"></script>'
newFrameScript='<script src="./appsrc/window/frame.js" defer="defer"></script>'
oldFrameScript='<script src="./app/window/frame.js" defer="defer"></script>'
frameScript=""

panic() {
    echo -e "\033[0;31m ERROR: $1 \033[0m"
    exit 1
}

escape() {
    sed -E 's/[]\/$*.^|[]/\\&/g' <<<"$1"
}

echo "[1/9] Check commands"
for cmd in cp cat chmod sed; do
    command -v "$cmd" &>/dev/null || panic "Cannot find command $cmd, Please install it"
done

echo "[2/9] Check sudo"
if [ "$EUID" -ne 0 ]; then
    panic "Please run this script as root"
fi

echo "[3/9] Check if plugin exists"
if ! [ -d "$pluginDir" ]; then
    panic "Folder plugin does not exist in $rootDir"
fi

echo "[4/9] Check if window.html exists"
if ! [ -f "$windowHTMLPath" ]; then
    panic "window.html does not exist in $rootDir"
fi

echo "[5/8] Check if app/appsrc exists"
if [ -d "$appsrcPath" ]; then
    frameScript=$newFrameScript
elif [ -d "$appPath" ]; then
    frameScript=$oldFrameScript
else
    panic "appsrc/app does not exist in $rootDir"
fi

echo "[6/9] Check window.html content"
content=$(cat "$windowHTMLPath")
if ! [[ $content == *"$frameScript"* ]]; then
    panic "window.html does not contains $frameScript"
fi
if [[ $content == *"$pluginScript"* ]]; then
    echo "Plugin has already been installed"
    exit
fi

echo "[7/9] Backup window.html"
cp "$windowHTMLPath" "$windowHTMLBakPath"

echo "[8/9] Chmod plugin files"
chmod 0777 "$pluginDir"
chmod 0777 "$pluginDir/global/settings/settings.user.toml"
chmod 0777 "$pluginDir/global/settings/custom_plugin.user.toml"

echo "[9/9] Update window.html"
escapedFrameScript=$(escape "$frameScript")
escapedPluginScript=$(escape "$pluginScript")
replacement="$escapedFrameScript$escapedPluginScript"
newContent=$(echo -n "$content" | sed "s|$escapedFrameScript|$replacement|")
echo "$newContent" > "$windowHTMLPath"
echo "Plugin installed successfully"
