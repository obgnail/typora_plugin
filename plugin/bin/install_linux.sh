#!/bin/bash

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly PLUGIN_DIR="$ROOT_DIR/plugin"
readonly APP_PATH="$ROOT_DIR/app"
readonly APPSRC_PATH="$ROOT_DIR/appsrc"
readonly WINDOW_HTML_PATH="$ROOT_DIR/window.html"
readonly WINDOW_HTML_BAK_PATH="$ROOT_DIR/window.html.bak"
readonly PLUGIN_SCRIPT='<script src="./plugin/index.js" defer="defer"></script>'
readonly NEW_FRAME_SCRIPT='<script src="./appsrc/window/frame.js" defer="defer"></script>'
readonly OLD_FRAME_SCRIPT='<script src="./app/window/frame.js" defer="defer"></script>'

FRAME_SCRIPT=""

panic() {
    echo -e "\033[0;31mERROR: $1\033[0m" >&2
    exit 1
}

escape_sed_regex() {
    sed -E 's/[][\/\.$*^|]/\\&/g' <<<"$1"
}

echo -e "\033[36m
   ______                        ___  __          _
  /_  __/_ _____  ___  _______ _/ _ \/ /_ _____ _(_)__
   / / / // / _ \/ _ \/ __/ _ \`/ ___/ / // / _ \`/ / _ \\
  /_/  \_, / .__/\___/_/  \_,_/_/  /_/\_,_/\_, /_/_//_/
      /___/_/                             /___/
\033[0m"

echo "[1/9] Checking for necessary commands"
for cmd in cp chmod sed grep; do
    command -v "$cmd" &>/dev/null || panic "Command '$cmd' not found. Please install it."
done

echo "[2/9] Checking for root privileges"
if [[ "$EUID" -ne 0 ]]; then
    panic "This script must be run as root. Please use 'sudo'."
fi

echo "[3/9] Verifying plugin directory existence"
if [[ ! -d "$PLUGIN_DIR" ]]; then
    panic "Plugin folder not found: '$PLUGIN_DIR'."
fi

echo "[4/9] Verifying window.html existence"
if [[ ! -f "$WINDOW_HTML_PATH" ]]; then
    panic "window.html not found: '$WINDOW_HTML_PATH'."
fi

echo "[5/9] Determining frame script path"
if [[ -d "$APPSRC_PATH" ]]; then
    FRAME_SCRIPT="$NEW_FRAME_SCRIPT"
elif [[ -d "$APP_PATH" ]]; then
    FRAME_SCRIPT="$OLD_FRAME_SCRIPT"
else
    panic "Neither '$APPSRC_PATH' nor '$APP_PATH' found in '$ROOT_DIR'."
fi

echo "[6/9] Checking window.html content for existing plugin script"
if ! grep -qF "$FRAME_SCRIPT" "$WINDOW_HTML_PATH"; then
    panic "'$WINDOW_HTML_PATH' does not contain the expected frame script: '$FRAME_SCRIPT'."
fi

if grep -qF "$PLUGIN_SCRIPT" "$WINDOW_HTML_PATH"; then
    echo "Plugin has already been installed."
    exit 0
fi

echo "[7/9] Backing up window.html"
cp "$WINDOW_HTML_PATH" "$WINDOW_HTML_BAK_PATH" || panic "Failed to create backup of window.html."

echo "[8/9] Adjusting permissions for plugin files"
chmod 0777 "$PLUGIN_DIR" || panic "Failed to set permissions for '$PLUGIN_DIR'."
chmod 0777 "$PLUGIN_DIR/global/settings/settings.user.toml" || panic "Failed to set permissions for settings.user.toml."
chmod 0777 "$PLUGIN_DIR/global/settings/custom_plugin.user.toml" || panic "Failed to set permissions for custom_plugin.user.toml."

echo "[9/9] Updating window.html to inject plugin script"
ESCAPED_FRAME_SCRIPT=$(escape_sed_regex "$FRAME_SCRIPT")
ESCAPED_PLUGIN_SCRIPT=$(escape_sed_regex "$PLUGIN_SCRIPT")
sed -i "s|$ESCAPED_FRAME_SCRIPT|$ESCAPED_FRAME_SCRIPT$ESCAPED_PLUGIN_SCRIPT|" "$WINDOW_HTML_PATH" || panic "Failed to update window.html."

echo -e "\033[32m \nPlugin installed successfully! Please restart Typora. \033[0m"
