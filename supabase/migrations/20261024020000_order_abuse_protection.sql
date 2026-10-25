-- ============================================================================
-- Fase 5 — Protección anti-abuso en la creación de pedidos
-- ----------------------------------------------------------------------------
-- Problema: nada limitaba la frecuencia de pedidos. create_order es ejecutable por
-- `anon`, así que cualquiera con la clave pública podía llenar la cocina de
-- pedidos falsos, incluso sin pasar por /api/orders.
-- Solución (en la base, donde no se puede esquivar):
--   1. Máximo de pedidos EN PROCESO por teléfono (por defecto 3).
--   2. Tope de pedidos pendientes sin atender en todo el negocio (por defecto 30).
-- Ambos valores se ajustan en `settings`. Al superarlos se responde SQLSTATE PT429
-- (PostgREST lo traduce a HTTP 429). Los reintentos idempotentes NO se ven afectados.
-- ============================================================================

alter table public.settings
  add column max_active_orders_per_phone integer not null default 3
    check (max_active_orders_per_phone between 1 and 20),
  add column max_pending_orders integer not null default 30
    check (max_pending_orders between 1 and 500);

comment on column public.settings.max_active_orders_per_phone is
  'Pedidos en proceso (pending, confirmed, preparing, ready) permitidos por teléfono.';
comment on column public.settings.max_pending_orders is
  'Tope de pedidos en estado pending (sin atender) para aceptar nuevos pedidos.';

create index idx_orders_active_by_phone on public.orders (customer_phone)
  where status in ('pending', 'confirmed', 'preparing', 'ready');

