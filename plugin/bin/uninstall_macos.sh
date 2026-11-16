#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
APP="${TYPORA_APP:-$HOME/Desktop/Typora-Test.app}"
DRY_RUN=0
YES=0
while [ "$#" -gt 0 ]; do
  case "$1" in --app) APP="$2"; shift 2 ;; --dry-run) DRY_RUN=1; shift ;; --yes) YES=1; shift ;; *) echo "unknown option: $1" >&2; exit 64 ;; esac
done
INDEX="$APP/Contents/Resources/TypeMark/index.html"
DST="$APP/Contents/Resources/TypeMark/plugin"
STATE="$HOME/Library/Application Support/typora_plugin"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist"
[ -f "$INDEX" ] || { echo "error: invalid Typora bundle" >&2; exit 66; }
if [ "$YES" -ne 1 ] && [ "$DRY_RUN" -ne 1 ]; then printf "Uninstall macOS adapter from %s? [y/N] " "$APP"; read -r answer; case "$answer" in y|Y|yes|YES) ;; *) exit 0 ;; esac; fi
run() { if [ "$DRY_RUN" -eq 1 ]; then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
run launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
run rm -f "$LAUNCH_AGENT"
BACKUP=""
[ -f "$STATE/last-install-backup" ] && BACKUP=$(cat "$STATE/last-install-backup")
if [ -n "$BACKUP" ] && [ -f "$BACKUP/index.html" ]; then
  run cp "$BACKUP/index.html" "$INDEX"
  if [ -d "$BACKUP/plugin" ]; then run rm -rf "$DST"; run ditto --noextattr --norsrc "$BACKUP/plugin" "$DST"; else run rm -rf "$DST"; fi
else
  if [ "$DRY_RUN" -ne 1 ]; then node "$DST/macos/bin/edit_index.js" remove "$INDEX"; fi
  run rm -rf "$DST/macos"
fi
run rm -f "$STATE/last-install-backup"
if [ "$DRY_RUN" -ne 1 ]; then "$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP"; fi
echo "User configuration and backups preserved in: $STATE"
echo "The prior plugin tree was restored where a backup was available; the development bundle was re-signed."
