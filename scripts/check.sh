#!/usr/bin/env bash
# CONVENTIONS 6: every check runs, every result is printed, exit non-zero if any failed.
# CHECK_NO_COVERAGE=1 drops only the coverage thresholds (vitest.config.ts reads it).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# gitleaks lookup: this checkout, then the main checkout, then PATH
main_root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
GITLEAKS=""
for d in ./.tools/bin "$main_root/.tools/bin"; do
  for n in gitleaks.exe gitleaks; do
    if [ -x "$d/$n" ]; then GITLEAKS="$d/$n"; break 2; fi
  done
done
if [ -z "$GITLEAKS" ] && command -v gitleaks >/dev/null 2>&1; then GITLEAKS=gitleaks; fi

failed=0
run() {
  local name="$1"; shift
  echo "==> $name"
  if "$@"; then echo "PASS  $name"; else echo "FAIL  $name"; failed=$((failed + 1)); fi
  echo
}
secrets() {
  if [ -z "$GITLEAKS" ]; then echo "gitleaks not found (run: bash scripts/setup-tools.sh)"; return 1; fi
  "$GITLEAKS" detect --no-git --redact --source .
}

run "lint (eslint)"            pnpm eslint .
run "format (prettier)"        pnpm prettier --check .
run "types (tsc strict)"       pnpm -r exec tsc --noEmit
run "layers (depcruise)"       pnpm depcruise packages grafts tools --config .dependency-cruiser.cjs
run "tests + coverage"         pnpm vitest run --coverage
run "sample graft check"       pnpm craft-check-graft grafts/sample-hello
run "secrets (gitleaks)"       secrets

if [ "$failed" -ne 0 ]; then echo "CHECK FAILED: $failed step(s)"; exit 1; fi
echo "CHECK OK"
