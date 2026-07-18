#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$("${CTS_NODE:-node}" -p "JSON.parse(require('fs').readFileSync('$ROOT/package.json')).version")
OUT="$ROOT/release"
NAME="theme-studio-for-codex-v$VERSION"
LEGACY_NAME="codex-theme-studio-v$VERSION"

rm -rf "$OUT/$NAME"
rm -f "$OUT/$NAME.zip" "$OUT/$NAME.zip.sha256"
# Remove the former outward-facing archive name so a release directory cannot expose two brands.
rm -rf "$OUT/$LEGACY_NAME"
rm -f "$OUT/$LEGACY_NAME.zip" "$OUT/$LEGACY_NAME.zip.sha256"
mkdir -p "$OUT/$NAME"
cp -R "$ROOT/.agents" "$ROOT/plugins" "$OUT/$NAME/"

# The downloadable archive contains only the installable Plugin and the
# operational documents needed to install, recover, inspect, and extend it.
# Repository screenshots, internal release notes, and contributor-only source
# material remain in GitHub and are intentionally excluded from the ZIP.
mkdir -p "$OUT/$NAME/docs"
cp "$ROOT/docs/INSTALL.md" \
  "$ROOT/docs/INSTALL.zh-CN.md" \
  "$ROOT/docs/THEME_FORMAT.md" \
  "$ROOT/docs/UPGRADE_COMPATIBILITY.md" \
  "$OUT/$NAME/docs/"
cp "$ROOT/docs/PACKAGE_README.md" "$OUT/$NAME/README.md"
cp "$ROOT/LICENSE" \
  "$ROOT/NOTICE.md" \
  "$ROOT/ASSETS-LICENSE.md" \
  "$ROOT/PRIVACY.md" \
  "$ROOT/SECURITY.md" \
  "$OUT/$NAME/"
(cd "$OUT" && /usr/bin/zip -qr "$NAME.zip" "$NAME")
(cd "$OUT" && /usr/bin/shasum -a 256 "$NAME.zip" > "$NAME.zip.sha256")
printf '%s\n' "$OUT/$NAME.zip"
