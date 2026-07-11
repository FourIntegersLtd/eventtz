#!/usr/bin/env bash
# Re-encode landing page videos for web: H.264, faststart, no audio.
# Only processes clips used on the home page (hero + celebrations carousel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIDEOS_DIR="$ROOT/public/videos"

# filename:max_width — keep in sync with landingData.ts (HERO_VIDEO_SRC + GALLERY_VIDEOS)
LANDING_VIDEOS=(
  "hero.mp4:1920"
  "hero2.mp4:1280"
  "hero3.mp4:1280"
  "hero5.mp4:1280"
  "hero6.mp4:1280"
  "hero7.mp4:1280"
)

optimize() {
  local file="$1"
  local max_width="$2"
  local input="$VIDEOS_DIR/$file"
  local tmp="$VIDEOS_DIR/.tmp-$file"

  if [[ ! -f "$input" ]]; then
    echo "skip missing $file (add file or remove from LANDING_VIDEOS in this script + landingData.ts)"
    return
  fi

  echo "Optimizing $file (max ${max_width}px)..."
  ffmpeg -y -i "$input" \
    -an \
    -c:v libx264 \
    -preset medium \
    -crf 28 \
    -vf "scale='min(${max_width},iw)':-2" \
    -movflags +faststart \
    -pix_fmt yuv420p \
    "$tmp"
  mv "$tmp" "$input"
}

for entry in "${LANDING_VIDEOS[@]}"; do
  file="${entry%%:*}"
  width="${entry##*:}"
  optimize "$file" "$width"
done

echo "Done. Landing videos:"
for entry in "${LANDING_VIDEOS[@]}"; do
  file="${entry%%:*}"
  if [[ -f "$VIDEOS_DIR/$file" ]]; then
    ls -lh "$VIDEOS_DIR/$file" | awk '{print $5, $9}'
  fi
done
echo "Total folder size:"
du -sh "$VIDEOS_DIR"
