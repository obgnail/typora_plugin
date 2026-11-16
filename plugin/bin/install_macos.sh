#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PLUGIN_SRC=$(cd "$SCRIPT_DIR/.." && pwd)
APP="${TYPORA_APP:-$HOME/Desktop/Typora-Test.app}"
DRY_RUN=0
YES=0
ALLOW_PRODUCTION=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    --allow-production) ALLOW_PRODUCTION=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

INDEX="$APP/Contents/Resources/TypeMark/index.html"
TYPEMARK="$APP/Contents/Resources/TypeMark"
DST="$TYPEMARK/plugin"
STATE="$HOME/Library/Application Support/typora_plugin"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$STATE/backups/$STAMP"
TOKEN_FILE="$STATE/bridge-token"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist"

[ "$(uname -s)" = Darwin ] || { echo "error: macOS required" >&2; exit 69; }
[ -f "$INDEX" ] || { echo "error: invalid Typora bundle: $APP" >&2; exit 66; }
if [ "$APP" = "/Applications/Typora.app" ] && [ "$ALLOW_PRODUCTION" -ne 1 ]; then
  echo "error: refusing production Typora; pass --allow-production explicitly" >&2; exit 77
fi
if /usr/bin/xattr -lr "$APP" 2>/dev/null | grep 'com.apple.fileprovider' >/dev/null; then
  echo "error: bundle is managed by File Provider; copy it to a non-synchronised local directory first" >&2; exit 78
fi
if /usr/bin/xattr -lr "$APP" 2>/dev/null | grep 'com.apple.quarantine' >/dev/null; then
  echo "error: quarantine is present; refusing to remove it automatically" >&2; exit 77
fi
if pgrep -x Typora >/dev/null; then echo "error: quit all Typora processes before installation" >&2; exit 75; fi
grep -qF './appsrc/main.js' "$INDEX" || { echo "error: unexpected index.html" >&2; exit 65; }
if /usr/bin/xattr "$APP" 2>/dev/null | grep -q 'com.apple.fileprovider'; then
  echo "error: File Provider manages this app location; use a non-synchronised development path" >&2; exit 78
fi

echo "Target: $APP"
echo "Version: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
echo "Architectures: $(lipo -archs "$APP/Contents/MacOS/Typora")"
echo "Mode: $([ "$APP" = "/Applications/Typora.app" ] && echo production || echo development)"
if [ "$DRY_RUN" -eq 1 ]; then echo "Dry run: no files will change"; fi
if [ "$YES" -ne 1 ] && [ "$DRY_RUN" -ne 1 ]; then
  printf "Modify and development-sign this bundle? [y/N] "
  read -r answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "cancelled"; exit 0 ;; esac
fi

run() { if [ "$DRY_RUN" -eq 1 ]; then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
rollback() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$DRY_RUN" -ne 1 ] && [ -f "$BACKUP/index.html" ]; then
    cp "$BACKUP/index.html" "$INDEX"
    launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
    rm -f "$LAUNCH_AGENT"
    if [ -d "$BACKUP/plugin" ]; then rm -rf "$DST"; ditto --noextattr --norsrc "$BACKUP/plugin" "$DST"; else rm -rf "$DST"; fi
    echo "installation failed; index.html and plugin tree rolled back" >&2
  fi
  exit "$status"
}
trap rollback EXIT

run mkdir -p "$BACKUP" "$STATE" "$HOME/.config/typora_plugin" "$(dirname "$LAUNCH_AGENT")"
run cp "$INDEX" "$BACKUP/index.html"
if [ -d "$DST" ]; then run ditto --noextattr --norsrc "$DST" "$BACKUP/plugin"; fi
if [ ! -f "$HOME/.config/typora_plugin/settings.user.toml" ]; then
  run cp "$PLUGIN_SRC/global/settings/settings.user.toml" "$HOME/.config/typora_plugin/settings.user.toml"
fi
run mkdir -p "$DST/macos"
run ditto --noextattr --norsrc "$PLUGIN_SRC" "$DST"

if [ "$DRY_RUN" -ne 1 ]; then
  token=$(openssl rand -hex 32)
  umask 077
  printf '%s\n' "$token" > "$TOKEN_FILE"
  if [ ! -f "$HOME/.config/typora_plugin/settings.user.toml" ]; then
    cp "$PLUGIN_SRC/global/settings/settings.user.toml" "$HOME/.config/typora_plugin/settings.user.toml"
  fi
  node "$PLUGIN_SRC/macos/bin/configure_loader.js" "$PLUGIN_SRC/macos/loader.js" "$TOKEN_FILE" "$DST/macos/loader.js"
  node "$DST/macos/bin/edit_index.js" inject "$INDEX"
  node_path=$(command -v node)
  cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>io.typora.plugin.macos-bridge</string>
<key>ProgramArguments</key><array><string>$node_path</string><string>$DST/macos/bridge.js</string><string>--token-file</string><string>$TOKEN_FILE</string><string>--root</string><string>$DST</string><string>--root</string><string>$HOME/.config/typora_plugin</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><false/>
<key>StandardOutPath</key><string>$STATE/bridge.log</string><key>StandardErrorPath</key><string>$STATE/bridge.log</string></dict></plist>
PLIST
  "$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP"
  printf '%s\n' "$BACKUP" > "$STATE/last-install-backup"
  launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT"
fi
trap - EXIT
echo "Installed. Backup: $BACKUP"
echo "Bridge launch agent: $LAUNCH_AGENT"
