#!/usr/bin/env bash
set -euo pipefail
# Always creates and drops its OWN database over a local socket. No remote URL accepted.
cd "$(dirname "$0")/../.."
export PGHOST=/var/run/postgresql
unset PGDATABASE PGSERVICE PGSERVICEFILE
DB="afterlist_foundation_${$}_${RANDOM}"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f supabase/verification/postgres-bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$migration"
done
pg_prove --dbname "$DB" supabase/tests/*.sql
