#!/bin/sh
# ============================================================================
# Build the 900-px responsive variants of the site's photographs.
#
# app.js points a phone at assets/img/small/<name> through srcset, so a phone
# does not download a 1600-2000 px photograph for a 390 px screen. The variants
# are committed, so the site itself still has no build step: this script is only
# run when a photograph is added or replaced (a re-badge).
#
# It is macOS-only because it uses `sips`, the system image tool. Any phone will
# still work without it - app.js drops the srcset if a variant is missing and
# falls back to the full-size file.
#
#   sh tools/make-image-variants.sh
# ============================================================================
set -eu

DIR=$(cd "$(dirname "$0")/.." && pwd)
SRC="$DIR/assets/img"
OUT="$SRC/small"

if ! command -v sips >/dev/null 2>&1; then
  echo "sips not found: this helper needs macOS." >&2
  exit 1
fi

mkdir -p "$OUT"
count=0
for f in "$SRC"/*.jpg "$SRC"/*.jpeg; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  # -Z fits the longest side to 900 px; every photograph here is landscape, so
  # the result is exactly 900 px wide, which is what the srcset advertises.
  sips -Z 900 -s format jpeg -s formatOptions 72 "$f" --out "$OUT/$name" >/dev/null
  count=$((count + 1))
done

echo "$count responsive variant(s) written to assets/img/small/"
