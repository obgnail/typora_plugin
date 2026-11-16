#!/bin/bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d /private/tmp/typora-plugin-ci.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
SOURCE="$WORK/Typora-Source.app"
TARGET="$WORK/Typora-Beta.app"
TEST_HOME="$WORK/home"
mkdir -p "$SOURCE/Contents/MacOS" "$SOURCE/Contents/Resources/TypeMark/appsrc" "$TEST_HOME"
cp /usr/bin/true "$SOURCE/Contents/MacOS/Typora"
chmod +x "$SOURCE/Contents/MacOS/Typora"

/usr/libexec/PlistBuddy -c 'Add :CFBundleIdentifier string io.typora.plugin.ci' \
  -c 'Add :CFBundleExecutable string Typora' \
  -c 'Add :CFBundleName string Typora CI Fixture' \
  -c 'Add :CFBundlePackageType string APPL' \
  -c 'Add :CFBundleShortVersionString string 1.14.15' \
  -c 'Add :CFBundleVersion string 1' \
  "$SOURCE/Contents/Info.plist"
printf '<html><body><script src="./appsrc/main.js"></script></body></html>\n' > "$SOURCE/Contents/Resources/TypeMark/index.html"
printf 'window.syntheticTypora = true\n' > "$SOURCE/Contents/Resources/TypeMark/appsrc/main.js"
ORIGINAL_HASH=$(shasum -a 256 "$SOURCE/Contents/Resources/TypeMark/index.html" | awk '{print $1}')

HOME="$TEST_HOME" "$ROOT/plugin/bin/install_macos.sh" --source "$SOURCE" --app "$TARGET" --dry-run --allow-single-arch > "$WORK/dry-run.log"
[ ! -e "$TARGET" ]
grep -q 'No files, signatures, configuration, or LaunchAgents were changed' "$WORK/dry-run.log"

HOME="$TEST_HOME" "$ROOT/plugin/bin/install_macos.sh" --source "$SOURCE" --app "$TARGET" --yes --allow-single-arch --skip-launch-agent
grep -q 'typora-plugin-macos:start' "$TARGET/Contents/Resources/TypeMark/index.html"
[ "$(grep -c 'typora-plugin-macos:start' "$TARGET/Contents/Resources/TypeMark/index.html")" -eq 1 ]
[ "$(stat -f '%Lp' "$TEST_HOME/Library/Application Support/typora_plugin/bridge-token")" = "600" ]
[ "$(stat -f '%Lp' "$TEST_HOME/.config/typora_plugin/settings.user.toml")" = "600" ]
plutil -lint "$TEST_HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist"
codesign --verify --deep --strict "$TARGET"

HOME="$TEST_HOME" "$ROOT/plugin/bin/install_macos.sh" --app "$TARGET" --yes --allow-single-arch --skip-launch-agent
[ "$(grep -c 'typora-plugin-macos:start' "$TARGET/Contents/Resources/TypeMark/index.html")" -eq 1 ]

# A signing failure during uninstall must restore the installed application and
# its LaunchAgent instead of leaving a partially uninstalled state.
mkdir -p "$WORK/uninstall-fail-bin"
printf '#!/bin/sh\nexit 42\n' > "$WORK/uninstall-fail-bin/codesign"
chmod +x "$WORK/uninstall-fail-bin/codesign"
set +e
HOME="$TEST_HOME" PATH="$WORK/uninstall-fail-bin:$PATH" "$ROOT/plugin/bin/uninstall_macos.sh" --app "$TARGET" --yes --skip-launch-agent > "$WORK/uninstall-rollback.log" 2>&1
UNINSTALL_STATUS=$?
set -e
[ "$UNINSTALL_STATUS" -ne 0 ]
grep -q 'typora-plugin-macos:start' "$TARGET/Contents/Resources/TypeMark/index.html"
[ -d "$TARGET/Contents/Resources/TypeMark/plugin" ]
[ -f "$TEST_HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist" ]
[ -f "$TEST_HOME/Library/Application Support/typora_plugin/bridge-token" ]
grep -q 'restoring installed state' "$WORK/uninstall-rollback.log"

HOME="$TEST_HOME" "$ROOT/plugin/bin/uninstall_macos.sh" --app "$TARGET" --yes --skip-launch-agent
RESTORED_HASH=$(shasum -a 256 "$TARGET/Contents/Resources/TypeMark/index.html" | awk '{print $1}')
[ "$RESTORED_HASH" = "$ORIGINAL_HASH" ]
[ ! -e "$TARGET/Contents/Resources/TypeMark/plugin" ]
[ ! -e "$TEST_HOME/Library/Application Support/typora_plugin/bridge-token" ]
[ ! -e "$TEST_HOME/Library/LaunchAgents/io.typora.plugin.macos-bridge.plist" ]
HOME="$TEST_HOME" "$ROOT/plugin/bin/uninstall_macos.sh" --app "$TARGET" --yes --skip-launch-agent | grep -q 'Already uninstalled'

ROLLBACK_TARGET="$WORK/Typora-Rollback.app"
ditto --noextattr --norsrc "$SOURCE" "$ROLLBACK_TARGET"
mkdir -p "$WORK/fail-bin"
printf '#!/bin/sh\nexit 42\n' > "$WORK/fail-bin/codesign"
chmod +x "$WORK/fail-bin/codesign"
set +e
HOME="$TEST_HOME" PATH="$WORK/fail-bin:$PATH" "$ROOT/plugin/bin/install_macos.sh" --app "$ROLLBACK_TARGET" --yes --allow-single-arch --skip-launch-agent > "$WORK/rollback.log" 2>&1
STATUS=$?
set -e
[ "$STATUS" -ne 0 ]
! grep -q 'typora-plugin-macos:start' "$ROLLBACK_TARGET/Contents/Resources/TypeMark/index.html"
[ ! -e "$ROLLBACK_TARGET/Contents/Resources/TypeMark/plugin" ]
[ ! -e "$TEST_HOME/Library/Application Support/typora_plugin/bridge-token" ]
grep -q 'restoring the pre-install transaction' "$WORK/rollback.log"

echo "macOS installer simulation passed ($(uname -m))"
