#!/bin/bash
set -u

APP="${TYPORA_APP:-$HOME/Desktop/Typora-Test.app}"
if [ "${1:-}" = "--app" ] && [ -n "${2:-}" ]; then APP="$2"; fi
INDEX="$APP/Contents/Resources/TypeMark/index.html"

if [ ! -d "$APP" ]; then echo "error: app not found: $APP" >&2; exit 66; fi
echo "Application: $APP"
echo "Version: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist" 2>/dev/null || echo unknown)"
echo "Architectures: $(lipo -archs "$APP/Contents/MacOS/Typora" 2>/dev/null || echo unknown)"
echo "Index: $INDEX"
grep -n "typora-plugin-macos\|plugin/macos\|appsrc/main.js\|SystemJS.import" "$INDEX" 2>/dev/null || true

echo "Problematic extended attributes:"
found=0
while IFS= read -r -d '' item; do
  attrs=$(/usr/bin/xattr "$item" 2>/dev/null || true)
  bad=$(printf '%s\n' "$attrs" | grep -E 'com\.apple\.(FinderInfo|ResourceFork|quarantine|provenance|macl|fileprovider)' || true)
  if [ -n "$bad" ]; then
    found=1
    printf '  %s\n' "$item"
    printf '%s\n' "$bad" | sed 's/^/    /'
  fi
done < <(find "$APP" -print0)
[ "$found" -eq 1 ] || echo "  none"

echo "Signatures:"
for item in \
  "$APP/Contents/Resources/TypeMark/lib/bin/x64/rg" \
  "$APP/Contents/Resources/TypeMark/lib/bin/arm/rg" \
  "$APP/Contents/Frameworks/Sparkle.framework/Versions/A/Resources/Autoupdate.app/Contents/MacOS/fileop" \
  "$APP/Contents/Frameworks/Sparkle.framework/Versions/A/Resources/Autoupdate.app" \
  "$APP/Contents/Frameworks/Sparkle.framework" \
  "$APP"; do
  [ -e "$item" ] || continue
  if codesign --verify --strict --verbose=2 "$item" 2>&1; then echo "  valid: $item"; else echo "  invalid: $item"; fi
done

echo "Gatekeeper (separate from signature validity):"
spctl --assess --type execute --verbose=4 "$APP" 2>&1 || true
