-- Fase 4: los datos bancarios no son públicos y solo se revelan al crear un pedido por transferencia.
begin;
select t.open_business();

do $$
declare v_cnt int; v_res jsonb; v_dup jsonb; v_req uuid := gen_random_uuid(); v_payload jsonb;
begin
  -- 1. anon no puede leer la tabla privada ni las columnas antiguas de settings
  perform t.use_role('anon');
  begin
    perform 1 from public.transfer_details;
    raise exception 'FALLO 1a: anon pudo leer transfer_details';
  exception when insufficient_privilege then null; end;
  begin
    perform transfer_account from public.settings;
    raise exception 'FALLO 1b: settings aun expone transfer_account';
  exception when undefined_column then null; end;
  reset role;

  -- 2. un usuario autenticado que no es admin no ve filas
  perform t.use_role('authenticated', t.user_claims());
  select count(*) into v_cnt from public.transfer_details;
  assert v_cnt = 0, 'FALLO 2: un usuario normal pudo leer los datos bancarios';
  reset role;

  -- 3. el admin sí los lee
  perform t.use_role('authenticated', t.admin_claims());
  select count(*) into v_cnt from public.transfer_details;
  assert v_cnt = 1, 'FALLO 3: el admin no puede leer los datos bancarios';
  reset role;

  -- 4. pedido por transferencia: la respuesta incluye los datos
  v_payload := t.payload('transfer', v_req);
  perform t.use_role('anon');
  v_res := public.create_order(v_payload);
  reset role;
  assert v_res #>> '{transfer,account}' = 'CUENTA_DE_PRUEBA_NO_REAL', 'FALLO 4: la respuesta no trae la cuenta';
  assert (v_res ->> 'duplicate')::boolean = false, 'FALLO 4b: no deberia ser duplicado';

  -- 5. reintento idempotente: también devuelve los datos
  perform t.use_role('anon');
  v_dup := public.create_order(v_payload);
  reset role;
  assert (v_dup ->> 'duplicate')::boolean = true, 'FALLO 5a: el reintento no fue detectado';
  assert v_dup #>> '{transfer,account}' = 'CUENTA_DE_PRUEBA_NO_REAL', 'FALLO 5b: el reintento no trae la cuenta';
  assert v_dup ->> 'orderNumber' = v_res ->> 'orderNumber', 'FALLO 5c: folio distinto en el reintento';

  -- 6. pedido en efectivo: sin datos bancarios
  perform t.use_role('anon');
  v_res := public.create_order(t.payload('cash'));
  reset role;
  assert jsonb_typeof(v_res -> 'transfer') = 'null', 'FALLO 6: un pedido en efectivo recibio datos bancarios';
end $$;

-- 7. con la transferencia desactivada, create_order la rechaza
do $$
begin
  update public.settings set transfer_enabled = false;
  perform t.use_role('anon');
  begin
    perform public.create_order(t.payload('transfer'));
    raise exception 'FALLO 7: se acepto una transferencia deshabilitada';
  exception when raise_exception then
    assert sqlerrm like '%transferencia no está disponible%', 'FALLO 7: mensaje inesperado: ' || sqlerrm;
  end;
  reset role;
end $$;

-- 8. invariantes: no se activa sin cuenta ni se borra la cuenta mientras esta activa
do $$
begin
  update public.transfer_details set account = null;           -- permitido: esta desactivada
  begin
    update public.settings set transfer_enabled = true;
    raise exception 'FALLO 8a: se activo la transferencia sin cuenta';
  exception when raise_exception then
    assert sqlerrm like '%captura primero la cuenta%', 'FALLO 8a: mensaje inesperado: ' || sqlerrm;
  end;
  update public.transfer_details set account = '012345678901234567';
  update public.settings set transfer_enabled = true;          -- ahora si
  begin
    update public.transfer_details set account = '  ';
    raise exception 'FALLO 8b: se borro la cuenta con la transferencia activa';
  exception when raise_exception then
    assert sqlerrm like '%Desactiva primero%', 'FALLO 8b: mensaje inesperado: ' || sqlerrm;
  end;
end $$;

rollback;
\echo 'OK  10_transfer_privacy'
