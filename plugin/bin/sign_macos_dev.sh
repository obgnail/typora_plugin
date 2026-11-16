#!/bin/bash
set -euo pipefail

APP=""
DRY_RUN=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done
[ -n "$APP" ] && [ -d "$APP" ] || { echo "usage: $0 --app /path/to/Typora-Test.app [--dry-run]" >&2; exit 64; }
[ ! -L "$APP" ] || { echo "error: refusing to sign an application symlink" >&2; exit 77; }
APP=$(cd "$(dirname "$APP")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$APP")")
[ "$APP" != "/Applications/Typora.app" ] || { echo "error: refusing to sign the production Typora application" >&2; exit 77; }

if /usr/bin/xattr -lr "$APP" 2>/dev/null | grep 'com.apple.fileprovider' >/dev/null; then
  echo "error: $APP is managed by File Provider; FinderInfo will be recreated during signing." >&2
  echo "Copy it to a local non-synchronised directory with: ditto --noextattr --norsrc '$APP' '/private/tmp/Typora-Test.app'" >&2
  exit 78
fi
if /usr/bin/xattr -lr "$APP" 2>/dev/null | grep 'com.apple.quarantine' >/dev/null; then
  echo "error: quarantine is present; refusing to remove it automatically" >&2
  exit 77
fi

run() { if [ "$DRY_RUN" -eq 1 ]; then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
while IFS= read -r -d '' item; do
  for attr in com.apple.FinderInfo com.apple.ResourceFork; do
    if /usr/bin/xattr "$item" 2>/dev/null | grep -qx "$attr"; then run /usr/bin/xattr -d "$attr" "$item"; fi
  done
done < <(find "$APP" -print0)

ENTITLEMENTS=$(mktemp /private/tmp/typora-entitlements.XXXXXX)
trap 'rm -f "$ENTITLEMENTS"' EXIT
cat > "$ENTITLEMENTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>
</dict></plist>
PLIST

sign() { if [ -e "$1" ]; then run codesign --force --sign - --options runtime --preserve-metadata=identifier "$1"; fi; }
sign "$APP/Contents/Resources/TypeMark/lib/bin/x64/rg"
sign "$APP/Contents/Resources/TypeMark/lib/bin/arm/rg"
sign "$APP/Contents/Frameworks/Sparkle.framework/Versions/A/Resources/Autoupdate.app/Contents/MacOS/fileop"
sign "$APP/Contents/Frameworks/Sparkle.framework/Versions/A/Resources/Autoupdate.app"
sign "$APP/Contents/Frameworks/Sparkle.framework"
run codesign --force --sign - --options runtime --preserve-metadata=identifier --entitlements "$ENTITLEMENTS" "$APP"
[ "$DRY_RUN" -eq 1 ] || codesign --verify --deep --strict --verbose=4 "$APP"
