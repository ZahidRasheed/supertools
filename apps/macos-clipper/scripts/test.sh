#!/usr/bin/env bash
# Run before every install or in CI. Catches logic regressions without manual clipping.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "Running unit tests…"
swift test
echo "All tests passed."
