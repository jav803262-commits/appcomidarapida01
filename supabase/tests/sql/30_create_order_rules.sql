-- Fase 6: reglas de negocio de create_order (todas ejecutadas con el rol anon).
begin;
select t.open_business();
update public.settings set max_active_orders_per_phone = 20, max_pending_orders = 500;
delete from public.orders;

-- Ejecuta una carga y comprueba que se rechaza con el mensaje esperado (SQLSTATE P0001).
create function t.expect_rejected(p jsonb, p_fragment text, p_label text) returns void language plpgsql as $$
begin
  begin
    perform public.create_order(p);
  exception when sqlstate 'P0001' then
    assert sqlerrm like '%' || p_fragment || '%', p_label || ': mensaje inesperado -> ' || sqlerrm;
    return;
  end;
  raise exception 'FALLO %: se acepto una solicitud que debia rechazarse', p_label;
end $$;
grant execute on function t.expect_rejected(jsonb, text, text) to public;

do $$
declare v_res jsonb; v_price numeric; v_total numeric; v_p jsonb; v_extra bigint;
begin
  select price into v_price from public.products where id = t.product_id();
  perform t.use_role('anon');

  -- 1. el precio lo decide la base: un precio manipulado desde el cliente se ignora
  v_p := jsonb_set(t.payload('cash'), '{items,0,price}', '0.01'::jsonb) || '{"total": 0.01, "subtotal": 0.01}'::jsonb;
  v_res := public.create_order(v_p);
  assert (v_res ->> 'total')::numeric = v_price, 'FALLO 1: el total no coincide con el precio de la base';

  -- 2. cantidades fuera de rango
  perform t.expect_rejected(t.payload('cash', gen_random_uuid(), '5500000001', 0), 'cantidad', '2a cantidad 0');
  perform t.expect_rejected(t.payload('cash', gen_random_uuid(), '5500000001', 51), 'entre 1 y 50', '2b cantidad 51');

  -- 3. producto inexistente / no disponible
  perform t.expect_rejected(
    jsonb_set(t.payload('cash'), '{items,0,productId}', '999999'::jsonb), 'no está disponible', '3 producto inexistente');

  -- 4. teléfono inválido, nombre vacío, pago inválido
  perform t.expect_rejected(t.payload('cash', gen_random_uuid(), '12345'), 'teléfono válido', '4a telefono corto');
  perform t.expect_rejected(jsonb_set(t.payload('cash'), '{customer,name}', '"  "'::jsonb), 'nombre válido', '4b nombre vacio');
  perform t.expect_rejected(t.payload('bitcoin'), 'Método de pago inválido', '4c metodo de pago');

  -- 5. efectivo menor al total
  perform t.expect_rejected(jsonb_set(t.payload('cash'), '{cashAmount}', '1'::jsonb), 'menor que el total', '5 efectivo insuficiente');

  -- 6. misma solicitud con datos distintos -> conflicto de idempotencia
  v_p := t.payload('cash', '11111111-1111-4111-8111-111111111111');
  perform public.create_order(v_p);
  perform t.expect_rejected(jsonb_set(v_p, '{items,0,quantity}', '2'::jsonb), 'ya se usó con otros datos', '6 idempotencia con payload distinto');

  -- 7. negocio pausado
  reset role;
  update public.settings set ordering_enabled = false;
  perform t.use_role('anon');
  perform t.expect_rejected(t.payload('cash'), 'pausados', '7 pedidos pausados');
  reset role;
  update public.settings set ordering_enabled = true;

  -- 8. a domicilio: colonia fuera de cobertura y colonia válida
  update public.settings set delivery_enabled = true, delivery_fee = 30, delivery_neighborhoods = '["Centro"]'::jsonb;
  perform t.use_role('anon');
  v_p := jsonb_set(jsonb_set(t.payload('cash'), '{orderType}', '"delivery"'::jsonb), '{address}',
         '{"street":"Calle 1 #2","neighborhood":"Lejos"}'::jsonb);
  perform t.expect_rejected(v_p, 'No realizamos entregas', '8a fuera de cobertura');
  v_p := jsonb_set(t.payload('cash', gen_random_uuid()), '{orderType}', '"delivery"'::jsonb)
         || '{"address":{"street":"Calle 1 #2","neighborhood":"centro"}}'::jsonb;
  v_res := public.create_order(v_p);
  assert (v_res ->> 'deliveryFee')::numeric = 30, 'FALLO 8b: no se cobro el envio';
  assert (v_res ->> 'total')::numeric = v_price + 30, 'FALLO 8c: total con envio incorrecto';
  reset role;
end $$;

rollback;
\echo 'OK  30_create_order_rules'
