# Base de datos (Supabase / PostgreSQL)

## Cómo se crea

El esquema vive en **migraciones versionadas** (`supabase/migrations/`), listas para Supabase CLI. Los datos de demostración están aparte, en `supabase/seed.sql`, y **nunca deben aplicarse en producción**.

| Archivo | Contenido |
|---|---|
| `migrations/20261024000000_baseline.sql` | Estructura completa (tablas, funciones, RLS, permisos) y una fila mínima de `settings` con pedidos desactivados |
| `seed.sql` | Solo desarrollo: configuración de ejemplo, catálogo `[DEMO]` y 2 pedidos de prueba |

Las migraciones **no borran datos**. Las futuras se añadirán como archivos nuevos con marca de tiempo; nunca se editan las ya aplicadas.

### Base nueva (desarrollo)

Con Supabase CLI: `supabase init` (una vez), `supabase link`, y después `supabase db reset` (aplica migraciones y seed; **borra la base de desarrollo**).

Sin CLI: en el SQL Editor, ejecuta en orden cada archivo de `supabase/migrations/` y, si quieres datos de ejemplo, `supabase/seed.sql`.

### Base nueva (producción)

Aplica solo las migraciones (`supabase db push`), **sin** `seed.sql`. Luego configura el negocio desde `/admin/menu`.

### Si tu base de desarrollo ya se creó con el antiguo `schema03.sql`

No ejecutes la migración base (fallaría por objetos existentes). Opciones: recrear la base con `supabase db reset`, o marcarla como aplicada con `supabase migration repair --status applied 20261024000000` y seguir con las migraciones siguientes. El archivo antiguo se conserva en `docs/archivo/schema03.sql`.

### Después de crear la base

1. Crea un usuario en Authentication.
2. Asígnale el rol administrador con `npm run make-admin -- <uuid-del-usuario>` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`, solo en tu equipo).
3. Entra en `/admin/menu` → Configuración y define las colonias de entrega y los datos del negocio. La base inicia con `ordering_enabled = false`: no se aceptan pedidos hasta activarlo.

### Pruebas locales del SQL

`supabase/tests/` contiene un entorno mínimo que imita Supabase (roles y `auth.jwt()`) para probar las migraciones en un PostgreSQL local. `supabase/tests/run_tests.sh` recrea la base, aplica migraciones y seed y ejecuta los archivos de `supabase/tests/sql/` (requiere PostgreSQL 16 local y permisos de root).

## Tablas

| Tabla | Contenido | Notas |
|---|---|---|
| `settings` | Configuración pública del negocio | Una sola fila (índice único). Horario, cobertura (`delivery_neighborhoods`), costos, tiempos estimados e interruptor `transfer_enabled` |
| `transfer_details` | Banco, titular y cuenta/CLABE | **Privada** (solo admin). Una sola fila. Un trigger impide activar la transferencia sin cuenta y borrar la cuenta mientras esté activa |
| `categories` | Categorías del menú | `slug` único, `active` |
| `products` | Productos | `price`, `image_url`, `emoji`, `available` |
| `product_extras` | Extras por producto | Se eliminan con el producto |
| `orders` | Pedido completo (privado) | Folio único de 6 caracteres, `client_request_id` único, restricciones de coherencia de importes y pago |
| `order_items` | Líneas del pedido | Guarda **copia** del nombre y precio al momento de la compra |
| `order_payments` | Libro de pagos | Un único pago `active` por pedido; estados `active` / `reversed` |
| `public_order_tracking` | Datos mínimos para el seguimiento | Se sincroniza con `orders` mediante trigger |

## Funciones

| Función | Quién puede ejecutarla | Qué hace |
|---|---|---|
| `create_order(jsonb)` | `anon`, `authenticated` | Valida y crea el pedido de forma transaccional: negocio abierto, modalidad y pago habilitados, teléfono, cobertura, mínimo, disponibilidad, cantidades (1–50), extras y precios leídos de la base. Genera el folio, aplica idempotencia y, si el pago es transferencia, devuelve los datos bancarios |
| `get_public_order_status(folio, últimos4)` | `anon`, `authenticated` | Devuelve solo folio, estado, fechas y minutos estimados |
| `transition_order_status(id, estado)` | Solo admin | Aplica la máquina de estados; exige pago activo para `delivered` |
| `record_order_payment(...)` | Solo admin | Registra el cobro de un pedido `ready` |
| `is_admin()` | `authenticated` | `app_metadata.role = 'admin'` |

Funciones internas (sin permisos para clientes): `order_transfer_details`, `enforce_transfer_enabled_has_account`, `enforce_account_while_transfer_enabled`, `business_is_open`, `validate_delivery_neighborhood`, `sync_public_order_tracking`, `set_updated_at`.

## Folio

6 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 símbolos; sin `I`, `O`, `0`, `1`). Se genera con `random()` de PostgreSQL —suficiente para ser legible y único, **no** para actuar como secreto. Por eso el seguimiento también exige los últimos 4 dígitos del teléfono.

## Permisos (RLS y grants)

- RLS está activo en las 8 tablas, y se revocan todos los privilegios a `anon`, `authenticated` y `public` antes de conceder lo necesario.
- Lectura pública (`anon`): `settings` (sin datos bancarios), categorías activas, productos y extras disponibles.
- Administrador (`authenticated` + `is_admin()`): gestiona categorías, productos y extras; actualiza `settings` y `transfer_details`; **lee** pedidos, líneas y pagos.
- Nadie puede escribir directamente en `orders`, `order_items` ni `order_payments`: solo las funciones anteriores.
