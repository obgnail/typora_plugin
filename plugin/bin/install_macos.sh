#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PLUGIN_SRC=$(cd "$SCRIPT_DIR/.." && pwd)
APP="${TYPORA_APP:-/private/tmp/Typora-Plugin-Beta.app}"
SOURCE_APP="/Applications/Typora.app"
SUPPORTED_VERSION="1.14.15"
DRY_RUN=0
YES=0
ALLOW_PRODUCTION=0
ALLOW_UNSUPPORTED=0
ALLOW_SINGLE_ARCH=0
SKIP_LAUNCH_AGENT=0

usage() { echo "usage: $0 [--app /private/tmp/Typora-Plugin-Beta.app] [--source /Applications/Typora.app] [--dry-run] [--yes]" >&2; }
while [ "$#" -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --source) SOURCE_APP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    --allow-production) ALLOW_PRODUCTION=1; shift ;;
    --allow-unsupported-version) ALLOW_UNSUPPORTED=1; shift ;;
    --allow-single-arch) ALLOW_SINGLE_ARCH=1; shift ;;
    --skip-launch-agent) SKIP_LAUNCH_AGENT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "error: unknown option: $1" >&2; usage; exit 64 ;;
  esac
done

canonical() { local dir base; dir=$(dirname "$1"); base=$(basename "$1"); (cd "$dir" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$base") || printf '%s\n' "$1"; }
APP=$(canonical "$APP")
SOURCE_APP=$(canonical "$SOURCE_APP")
[ "$(uname -s)" = Darwin ] || { echo "error: macOS required" >&2; exit 69; }
if [ "$APP" = "/Applications/Typora.app" ] && [ "$ALLOW_PRODUCTION" -ne 1 ]; then echo "error: refusing production Typora; create a separate copy instead" >&2; exit 77; fi
[ "$APP" != "$SOURCE_APP" ] || { echo "error: source and target application must differ" >&2; exit 77; }
if pgrep -x Typora >/dev/null; then echo "error: quit all Typora processes before installation" >&2; exit 75; fi

run() { if [ "$DRY_RUN" -eq 1 ]; then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
if [ ! -d "$APP" ]; then
  [ -f "$SOURCE_APP/Contents/Resources/TypeMark/index.html" ] || { echo "error: source Typora app not found: $SOURCE_APP" >&2; exit 66; }
  echo "[1/8] Creating isolated application copy: $APP"
  run mkdir -p "$(dirname "$APP")"
  run ditto --noextattr --norsrc "$SOURCE_APP" "$APP"
fi

INSPECT_APP="$APP"
if [ "$DRY_RUN" -eq 1 ] && [ ! -d "$APP" ]; then INSPECT_APP="$SOURCE_APP"; fi
INDEX="$APP/Contents/Resources/TypeMark/index.html"
TYPEMARK="$APP/Contents/Resources/TypeMark"
DST="$TYPEMARK/plugin"
INSPECT_INDEX="$INSPECT_APP/Contents/Resources/TypeMark/index.html"
[ -f "$INSPECT_INDEX" ] || { echo "error: invalid Typora bundle: $INSPECT_APP" >&2; exit 66; }
grep -qF './appsrc/main.js' "$INSPECT_INDEX" || { echo "error: unexpected index.html" >&2; exit 65; }

VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INSPECT_APP/Contents/Info.plist")
ARCHS=$(lipo -archs "$INSPECT_APP/Contents/MacOS/Typora")
if [ "$VERSION" != "$SUPPORTED_VERSION" ] && [ "$ALLOW_UNSUPPORTED" -ne 1 ]; then echo "error: Typora $VERSION is unverified; this beta supports exactly $SUPPORTED_VERSION" >&2; exit 65; fi
if { [[ " $ARCHS " != *" arm64 "* ]] || [[ " $ARCHS " != *" x86_64 "* ]]; } && [ "$ALLOW_SINGLE_ARCH" -ne 1 ]; then echo "error: expected a universal arm64+x86_64 Typora binary, found: $ARCHS" >&2; exit 65; fi
if /usr/bin/xattr -lr "$INSPECT_APP" 2>/dev/null | grep 'com.apple.fileprovider' >/dev/null; then echo "error: bundle is managed by File Provider; use a non-synchronised local directory" >&2; exit 78; fi
if /usr/bin/xattr -lr "$INSPECT_APP" 2>/dev/null | grep 'com.apple.quarantine' >/dev/null; then echo "error: quarantine is present; refusing to remove it automatically" >&2; exit 77; fi

echo "[2/8] Environment diagnostics"
echo "  Target: $APP"
echo "  Version: $VERSION (supported: $SUPPORTED_VERSION)"
echo "  Architectures: $ARCHS"
echo "  Node: $(command -v node) ($(node --version))"
echo "  Signing identity: ad-hoc development only"
if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] No files, signatures, configuration, or LaunchAgents were changed."; exit 0; fi
if [ "$YES" -ne 1 ]; then printf "Modify and development-sign this isolated bundle? [y/N] "; read -r answer; case "$answer" in y|Y|yes|YES) ;; *) echo "cancelled"; exit 0 ;; esac; fi

