#!/usr/bin/env bash
# Links the desklet into Cinnamon. Safe to run again.
set -euo pipefail
source_dir="$(cd "$(dirname "$0")" && pwd)/weather-strip@osobno"
target="$HOME/.local/share/cinnamon/desklets/weather-strip@osobno"
if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "refusing: $target exists and is not a link" >&2
    exit 1
fi
ln -sfn "$source_dir" "$target"
echo "linked $target -> $source_dir"
