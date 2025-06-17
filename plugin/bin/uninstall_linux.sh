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
    echo -e "\033[0;31m ERROR: $1 \033[0m" >&2
    exit 1
}

escape_sed_regex() {
    sed -E 's/[][\/\.$*^|]/\\&/g' <<<"$1"
}

echo "Starting plugin uninstallation script"

echo "[1/8] Checking for necessary commands"
for cmd in cp rm sed grep; do
    command -v "$cmd" &>/dev/null || panic "Command '$cmd' not found. Please install it."
done

echo "[2/8] Checking for root privileges"
if [[ "$EUID" -ne 0 ]]; then
    panic "This script must be run as root. Please use 'sudo'."
fi

echo "[3/8] Verifying plugin directory existence"
if [[ ! -d "$PLUGIN_DIR" ]]; then
    panic "Plugin folder not found: '$PLUGIN_DIR'."
fi

echo "[4/8] Verifying window.html existence"
if [[ ! -f "$WINDOW_HTML_PATH" ]]; then
    panic "window.html not found: '$WINDOW_HTML_PATH'."
fi

echo "[5/8] Determining frame script path"
if [[ -d "$APPSRC_PATH" ]]; then
    FRAME_SCRIPT="$NEW_FRAME_SCRIPT"
elif [[ -d "$APP_PATH" ]]; then
    FRAME_SCRIPT="$OLD_FRAME_SCRIPT"
else
    panic "Neither '$APPSRC_PATH' nor '$APP_PATH' found in '$ROOT_DIR'."
fi

echo "[6/8] Checking window.html content for existing plugin script"
if ! grep -qF "$FRAME_SCRIPT" "$WINDOW_HTML_PATH"; then
    panic "'$WINDOW_HTML_PATH' does not contain the expected frame script: '$FRAME_SCRIPT'."
fi

if ! grep -qF "$PLUGIN_SCRIPT" "$WINDOW_HTML_PATH"; then
    echo "Plugin has already been uninstalled."
    exit 0
fi

echo "[7/8] Delete window.html.bak"
rm -f "$WINDOW_HTML_BAK_PATH" || echo "WARNING: Could not remove '$WINDOW_HTML_BAK_PATH'. File might not exist or permission issue."

echo "[8/8] Updating window.html to delete plugin script"
ESCAPED_PLUGIN_SCRIPT=$(escape_sed_regex "$PLUGIN_SCRIPT")
sed -i "s|$ESCAPED_PLUGIN_SCRIPT||g" "$WINDOW_HTML_PATH" || panic "Failed to update window.html."

echo "Plugin uninstalled successfully"
