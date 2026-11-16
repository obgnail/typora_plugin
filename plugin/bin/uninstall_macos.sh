#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
APP="${TYPORA_APP:-/private/tmp/Typora-Plugin-Beta.app}"
DRY_RUN=0
YES=0
ALLOW_PRODUCTION=0
SKIP_LAUNCH_AGENT=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    --allow-production) ALLOW_PRODUCTION=1; shift ;;
    --skip-launch-agent) SKIP_LAUNCH_AGENT=1; shift ;;
    *) echo "error: unknown option: $1" >&2; exit 64 ;;
  esac
done

canonical() { local dir base; dir=$(dirname "$1"); base=$(basename "$1"); (cd "$dir" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$base") || printf '%s\n' "$1"; }
APP=$(canonical "$APP")
[ "$(uname -s)" = Darwin ] || { echo "error: macOS required" >&2; exit 69; }
if [ "$APP" = "/Applications/Typora.app" ] && [ "$ALLOW_PRODUCTION" -ne 1 ]; then echo "error: refusing production Typora" >&2; exit 77; fi
if pgrep -x Typora >/dev/null; then echo "error: quit all Typora processes before uninstallation" >&2; exit 75; fi

INDEX="$APP/Contents/Resources/TypeMark/index.html"
DST="$APP/Contents/Resources/TypeMark/plugin"
STATE="$HOME/Library/Application Support/typora_plugin"
ORIGINAL="$STATE/original"
TOKEN_FILE="$STATE/bridge-token"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist"
INSTALLED_APP_FILE="$STATE/installed-app"
[ -f "$INDEX" ] || { echo "error: invalid Typora bundle: $APP" >&2; exit 66; }

if [ -f "$INSTALLED_APP_FILE" ]; then
  RECORDED_APP=$(cat "$INSTALLED_APP_FILE")
  [ "$RECORDED_APP" = "$APP" ] || { echo "error: installation state belongs to $RECORDED_APP" >&2; exit 73; }
elif ! grep -q 'typora-plugin-macos:start' "$INDEX"; then
  echo "Already uninstalled: $APP"
  exit 0
fi

echo "Target: $APP"
echo "Restore source: $ORIGINAL"
if [ "$DRY_RUN" -eq 1 ]; then echo "DRY RUN: no files, signatures, or LaunchAgents were changed"; exit 0; fi
[ -f "$ORIGINAL/index.html" ] || { echo "error: original bundle backup is missing; refusing destructive uninstall" >&2; exit 66; }
if [ "$YES" -ne 1 ]; then printf "Restore the original plugin state and re-sign this development copy? [y/N] "; read -r answer; case "$answer" in y|Y|yes|YES) ;; *) exit 0 ;; esac; fi

umask 077
ROLLBACK=$(mktemp -d "$STATE/backups/uninstall.XXXXXX")
cp "$INDEX" "$ROLLBACK/index.html"
if [ -d "$DST" ]; then ditto --noextattr --norsrc "$DST" "$ROLLBACK/plugin"; touch "$ROLLBACK/had-plugin"; fi
[ -f "$LAUNCH_AGENT" ] && cp "$LAUNCH_AGENT" "$ROLLBACK/launch-agent.plist"
rollback() {
  status=$?
  [ "$status" -eq 0 ] && return
  echo "error: uninstall failed; restoring installed state" >&2
  cp "$ROLLBACK/index.html" "$INDEX" || true
  rm -rf "$DST"
  [ -f "$ROLLBACK/had-plugin" ] && ditto --noextattr --norsrc "$ROLLBACK/plugin" "$DST"
  if [ -f "$ROLLBACK/launch-agent.plist" ]; then
    cp "$ROLLBACK/launch-agent.plist" "$LAUNCH_AGENT" || true
    [ "$SKIP_LAUNCH_AGENT" -eq 1 ] || launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
  fi
  "$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP" >/dev/null 2>&1 || true
  exit "$status"
}
trap rollback EXIT

[ "$SKIP_LAUNCH_AGENT" -eq 1 ] || launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
rm -f "$LAUNCH_AGENT"
cp "$ORIGINAL/index.html" "$INDEX"
rm -rf "$DST"
[ -f "$ORIGINAL/had-plugin" ] && ditto --noextattr --norsrc "$ORIGINAL/plugin" "$DST"
"$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP"
rm -f "$TOKEN_FILE" "$INSTALLED_APP_FILE" "$STATE/last-install-backup"
rm -rf "$ORIGINAL"
trap - EXIT
echo "Uninstalled macOS beta adapter from: $APP"
echo "External user configuration and transaction backups were preserved in: $STATE"
