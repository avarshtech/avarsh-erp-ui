#!/bin/bash
# ============================================================================
# E2E Test Runner — Linux/Mac/CI
# Starts API (H2 in-memory) + UI dev server, runs Playwright, then cleans up.
#
# Usage:
#   ./scripts/run-e2e.sh              # run all modules
#   ./scripts/run-e2e.sh costing      # run specific module
#   ./scripts/run-e2e.sh validation   # run validation tests only
#   E2E_HEADED=true ./scripts/run-e2e.sh  # headed mode
# ============================================================================

set -e

MODULE=${1:-""}
if [ -z "$API_REPO_PATH" ]; then
  # Try sibling of the UI repo first, then sibling of the parent folder
  if [ -d "$(dirname "$0")/../../erp-purchase" ]; then
    API_REPO_PATH="$(dirname "$0")/../../erp-purchase"
  else
    API_REPO_PATH="$(dirname "$0")/../../../erp-purchase"
  fi
fi
API_PORT=${SERVER_PORT:-8088}
UI_PORT=3000
API_PID=""
UI_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  [ -n "$UI_PID" ] && kill "$UI_PID" 2>/dev/null || true
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  # Kill any remaining child processes
  jobs -p | xargs kill 2>/dev/null || true
  echo -e "${GREEN}Cleanup complete.${NC}"
}

trap cleanup EXIT

# ── 1. Start API with H2 ──────────────────────────────────
echo -e "${YELLOW}Starting API server with H2 database...${NC}"
if [ ! -d "$API_REPO_PATH" ]; then
  echo -e "${RED}Error: API repo not found at $API_REPO_PATH${NC}"
  echo "Set API_REPO_PATH environment variable to the erp-purchase repo path."
  exit 1
fi

cd "$API_REPO_PATH"
SPRING_PROFILES_ACTIVE=e2e SERVER_PORT=$API_PORT ./gradlew bootRun --quiet &
API_PID=$!
cd - > /dev/null

# ── 2. Wait for API to be ready ───────────────────────────
echo -e "${YELLOW}Waiting for API on port $API_PORT...${NC}"
for i in $(seq 1 90); do
  if curl -sf "http://localhost:$API_PORT/api/v1/categories" -H "Content-Type: application/json" > /dev/null 2>&1; then
    echo -e "${GREEN}API is ready!${NC}"
    break
  fi
  if [ $i -eq 90 ]; then
    echo -e "${RED}API failed to start within 3 minutes.${NC}"
    exit 1
  fi
  sleep 2
done

# ── 3. Start UI dev server ────────────────────────────────
echo -e "${YELLOW}Starting UI dev server...${NC}"
VITE_API_BASE_URL="http://localhost:$API_PORT/api/v1" npm run dev &
UI_PID=$!

# ── 4. Wait for UI ────────────────────────────────────────
echo -e "${YELLOW}Waiting for UI on port $UI_PORT...${NC}"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$UI_PORT" > /dev/null 2>&1; then
    echo -e "${GREEN}UI is ready!${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}UI failed to start within 1 minute.${NC}"
    exit 1
  fi
  sleep 2
done

# ── 5. Run Playwright tests ───────────────────────────────
echo -e "${YELLOW}Running E2E tests...${NC}"
if [ -n "$MODULE" ]; then
  echo -e "Module: ${GREEN}$MODULE${NC}"
  npx playwright test --project="$MODULE"
else
  echo -e "Module: ${GREEN}all${NC}"
  npx playwright test
fi
TEST_EXIT=$?

# ── 6. Report ─────────────────────────────────────────────
if [ $TEST_EXIT -eq 0 ]; then
  echo -e "\n${GREEN}All E2E tests passed!${NC}"
else
  echo -e "\n${RED}Some E2E tests failed. See report: e2e-report/index.html${NC}"
fi

exit $TEST_EXIT
