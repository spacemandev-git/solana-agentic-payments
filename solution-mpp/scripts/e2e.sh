#!/usr/bin/env bash
# One-command e2e: Postgres up, migrations pushed, API boots (no facilitator
# needed), agent demo runs against a fresh USDC-only wallet. Requires:
# surfpool running, `bun install` + `bun run setup` + .env populated already.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ docker compose up -d"
docker compose up -d

echo "▶ bun run db:push"
bun run db:push

echo "▶ bun run dev (background)"
bun run dev > /tmp/mpp-e2e.log 2>&1 &
DEV_PID=$!
trap "kill $DEV_PID 2>/dev/null || true" EXIT

for i in {1..30}; do
  if curl -sf http://127.0.0.1:"${API_PORT:-4022}"/ > /dev/null; then
    echo "▶ API ready"
    break
  fi
  sleep 0.5
done

echo "▶ bun run agent:demo"
bun run agent:demo
