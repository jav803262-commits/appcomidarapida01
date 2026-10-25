-- Fase 5: límites anti-abuso en create_order (aplican incluso llamando directo con el rol anon).
begin;
select t.open_business();
update public.settings set max_active_orders_per_phone = 2, max_pending_orders = 500;
delete from public.orders;   -- parte de cero (la transacción se revierte al final)

do $$
declare
  v_first jsonb := t.payload('cash', gen_random_uuid(), '5511111111');
  v_r jsonb; v_second jsonb; v_pending int;
begin
  perform t.use_role('anon');

  -- 1. los dos primeros pedidos del mismo teléfono se aceptan
  v_r := public.create_order(v_first);
  assert (v_r ->> 'duplicate')::boolean = false, 'FALLO 1a';
  v_second := public.create_order(t.payload('cash', gen_random_uuid(), '5511111111'));
  assert (v_second ->> 'duplicate')::boolean = false, 'FALLO 1b';

  -- 2. el tercero se rechaza con SQLSTATE PT429 (HTTP 429 en PostgREST)
  begin
    perform public.create_order(t.payload('cash', gen_random_uuid(), '5511111111'));
    raise exception 'FALLO 2: se acepto un tercer pedido en proceso del mismo telefono';
  exception when sqlstate 'PT429' then
    assert sqlerrm like '%pedidos en proceso%', 'FALLO 2: mensaje inesperado: ' || sqlerrm;
  end;

  -- 3. reintentar el primer pedido (misma solicitud) sigue funcionando: es idempotente, no un pedido nuevo
  v_r := public.create_order(v_first);
  assert (v_r ->> 'duplicate')::boolean = true, 'FALLO 3: el reintento idempotente fue bloqueado';

  -- 4. otro teléfono no se ve afectado
  perform public.create_order(t.payload('cash', gen_random_uuid(), '5522222222'));

  -- 5. al cancelar uno de los pedidos se libera cupo
  reset role;
  perform t.use_role('authenticated', t.admin_claims());
  perform public.transition_order_status((v_second ->> 'id')::uuid, 'cancelled');
  reset role;
  perform t.use_role('anon');
  perform public.create_order(t.payload('cash', gen_random_uuid(), '5511111111'));

  -- 6. tope global de pedidos pendientes
  reset role;
  select count(*) into v_pending from public.orders where status = 'pending';
  update public.settings set max_pending_orders = v_pending;
  perform t.use_role('anon');
  begin
    perform public.create_order(t.payload('cash', gen_random_uuid(), '5533333333'));
    raise exception 'FALLO 6: se acepto un pedido con la cocina saturada';
  exception when sqlstate 'PT429' then
    assert sqlerrm like '%muchos pedidos%', 'FALLO 6: mensaje inesperado: ' || sqlerrm;
  end;
  reset role;
end $$;

-- 7. los valores configurables tienen límites razonables
do $$
begin
  begin update public.settings set max_active_orders_per_phone = 0; raise exception 'FALLO 7a';
  exception when check_violation then null; end;
  begin update public.settings set max_pending_orders = 100000; raise exception 'FALLO 7b';
  exception when check_violation then null; end;
end $$;

rollback;
\echo 'OK  20_abuse_protection'
