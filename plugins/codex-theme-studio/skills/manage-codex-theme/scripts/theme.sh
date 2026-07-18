#!/bin/sh
set -eu

SKILL_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PLUGIN_DIR=$(CDPATH= cd -- "$SKILL_DIR/../.." && pwd)
exec "$PLUGIN_DIR/scripts/cts" "$@"

