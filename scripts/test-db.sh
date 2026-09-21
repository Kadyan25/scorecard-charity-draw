#!/usr/bin/env bash
# Runs supabase/tests/db_rules.sql against the local Supabase database.
# The SQL wraps itself in a transaction and rolls back, so no data persists.
set -euo pipefail

container="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)"
if [[ -z "$container" ]]; then
  echo "Local Supabase is not running. Start it with: supabase start" >&2
  exit 1
fi

output="$(docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q -tA \
  < "$(dirname "$0")/../supabase/tests/db_rules.sql" 2>&1)" || {
  echo "$output" | grep -E "FAIL|ERROR" >&2
  exit 1
}

echo "$output" | grep "ALL DATABASE RULE TESTS PASSED"
