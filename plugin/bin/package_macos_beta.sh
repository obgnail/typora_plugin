#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
VERSION="v0.1.0-macos-beta"
OUT_DIR="$ROOT/dist"
ARCHIVE="$OUT_DIR/typora-plugin-$VERSION.zip"
STAGE=$(mktemp -d /private/tmp/typora-plugin-package.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/typora-plugin-$VERSION/docs/releases" "$OUT_DIR"
ditto --noextattr --norsrc "$ROOT/plugin" "$STAGE/typora-plugin-$VERSION/plugin"
cp "$ROOT/README.md" "$ROOT/README-cn.md" "$ROOT/LICENSE" "$STAGE/typora-plugin-$VERSION/"
cp "$ROOT/docs/macos.md" "$ROOT/docs/macos.zh-CN.md" "$ROOT/docs/macos-security-audit.md" "$STAGE/typora-plugin-$VERSION/docs/"
cp "$ROOT/docs/releases/$VERSION.md" "$STAGE/typora-plugin-$VERSION/docs/releases/"

rm -f "$ARCHIVE" "$ARCHIVE.sha256"
(cd "$STAGE" && /usr/bin/zip -X -q -r "$ARCHIVE" "typora-plugin-$VERSION")
shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
echo "$ARCHIVE"
cat "$ARCHIVE.sha256"
