#!/usr/bin/env bash
# Install pinned gitleaks into <checkout>/.tools/bin (git-ignored). Idempotent.
# Usage: bash scripts/setup-tools.sh [checkout-dir]   (default: the main checkout)
set -euo pipefail
VER=8.30.1
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
main="$(dirname "$(git -C "$here" rev-parse --path-format=absolute --git-common-dir)")"
dest="${1:-$main}/.tools/bin"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) asset="gitleaks_${VER}_windows_x64.zip"; exe=gitleaks.exe
    sha=d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e ;;
  Linux*) asset="gitleaks_${VER}_linux_x64.tar.gz"; exe=gitleaks
    sha=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
  Darwin*) if [ "$(uname -m)" = arm64 ]; then
      asset="gitleaks_${VER}_darwin_arm64.tar.gz"; sha=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5
    else asset="gitleaks_${VER}_darwin_x64.tar.gz"; sha=dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709; fi
    exe=gitleaks ;;
  *) echo "unsupported OS"; exit 1 ;;
esac
if [ -x "$dest/$exe" ] && "$dest/$exe" version 2>/dev/null | grep -q "$VER"; then
  echo "gitleaks $VER already in $dest"; exit 0
fi
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/$asset" "https://github.com/gitleaks/gitleaks/releases/download/v${VER}/${asset}"
echo "$sha  $tmp/$asset" | sha256sum -c - >/dev/null || { echo "checksum mismatch for $asset"; exit 1; }
mkdir -p "$dest"
case "$asset" in *.zip) unzip -q -o "$tmp/$asset" "$exe" -d "$dest" ;; *) tar -xzf "$tmp/$asset" -C "$dest" "$exe" ;; esac
chmod +x "$dest/$exe"
echo "installed gitleaks $VER (checksum verified) in $dest"
