#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT_ROOT=${CTS_OUTPUT_ROOT:-"$ROOT/../outputs"}
PACKAGE="$OUT_ROOT/codex-theme-studio-preview-v1"

mkdir -p "$PACKAGE/github" "$PACKAGE/social" "$PACKAGE/themes"
cp "$ROOT/marketing/PREVIEW-NOTES.md" "$PACKAGE/README.md"
cp "$ROOT/docs/images/gallery.jpg" "$ROOT/docs/images/language.jpg" "$ROOT/docs/images/plugin.jpg" "$ROOT/docs/images/safety.jpg" "$PACKAGE/github/"
cp "$ROOT/marketing/output/"*.jpg "$PACKAGE/social/"
cp -R "$ROOT/plugins/codex-theme-studio/themes/." "$PACKAGE/themes/"
(cd "$OUT_ROOT" && /usr/bin/zip -FSqr codex-theme-studio-preview-v1.zip codex-theme-studio-preview-v1)
/usr/bin/shasum -a 256 "$OUT_ROOT/codex-theme-studio-preview-v1.zip" > "$OUT_ROOT/codex-theme-studio-preview-v1.zip.sha256"
printf '%s\n' "$OUT_ROOT/codex-theme-studio-preview-v1.zip"