create or replace function public.create_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_active_for_phone integer;
  v_pending_total integer;
  v_settings public.settings%rowtype;
  v_customer jsonb;
  v_items jsonb;
  v_item jsonb;
  v_snapshot jsonb;
  v_snapshots jsonb := '[]'::jsonb;
  v_extra_text text;
  v_extra_id bigint;
  v_seen_extra_ids bigint[];
  v_product_id bigint;
  v_product public.products%rowtype;
  v_extra public.product_extras%rowtype;
  v_quantity integer;
  v_order_type text;
  v_payment_method text;
  v_cash_amount numeric(10,2);
  v_subtotal numeric(14,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_total numeric(14,2) := 0;
  v_item_subtotal numeric(14,2);
  v_unit_price numeric(10,2);
  v_extras jsonb;
  v_address jsonb;
  v_neighborhood text;
  v_name text;
  v_phone text;
  v_notes text;
  v_allowed_neighborhoods jsonb;
  v_request_id_text text;
  v_client_request_id uuid;
  v_request_fingerprint text;
  v_fingerprint_payload jsonb;
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_created_at timestamptz;
  v_constraint_name text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Solicitud de pedido inválida.';
  end if;

  v_customer := coalesce(p_payload -> 'customer', '{}'::jsonb);
  if jsonb_typeof(v_customer) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Los datos del cliente no son válidos.';
  end if;

  v_name := nullif(btrim(coalesce(v_customer ->> 'name', '')), '');
  if v_name is null or length(v_name) > 120 then
    raise exception using errcode = 'P0001', message = 'Escribe un nombre válido de hasta 120 caracteres.';
  end if;

  v_phone := regexp_replace(coalesce(v_customer ->> 'phone', ''), '[^0-9]', '', 'g');
  if length(v_phone) <> 10 then
    raise exception using errcode = 'P0001', message = 'Escribe un teléfono válido de 10 dígitos.';
  end if;

  v_request_id_text := nullif(btrim(coalesce(p_payload ->> 'clientRequestId', '')), '');
  if v_request_id_text is null then
    raise exception using errcode = 'P0001', message = 'Falta el identificador de la solicitud. Intenta enviar el pedido nuevamente.';
  end if;
  begin
    v_client_request_id := v_request_id_text::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'El identificador de la solicitud no es válido.';
  end;

  -- La huella detecta la reutilización accidental de una misma clave con
  -- contenido distinto. No se utiliza como mecanismo de autenticación.
  v_fingerprint_payload := jsonb_set(
    p_payload,
    '{customer}',
    v_customer || jsonb_build_object('name', v_name, 'phone', v_phone),
    true
  ) - 'clientRequestId';
  v_request_fingerprint := md5(v_fingerprint_payload::text);

  -- Serializa reintentos simultáneos con la misma clave de idempotencia.
  perform pg_advisory_xact_lock(hashtextextended(v_client_request_id::text, 0));

  select * into v_existing
  from public.orders o
  where o.client_request_id = v_client_request_id;

  if found then
    if v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception using errcode = 'P0001',
        message = 'Este identificador ya se usó con otros datos. Inicia una nueva solicitud.';
    end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'orderNumber', v_existing.order_number,
      'status', v_existing.status,
      'subtotal', v_existing.subtotal,
      'deliveryFee', v_existing.delivery_fee,
      'total', v_existing.total,
      'createdAt', v_existing.created_at,
      'transfer', public.order_transfer_details(v_existing.payment_method),
      'duplicate', true
    );
  end if;

  select * into v_settings
  from public.settings s
  order by s.id
  limit 1
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'El negocio no está configurado.';
  end if;
  if not v_settings.ordering_enabled then
    raise exception using errcode = 'P0001', message = 'Los pedidos están pausados temporalmente.';
  end if;
  if not public.business_is_open(v_settings) then
    raise exception using errcode = 'P0001', message = 'El negocio está cerrado en este horario.';
  end if;

  -- Protección anti-abuso. Vive aquí y no en la API porque create_order puede invocarse
  -- directamente con la clave pública de Supabase, sin pasar por Next.js.
  -- El bloqueo serializa los pedidos concurrentes de un mismo teléfono para que el
  -- conteo no se eluda con solicitudes simultáneas.
  perform pg_advisory_xact_lock(hashtextextended('order_phone:' || v_phone, 0));

  select count(*) into v_active_for_phone
  from public.orders o
  where o.customer_phone = v_phone
    and o.status in ('pending', 'confirmed', 'preparing', 'ready');
  if v_active_for_phone >= v_settings.max_active_orders_per_phone then
    raise exception using errcode = 'PT429',
      message = 'Ya tienes pedidos en proceso con este teléfono. Espera a que se entreguen o consulta su estado.';
  end if;

  select count(*) into v_pending_total from public.orders o where o.status = 'pending';
  if v_pending_total >= v_settings.max_pending_orders then
    raise exception using errcode = 'PT429',
      message = 'Estamos recibiendo muchos pedidos en este momento. Inténtalo de nuevo en unos minutos.';
  end if;

  v_items := p_payload -> 'items';
  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'La lista de productos no es válida.';
  end if;
  if jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 100 then
    raise exception using errcode = 'P0001', message = 'El pedido debe incluir entre 1 y 100 líneas de productos.';
  end if;

  v_order_type := coalesce(p_payload ->> 'orderType', '');
  if v_order_type not in ('pickup', 'delivery') then
    raise exception using errcode = 'P0001', message = 'Tipo de pedido inválido.';
  end if;
  if v_order_type = 'delivery' and not v_settings.delivery_enabled then
    raise exception using errcode = 'P0001', message = 'El servicio a domicilio no está disponible.';
  end if;
  if v_order_type = 'pickup' and not v_settings.pickup_enabled then
    raise exception using errcode = 'P0001', message = 'La recogida en local no está disponible.';
  end if;

  v_address := p_payload -> 'address';
  if v_order_type = 'delivery' then
    if v_address is null or jsonb_typeof(v_address) <> 'object' then
      raise exception using errcode = 'P0001', message = 'La dirección de entrega está incompleta.';
    end if;
    if nullif(btrim(coalesce(v_address ->> 'street', '')), '') is null
       or nullif(btrim(coalesce(v_address ->> 'neighborhood', '')), '') is null then
      raise exception using errcode = 'P0001', message = 'La dirección de entrega está incompleta.';
    end if;
    if length(btrim(v_address ->> 'street')) > 200
       or length(btrim(v_address ->> 'neighborhood')) > 120
       or length(btrim(coalesce(v_address ->> 'reference', ''))) > 300 then
      raise exception using errcode = 'P0001', message = 'La dirección excede la longitud permitida.';
    end if;

    v_neighborhood := btrim(v_address ->> 'neighborhood');
    v_allowed_neighborhoods := v_settings.delivery_neighborhoods;
    if v_allowed_neighborhoods is null or jsonb_typeof(v_allowed_neighborhoods) <> 'array' then
      raise exception using errcode = 'P0001',
        message = 'La cobertura de entrega no está configurada correctamente.';
    end if;
    if jsonb_array_length(v_allowed_neighborhoods) = 0 or not exists (
      select 1 from jsonb_array_elements_text(v_allowed_neighborhoods) as allowed(name)
      where lower(btrim(allowed.name)) = lower(v_neighborhood)
    ) then
      raise exception using errcode = 'P0001',
        message = 'No realizamos entregas en esa colonia. Selecciona una colonia disponible.';
    end if;

    v_address := jsonb_build_object(
      'street', btrim(v_address ->> 'street'),
      'neighborhood', v_neighborhood,
      'reference', nullif(btrim(coalesce(v_address ->> 'reference', '')), '')
    );
  else
    v_address := null;
  end if;

  v_payment_method := coalesce(p_payload ->> 'paymentMethod', '');
  if v_payment_method not in ('cash', 'transfer') then
    raise exception using errcode = 'P0001', message = 'Método de pago inválido.';
  end if;
  if v_payment_method = 'cash' and not v_settings.cash_enabled then
    raise exception using errcode = 'P0001', message = 'El pago en efectivo no está disponible.';
  end if;
  if v_payment_method = 'transfer'
     and (not v_settings.transfer_enabled or public.order_transfer_details('transfer') is null) then
    raise exception using errcode = 'P0001', message = 'La transferencia no está disponible.';
  end if;

  v_cash_amount := null;
  if v_payment_method = 'cash' then
    if nullif(btrim(coalesce(p_payload ->> 'cashAmount', '')), '') is null then
      raise exception using errcode = 'P0001', message = 'Indica cuánto efectivo entregarás.';
    end if;
    begin
      v_cash_amount := (p_payload ->> 'cashAmount')::numeric(10,2);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'El importe de efectivo no es válido.';
    end;
    if v_cash_amount < 0 then
      raise exception using errcode = 'P0001', message = 'El efectivo recibido no puede ser negativo.';
    end if;
  end if;

  v_notes := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  if length(coalesce(v_notes, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'Las notas no pueden superar 1000 caracteres.';
  end if;

  -- Captura los precios/nombres/extras una sola vez. FOR SHARE evita que una
  -- edición concurrente cambie esos valores antes de registrar el snapshot.
  for v_item in select value from jsonb_array_elements(v_items) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = 'P0001', message = 'Una línea del pedido no es válida.';
    end if;

    if coalesce(v_item ->> 'productId', '') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = 'P0001', message = 'El identificador de un producto no es válido.';
    end if;
    begin
      v_product_id := (v_item ->> 'productId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'El identificador de un producto no es válido.';
    end;

    begin
      select p.* into strict v_product
      from public.products p
      join public.categories c on c.id = p.category_id
      where p.id = v_product_id
        and p.available = true
        and c.active = true
      -- Evita que el producto o su categoría se desactiven/cambien mientras
      -- se valida y se guarda el pedido.
      for share of p, c;
    exception when no_data_found then
      raise exception using errcode = 'P0001', message = 'Uno de los productos no está disponible o su categoría está inactiva.';
    end;

    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'La cantidad de un producto no es válida.';
    end if;
    begin
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'La cantidad de un producto no es válida.';
    end;
    if v_quantity < 1 or v_quantity > 50 then
      raise exception using errcode = 'P0001', message = 'La cantidad de un producto debe estar entre 1 y 50.';
    end if;

    if v_item ? 'extraIds' and jsonb_typeof(v_item -> 'extraIds') <> 'array' then
      raise exception using errcode = 'P0001', message = 'Los extras de un producto no son válidos.';
    end if;
    if v_item ? 'extraIds' and jsonb_array_length(v_item -> 'extraIds') > 20 then
      raise exception using errcode = 'P0001', message = 'No puedes seleccionar más de 20 extras por producto.';
    end if;

    v_unit_price := v_product.price;
    v_item_subtotal := v_unit_price * v_quantity;
    v_extras := '[]'::jsonb;
    v_seen_extra_ids := array[]::bigint[];

    for v_extra_text in
      select value
      from jsonb_array_elements_text(coalesce(v_item -> 'extraIds', '[]'::jsonb)) as extras(value)
    loop
      if v_extra_text !~ '^[1-9][0-9]*$' then
        raise exception using errcode = 'P0001', message = 'El identificador de un extra no es válido.';
      end if;
      begin
        v_extra_id := v_extra_text::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'P0001', message = 'El identificador de un extra no es válido.';
      end;
      if v_extra_id = any(v_seen_extra_ids) then
        raise exception using errcode = 'P0001', message = 'No repitas el mismo extra en una línea del pedido.';
      end if;
      v_seen_extra_ids := array_append(v_seen_extra_ids, v_extra_id);

      begin
        select e.* into strict v_extra
        from public.product_extras e
        where e.id = v_extra_id
          and e.product_id = v_product.id
          and e.available = true
        for share;
      exception when no_data_found then
        raise exception using errcode = 'P0001', message = 'Uno de los extras seleccionados ya no está disponible.';
      end;

      v_item_subtotal := v_item_subtotal + (v_extra.price * v_quantity);
      v_extras := v_extras || jsonb_build_array(
        jsonb_build_object('id', v_extra.id, 'name', v_extra.name, 'price', v_extra.price)
      );
    end loop;

    v_subtotal := v_subtotal + v_item_subtotal;
    if v_subtotal > 99999999.99 then
      raise exception using errcode = 'P0001', message = 'El importe del pedido excede el máximo permitido.';
    end if;

    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'productName', v_product.name,
      'unitPrice', v_unit_price,
      'quantity', v_quantity,
      'extras', v_extras,
      'subtotal', v_item_subtotal
    ));
  end loop;

  if v_subtotal < v_settings.min_order_amount then
    raise exception using errcode = 'P0001', message = 'El pedido no alcanza el mínimo de compra.';
  end if;
  if v_order_type = 'delivery' then
    v_delivery_fee := v_settings.delivery_fee;
  end if;
  v_total := v_subtotal + v_delivery_fee;
  if v_total <= 0 then
    raise exception using errcode = 'P0001', message = 'No se aceptan pedidos con total cero.';
  end if;
  if v_total > 99999999.99 then
    raise exception using errcode = 'P0001', message = 'El importe total del pedido excede el máximo permitido.';
  end if;
  if v_payment_method = 'cash' and v_cash_amount < v_total then
    raise exception using errcode = 'P0001', message = 'El efectivo indicado es menor que el total del pedido.';
  end if;

  -- Genera un folio legible de 6 caracteres; reintenta colisiones improbables.
  <<folio_loop>>
  loop
    select string_agg(
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1),
      ''
    )
    into v_order_number
    from generate_series(1, 6);

    begin
      insert into public.orders (
        order_number, client_request_id, request_fingerprint,
        customer_name, customer_phone, order_type, payment_method, cash_amount,
        subtotal, delivery_fee, total, address, notes, status
      ) values (
        v_order_number, v_client_request_id, v_request_fingerprint,
        v_name, v_phone, v_order_type, v_payment_method, v_cash_amount,
        v_subtotal, v_delivery_fee, v_total, v_address, v_notes, 'pending'
      )
      returning id, created_at into v_order_id, v_created_at;
    exception when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name in ('orders_order_number_key', 'public_order_tracking_order_number_key') then
        continue folio_loop;
      elsif v_constraint_name = 'orders_client_request_id_key' then
        select * into v_existing from public.orders o
        where o.client_request_id = v_client_request_id;
        if found and v_existing.request_fingerprint = v_request_fingerprint then
          return jsonb_build_object(
            'id', v_existing.id,
            'orderNumber', v_existing.order_number,
            'status', v_existing.status,
            'subtotal', v_existing.subtotal,
            'deliveryFee', v_existing.delivery_fee,
            'total', v_existing.total,
            'createdAt', v_existing.created_at,
            'transfer', public.order_transfer_details(v_existing.payment_method),
            'duplicate', true
          );
        end if;
        raise exception using errcode = 'P0001',
          message = 'Este identificador ya se usó con otros datos. Inicia una nueva solicitud.';
      else
        raise;
      end if;
    end;
    exit folio_loop;
  end loop;

  -- Las líneas usan exactamente el snapshot ya calculado, no releen el catálogo.
  for v_snapshot in select value from jsonb_array_elements(v_snapshots) as snap(value)
  loop
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, extras, subtotal
    ) values (
      v_order_id,
      (v_snapshot ->> 'productId')::bigint,
      v_snapshot ->> 'productName',
      (v_snapshot ->> 'unitPrice')::numeric(10,2),
      (v_snapshot ->> 'quantity')::integer,
      v_snapshot -> 'extras',
      (v_snapshot ->> 'subtotal')::numeric(10,2)
    );
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'orderNumber', v_order_number,
    'status', 'pending',
    'subtotal', v_subtotal,
    'deliveryFee', v_delivery_fee,
    'total', v_total,
    'createdAt', v_created_at,
    'transfer', public.order_transfer_details(v_payment_method),
    'duplicate', false
  );
end;
$function$;
