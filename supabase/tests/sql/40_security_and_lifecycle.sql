-- Fase 6: permisos (RLS) y ciclo de vida del pedido (transiciones, pago, seguimiento público).
begin;
select t.open_business();
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001', 'admin@prueba.local');
update public.settings set max_active_orders_per_phone = 20, max_pending_orders = 500;
delete from public.orders;

do $$
declare
  v_res jsonb; v_id uuid; v_folio text; v_cnt int; v_track jsonb;
begin
  perform t.use_role('anon');
  v_res := public.create_order(t.payload('cash', gen_random_uuid(), '5512345678'));
  v_id := (v_res ->> 'id')::uuid; v_folio := v_res ->> 'orderNumber';

  -- 1. anon NO puede leer ni escribir pedidos, líneas, pagos ni tracking directamente
  begin perform 1 from public.orders; raise exception 'FALLO 1a: anon lee orders';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_items; raise exception 'FALLO 1b: anon lee order_items';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.order_payments; raise exception 'FALLO 1c: anon lee order_payments';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.public_order_tracking; raise exception 'FALLO 1d: anon lee tracking directo';
  exception when insufficient_privilege then null; end;
  begin insert into public.orders default values; raise exception 'FALLO 1e: anon inserta orders';
  exception when insufficient_privilege then null; end;
  begin update public.products set price = 0; raise exception 'FALLO 1f: anon modifica productos';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 2. un usuario autenticado no admin tampoco ve pedidos ni cambia estados
  perform t.use_role('authenticated', t.user_claims());
  select count(*) into v_cnt from public.orders;
  assert v_cnt = 0, 'FALLO 2a: un usuario normal ve pedidos';
  begin perform public.transition_order_status(v_id, 'confirmed'); raise exception 'FALLO 2b: usuario normal cambio estado';
  exception when insufficient_privilege then null; end;
  begin perform public.record_order_payment(v_id, 'cash'); raise exception 'FALLO 2c: usuario normal cobro';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 3. seguimiento público: exige folio + últimos 4 dígitos y devuelve solo datos mínimos
  perform t.use_role('anon');
  v_track := public.get_public_order_status(v_folio, '5678');
  assert v_track ->> 'orderNumber' = v_folio and v_track ->> 'status' = 'pending', 'FALLO 3a: seguimiento incorrecto';
  assert not (v_track ? 'customer_phone' or v_track ? 'customer_name' or v_track ? 'total' or v_track ? 'items'),
         'FALLO 3b: el seguimiento filtra datos personales: ' || v_track::text;
  assert public.get_public_order_status(v_folio, '0000') is null, 'FALLO 3c: acepto telefono incorrecto';
  assert public.get_public_order_status('ZZZZZZ', '5678') is null, 'FALLO 3d: folio inexistente devolvio datos';
  reset role;

  -- 4. ciclo de vida como admin: no se entrega sin cobrar, y las transiciones son ordenadas
  perform t.use_role('authenticated', t.admin_claims());
  begin perform public.transition_order_status(v_id, 'delivered'); raise exception 'FALLO 4a: salto pending -> delivered';
  exception when raise_exception then assert sqlerrm like '%Transición no permitida%', 'FALLO 4a: ' || sqlerrm; end;
  perform public.transition_order_status(v_id, 'confirmed');
  perform public.transition_order_status(v_id, 'preparing');
  begin perform public.transition_order_status(v_id, 'cancelled'); raise exception 'FALLO 4b: cancelo en preparacion';
  exception when raise_exception then assert sqlerrm like '%Transición no permitida%', 'FALLO 4b: ' || sqlerrm; end;
  perform public.transition_order_status(v_id, 'ready');
  begin perform public.transition_order_status(v_id, 'delivered'); raise exception 'FALLO 4c: entrego sin pago';
  exception when raise_exception then assert sqlerrm like '%sin un pago activo%', 'FALLO 4c: ' || sqlerrm; end;

  -- 5. cobro: efectivo suficiente, un solo pago activo por pedido, luego entrega
  perform public.record_order_payment(v_id, 'cash', false, false, null, 1000);
  begin perform public.record_order_payment(v_id, 'cash', false, false, null, 1000); raise exception 'FALLO 5a: doble cobro';
  exception when unique_violation then null; end;
  perform public.transition_order_status(v_id, 'delivered');
  reset role;

  assert (select status from public.public_order_tracking where order_number = v_folio) = 'delivered',
         'FALLO 5b: el tracking publico no se sincronizo con el estado';
end $$;

rollback;
\echo 'OK  40_security_and_lifecycle'
