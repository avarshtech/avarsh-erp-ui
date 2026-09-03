#!/usr/bin/env bash
# Regression campaign runner — runs Playwright projects sequentially, one log per
# project, and prints a one-line verdict for each. Usage:
#   bash scripts/run-regression.sh [project ...]
# With no arguments it runs the full estate in dependency order.
#
# Assumes: backend on :8088 (e2e profile), UI on :3000, E2E_PASSWORD exported
# (admin123 for H2, admin98 for the Neon dev DB).

set -u
PROJECTS=("$@")
if [ ${#PROJECTS[@]} -eq 0 ]; then
  PROJECTS=(master-data costing orders bom po admin validation grn-qc legacy journey production-po approvals inventory reports)
fi

mkdir -p e2e/_logs/regression2
SUMMARY=""

for p in "${PROJECTS[@]}"; do
  log="e2e/_logs/regression2/${p}.log"
  echo "=== ${p} ==="
  npx playwright test --project="$p" --reporter=line 2>&1 \
    | sed -e 's/\x1b\[[0-9;]*[A-Za-z]//g' > "$log"
  verdict=$(grep -E "^\s+[0-9]+ (passed|failed|skipped|did not run)" "$log" | tr '\n' ' ' | sed 's/  */ /g')
  echo "${p}: ${verdict:-NO VERDICT (see $log)}"
  SUMMARY+="${p}: ${verdict:-NO VERDICT}\n"
done

echo ""
echo "===== SUMMARY ====="
printf "%b" "$SUMMARY"
