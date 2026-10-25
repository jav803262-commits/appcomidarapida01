#!/usr/bin/env bash
# Verifica que el bloqueo por teléfono funciona con solicitudes SIMULTÁNEAS reales (varias sesiones).
# Sin el advisory lock, varias sesiones leerían "0 pedidos" a la vez y todas insertarían.
set -uo pipefail
DB=toritos_tests; N=8; LIMIT=2; PHONE=5544444444
q() { su postgres -c "psql -qAt -d $DB -c \"$1\""; }
q "select t.open_business()" >/dev/null
q "update public.settings set max_active_orders_per_phone=$LIMIT, max_pending_orders=500" >/dev/null
q "delete from public.orders where customer_phone='$PHONE'" >/dev/null
for i in $(seq 1 $N); do
  ( su postgres -c "psql -qAt -d $DB -c \"set role anon; select public.create_order(t.payload('cash', gen_random_uuid(), '$PHONE'))\"" >/tmp/conc_$i.out 2>&1 ) &
done
wait
ok=$(q "select count(*) from public.orders where customer_phone='$PHONE'")
q "delete from public.orders where customer_phone='$PHONE'" >/dev/null
q "update public.settings set max_active_orders_per_phone=3, max_pending_orders=30" >/dev/null
if [ "$ok" = "$LIMIT" ]; then echo "OK  concurrency ($N solicitudes simultaneas -> $ok pedidos aceptados, limite $LIMIT)"; else echo "FALLO  concurrency: $ok pedidos aceptados con limite $LIMIT"; exit 1; fi
