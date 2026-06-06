#!/usr/bin/env bash
# CI: validate every language pack against packs/schema.json + pydantic models.
# Exits non-zero on any validation failure.
#
# Usage:
#   bash scripts/validate-packs.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT/backend"
exec python3 -m language_pack validate
