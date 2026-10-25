#!/usr/bin/env bash
# Recrea una base de prueba local y aplica stub + migraciones (+ seed opcional).
# Uso: tests/run_migrations.sh <nombre_db> [--seed]
set -euo pipefail
DB="${1:?indica el nombre de la base}"; SEED="${2:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql -q -v ON_ERROR_STOP=1 -d $DB"
su postgres -c "dropdb --if-exists $DB" 2>/dev/null; su postgres -c "createdb $DB"
su postgres -c "$PSQL -f $HERE/tests/00_supabase_stub.sql"
for f in "$HERE"/migrations/*.sql; do echo "-> $(basename "$f")"; su postgres -c "$PSQL -f $f" 2>&1 | grep -v NOTICE || true; done
if [ "$SEED" = "--seed" ]; then echo "-> seed.sql"; su postgres -c "$PSQL -f $HERE/seed.sql" 2>&1 | grep -v NOTICE || true; fi