STATE="$HOME/Library/Application Support/typora_plugin"
CONFIG_ROOT="$HOME/.config/typora_plugin"
TOKEN_FILE="$STATE/bridge-token"
LOG_FILE="$STATE/bridge.log"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist"
ORIGINAL="$STATE/original"
ORIGINAL_CREATED=0
TRANSACTION="$STATE/backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
INSTALLED_APP_FILE="$STATE/installed-app"
PREVIOUS_APP=""
[ -f "$INSTALLED_APP_FILE" ] && PREVIOUS_APP=$(cat "$INSTALLED_APP_FILE")
if [ -n "$PREVIOUS_APP" ] && [ "$PREVIOUS_APP" != "$APP" ]; then echo "error: bridge is already assigned to $PREVIOUS_APP; uninstall it first" >&2; exit 73; fi

umask 077
mkdir -p "$STATE/backups" "$CONFIG_ROOT" "$(dirname "$LAUNCH_AGENT")" "$TRANSACTION"
chmod 700 "$STATE" "$STATE/backups" "$CONFIG_ROOT" "$TRANSACTION"
cp "$INDEX" "$TRANSACTION/index.html"
if [ -d "$DST" ]; then ditto --noextattr --norsrc "$DST" "$TRANSACTION/plugin"; touch "$TRANSACTION/had-plugin"; fi
[ -f "$TOKEN_FILE" ] && cp "$TOKEN_FILE" "$TRANSACTION/bridge-token"
[ -f "$LAUNCH_AGENT" ] && cp "$LAUNCH_AGENT" "$TRANSACTION/launch-agent.plist"

rollback() {
  status=$?
  [ "$status" -eq 0 ] && return
  echo "error: installation failed; restoring the pre-install transaction" >&2
  launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
  cp "$TRANSACTION/index.html" "$INDEX" || true
  rm -rf "$DST"
  [ -f "$TRANSACTION/had-plugin" ] && ditto --noextattr --norsrc "$TRANSACTION/plugin" "$DST"
  if [ -f "$TRANSACTION/bridge-token" ]; then cp "$TRANSACTION/bridge-token" "$TOKEN_FILE"; else rm -f "$TOKEN_FILE"; fi
  if [ -f "$TRANSACTION/launch-agent.plist" ]; then cp "$TRANSACTION/launch-agent.plist" "$LAUNCH_AGENT"; [ "$SKIP_LAUNCH_AGENT" -eq 1 ] || launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true; else rm -f "$LAUNCH_AGENT"; fi
  [ "$ORIGINAL_CREATED" -eq 1 ] && rm -rf "$ORIGINAL"
  "$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP" >/dev/null 2>&1 || true
  exit "$status"
}
trap rollback EXIT

echo "[3/8] Recording original bundle state"
if [ ! -f "$ORIGINAL/index.html" ]; then
  ORIGINAL_CREATED=1
  mkdir -p "$ORIGINAL"; chmod 700 "$ORIGINAL"; cp "$INDEX" "$ORIGINAL/index.html"
  if [ -d "$DST" ]; then ditto --noextattr --norsrc "$DST" "$ORIGINAL/plugin"; touch "$ORIGINAL/had-plugin"; fi
fi

echo "[4/8] Installing plugin files and external configuration"
[ -f "$CONFIG_ROOT/settings.user.toml" ] || cp "$PLUGIN_SRC/global/settings/settings.user.toml" "$CONFIG_ROOT/settings.user.toml"
chmod 600 "$CONFIG_ROOT/settings.user.toml"
# A previously ad-hoc-signed bundle can reject in-place overwrites of sealed
# resources. The transaction above already contains the old tree, so replace
# it atomically from the installer's point of view instead of merging into it.
rm -rf "$DST"
mkdir -p "$DST"
ditto --noextattr --norsrc "$PLUGIN_SRC" "$DST"

echo "[5/8] Rotating bridge credentials and injecting loader"
openssl rand -hex 32 > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"
node "$PLUGIN_SRC/macos/bin/configure_loader.js" "$PLUGIN_SRC/macos/loader.js" "$TOKEN_FILE" "$DST/macos/loader.js"
node "$DST/macos/bin/edit_index.js" inject "$INDEX"

echo "[6/8] Writing least-privilege LaunchAgent"
touch "$LOG_FILE"; chmod 600 "$LOG_FILE"
node "$PLUGIN_SRC/macos/bin/write_launch_agent.js" "$LAUNCH_AGENT" "$(command -v node)" "$DST/macos/bridge.js" "$TOKEN_FILE" "$DST" "$CONFIG_ROOT" "$LOG_FILE"
chmod 600 "$LAUNCH_AGENT"

echo "[7/8] Applying ad-hoc development signature"
"$SCRIPT_DIR/sign_macos_dev.sh" --app "$APP"

echo "[8/8] Activating bridge"
launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT" 2>/dev/null || true
if [ "$SKIP_LAUNCH_AGENT" -eq 1 ]; then echo "  LaunchAgent activation skipped by explicit test option."; else launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT"; fi
printf '%s\n' "$APP" > "$INSTALLED_APP_FILE"
printf '%s\n' "$TRANSACTION" > "$STATE/last-install-backup"
chmod 600 "$INSTALLED_APP_FILE" "$STATE/last-install-backup"
trap - EXIT
echo "Installed experimental macOS beta into: $APP"
echo "Backup transaction: $TRANSACTION"
echo "This build is ad-hoc signed, not notarized, and not distributable as a Typora binary."
