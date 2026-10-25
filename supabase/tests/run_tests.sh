#!/usr/bin/env bash
# Recrea la base local (stub + migraciones + seed) y ejecuta todas las pruebas de supabase/tests/sql.
# Uso: supabase/tests/run_tests.sh      (requiere PostgreSQL local y ejecutarse como root)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; DB=toritos_tests
"$HERE/run_migrations.sh" "$DB" --seed >/dev/null || { echo "Fallo al aplicar migraciones"; exit 1; }
fail=0
for f in "$HERE"/sql/*.sql; do
  out=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $f" 2>&1 | grep -v NOTICE); code=$?
  case "$(basename "$f")" in 00_*) continue;; esac
  if echo "$out" | grep -q -E "ERROR|FALLO"; then echo "FALLO  $(basename "$f")"; echo "$out" | grep -E "ERROR|FALLO|CONTEXT" | head -6; fail=1; else echo "$out"; fi
done
"$HERE/concurrency.sh" 2>&1 || fail=1
exit $fail
