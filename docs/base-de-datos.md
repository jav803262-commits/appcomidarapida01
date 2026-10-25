# Base de datos (Supabase / PostgreSQL)

## Cómo se crea hoy

Todo el esquema está en `supabase/schema03.sql`. Es un «esquema canónico» que consolida lo que antes se planeaba como migraciones 001–009.

> ⚠️ **Es destructivo.** Empieza con `DROP TABLE ... CASCADE` sobre todas las tablas de la aplicación e inserta datos de demostración (categorías, productos y pedidos marcados `[DEMO]`). Úsalo **solo en una base de desarrollo**. No existe todavía una ruta de actualización segura para producción (ver `CHANGELOG.md`, «Pendiente»).

Para aplicarlo: Supabase Dashboard → SQL Editor → pegar y ejecutar el contenido de `schema03.sql`. No toca `auth.users`.

Después:

1. Crea un usuario en Authentication.
2. Asígnale el rol administrador con `npx tsx scripts/make-admin.ts` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`; edita el UUID dentro del script).
3. Entra en `/admin/menu` → Configuración y define las colonias de entrega y los datos del negocio. El esquema inicia con `ordering_enabled = false`: no se aceptan pedidos hasta activarlo.

## Tablas

| Tabla | Contenido | Notas |
|---|---|---|
| `settings` | Configuración del negocio | Una sola fila (índice único). Incluye horario, cobertura (`delivery_neighborhoods`), costos, tiempos estimados y datos de transferencia |
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
| `create_order(jsonb)` | `anon`, `authenticated` | Valida y crea el pedido de forma transaccional: negocio abierto, modalidad y pago habilitados, teléfono, cobertura, mínimo, disponibilidad, cantidades (1–50), extras y precios leídos de la base. Genera el folio y aplica idempotencia |
| `get_public_order_status(folio, últimos4)` | `anon`, `authenticated` | Devuelve solo folio, estado, fechas y minutos estimados |
| `transition_order_status(id, estado)` | Solo admin | Aplica la máquina de estados; exige pago activo para `delivered` |
| `record_order_payment(...)` | Solo admin | Registra el cobro de un pedido `ready` |
| `is_admin()` | `authenticated` | `app_metadata.role = 'admin'` |

Funciones internas (sin permisos para clientes): `business_is_open`, `validate_delivery_neighborhood`, `sync_public_order_tracking`, `set_updated_at`.

## Folio

6 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 símbolos; sin `I`, `O`, `0`, `1`). Se genera con `random()` de PostgreSQL —suficiente para ser legible y único, **no** para actuar como secreto. Por eso el seguimiento también exige los últimos 4 dígitos del teléfono.

## Permisos (RLS y grants)

- RLS está activo en las 8 tablas, y se revocan todos los privilegios a `anon`, `authenticated` y `public` antes de conceder lo necesario.
- Lectura pública (`anon`): `settings`, categorías activas, productos y extras disponibles.
- Administrador (`authenticated` + `is_admin()`): gestiona categorías, productos y extras; actualiza `settings`; **lee** pedidos, líneas y pagos.
- Nadie puede escribir directamente en `orders`, `order_items` ni `order_payments`: solo las funciones anteriores.

> ⚠️ Consecuencia de la lectura pública de `settings`: los datos de transferencia (`transfer_bank`, `transfer_holder`, `transfer_account`) son legibles por cualquiera. Ver `docs/seguridad.md`.
