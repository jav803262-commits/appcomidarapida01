-- ============================================================================
-- DATOS DE DEMOSTRACIÓN — SOLO DESARROLLO. NO aplicar en producción.
-- Supabase CLI lo ejecuta tras las migraciones en `supabase db reset`.
-- Valores ficticios; reemplaza todo antes de recibir pedidos reales.
-- ============================================================================

delete from public.settings;

insert into public.settings (
  business_name,
  description,
  phone,
  whatsapp,
  address,
  currency,
  ordering_enabled,
  delivery_enabled,
  pickup_enabled,
  delivery_fee,
  min_order_amount,
  cash_enabled,
  transfer_enabled,
  delivery_eta_minutes,
  pickup_eta_minutes,
  business_hours_enabled,
  business_timezone,
  schedule,
  delivery_neighborhoods
) values (
  'Toritos Burger',
  'DATOS DE DESARROLLO: reemplazar los ejemplos antes de producción.',
  '0000000000',
  '0000000000',
  'Dirección de prueba — sustituir antes de producción',
  'MXN',
  false,
  false,
  true,
  0,
  0,
  true,
  false,
  45,
  20,
  false,
  'America/Mexico_City',
  '{
    "monday": {"enabled": false, "open": "12:00", "close": "22:00"},
    "tuesday": {"enabled": false, "open": "12:00", "close": "22:00"},
    "wednesday": {"enabled": false, "open": "12:00", "close": "22:00"},
    "thursday": {"enabled": false, "open": "12:00", "close": "22:00"},
    "friday": {"enabled": false, "open": "12:00", "close": "23:00"},
    "saturday": {"enabled": false, "open": "12:00", "close": "23:00"},
    "sunday": {"enabled": false, "open": "12:00", "close": "21:00"}
  }'::jsonb,
  '[]'::jsonb
);

update public.transfer_details
set bank = 'BANCO_DE_PRUEBA_NO_REAL',
    holder = 'TITULAR_DE_PRUEBA_NO_REAL',
    account = 'CUENTA_DE_PRUEBA_NO_REAL';

-- Catálogo de ejemplo para la interfaz. Precios y nombres son de prueba.
insert into public.categories (name, slug, sort_order, active) values
  ('Hamburguesas [DEMO]', 'demo-hamburguesas', 1, true),
  ('Papas y snacks [DEMO]', 'demo-snacks', 2, true),
  ('Bebidas [DEMO]', 'demo-bebidas', 3, true);

insert into public.products (category_id, name, description, price, emoji, available, sort_order)
select c.id, 'Hamburguesa clásica [DEMO]', 'Producto de ejemplo; no representa el menú real.', 89.00, '🍔', true, 1
from public.categories c where c.slug = 'demo-hamburguesas';

insert into public.products (category_id, name, description, price, emoji, available, sort_order)
select c.id, 'Hamburguesa doble [DEMO]', 'Producto de ejemplo; no representa el menú real.', 119.00, '🍔', true, 2
from public.categories c where c.slug = 'demo-hamburguesas';

insert into public.products (category_id, name, description, price, emoji, available, sort_order)
select c.id, 'Papas a la francesa [DEMO]', 'Producto de ejemplo; no representa el menú real.', 39.00, '🍟', true, 1
from public.categories c where c.slug = 'demo-snacks';

insert into public.products (category_id, name, description, price, emoji, available, sort_order)
select c.id, 'Refresco en lata [DEMO]', 'Producto de ejemplo; no representa el menú real.', 25.00, '🥤', true, 1
from public.categories c where c.slug = 'demo-bebidas';

-- Pedidos de prueba: uno pendiente para recorrer cocina y otro listo para caja.
-- No se crean pagos activos; podrás probar el cobro de demostración en caja.
insert into public.orders (
  order_number, client_request_id, request_fingerprint,
  customer_name, customer_phone, order_type, payment_method, cash_amount,
  subtotal, delivery_fee, total, address, notes, status
) values
  ('BURGA3', '00000000-0000-4000-8000-000000000041', md5('toritos-demo-pending'),
   'DEMO - Cocina', '0000000000', 'pickup', 'cash', 100.00,
   89.00, 0, 89.00, null,
   'PEDIDO DE PRUEBA. No corresponde a un cliente real.', 'pending'),
  ('BURGA2', '00000000-0000-4000-8000-000000000042', md5('toritos-demo-ready'),
   'DEMO - Caja', '0000000000', 'pickup', 'cash', 150.00,
   128.00, 0, 128.00, null,
   'PEDIDO DE PRUEBA PARA COBRO. No corresponde a una venta real.', 'ready');

insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, extras, subtotal)
select o.id, p.id, p.name, 89.00, 1, '[]'::jsonb, 89.00
from public.orders o
join public.products p on p.name = 'Hamburguesa clásica [DEMO]'
where o.order_number = 'BURGA3';

insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, extras, subtotal)
select o.id, p.id, p.name, 89.00, 1, '[]'::jsonb, 89.00
from public.orders o
join public.products p on p.name = 'Hamburguesa clásica [DEMO]'
where o.order_number = 'BURGA2';

insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, extras, subtotal)
select o.id, p.id, p.name, 39.00, 1, '[]'::jsonb, 39.00
from public.orders o
join public.products p on p.name = 'Papas a la francesa [DEMO]'
where o.order_number = 'BURGA2';

