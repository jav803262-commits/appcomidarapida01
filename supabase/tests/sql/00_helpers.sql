-- Utilidades de prueba (solo entorno local; no es parte de las migraciones).
create schema if not exists t;

-- Cambia de rol como lo haría PostgREST: rol + claims del JWT (válido hasta fin de transacción).
create or replace function t.use_role(p_role text, p_claims jsonb default '{}'::jsonb)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
  execute format('set local role %I', p_role);
end $$;

create or replace function t.admin_claims() returns jsonb language sql as $$
  select '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}'::jsonb $$;

create or replace function t.user_claims() returns jsonb language sql as $$
  select '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"customer"}}'::jsonb $$;

-- Abre el negocio para poder crear pedidos (la semilla lo deja cerrado).
create or replace function t.open_business() returns void language sql as $$
  update public.settings
  set ordering_enabled = true, pickup_enabled = true, delivery_enabled = false,
      cash_enabled = true, transfer_enabled = true, business_hours_enabled = false,
      min_order_amount = 0; $$;

create or replace function t.product_id(p_name text default 'Platillo clásico [DEMO]')
returns bigint language sql as $$ select id from public.products where name = p_name $$;

-- Payload válido de recoger en local.
create or replace function t.payload(
  p_method text default 'cash',
  p_request uuid default gen_random_uuid(),
  p_phone text default '5512345678',
  p_quantity int default 1
) returns jsonb language sql as $$
  select jsonb_build_object(
    'clientRequestId', p_request,
    'customer', jsonb_build_object('name', 'Cliente Prueba', 'phone', p_phone),
    'orderType', 'pickup',
    'paymentMethod', p_method,
    'cashAmount', case when p_method = 'cash' then 1000 end,
    'items', jsonb_build_array(jsonb_build_object('productId', t.product_id(), 'quantity', p_quantity, 'extraIds', '[]'::jsonb))
  ) $$;

-- Las utilidades pueden invocarse también mientras el rol activo es anon/authenticated.
grant usage on schema t to public;
grant execute on all functions in schema t to public;
