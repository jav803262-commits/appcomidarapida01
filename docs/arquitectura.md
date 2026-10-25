# Arquitectura

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx                 → renderiza <MenuApp />
│   ├── pedido/consultar/        → seguimiento público del pedido
│   ├── admin/                   → pedidos (page), cocina, caja, menu
│   └── api/
│       ├── menu/route.ts        → GET: catálogo + configuración
│       ├── orders/route.ts      → POST: crea el pedido
│       └── orders/track/route.ts→ POST: consulta de estado
├── components/                  → cart/, menu/, order/, layout/, MenuApp.tsx
├── context/CartContext.tsx      → estado del carrito (localStorage)
├── lib/
│   ├── supabase/browser.ts      → cliente para el navegador (Auth, admin)
│   ├── supabase/server.ts       → cliente para las rutas API
│   ├── admin-session.ts         → única definición de «sesión de administrador» en la interfaz
│   ├── order.ts                 → cálculo de importes (solo para mostrar)
│   ├── order-request.ts         → identificador de idempotencia (sessionStorage)
│   ├── ids.ts                   → generador de UUID en el cliente
│   └── whatsapp.ts              → mensaje y enlace de WhatsApp
└── types/index.ts               → tipos compartidos
supabase/migrations/             → esquema versionado (Supabase CLI)
supabase/seed.sql                → datos de demostración (solo desarrollo)
supabase/tests/                  → entorno local para probar el SQL
scripts/make-admin.ts            → asigna el rol admin a un usuario
```

## Principio de diseño

La **base de datos es la fuente de verdad** de precios, disponibilidad, horarios y reglas de negocio. El navegador calcula importes solo para mostrarlos; al crear un pedido envía únicamente IDs y cantidades, y la función SQL `create_order` recalcula todo.

Las dos claves de Supabase usadas son la **publishable** (pública). No existe un cliente con `service_role` en la aplicación web.

## Flujo del cliente

1. `/api/menu` devuelve configuración, categorías y productos disponibles. `orderingEnabled` ya incluye la comprobación de horario.
2. El carrito se guarda en `localStorage` (clave `food-menu-cart`), con un máximo de 50 unidades por línea.
3. En `OrderForm` el cliente captura nombre, **teléfono (obligatorio, 10 dígitos)**, modalidad (recoger o domicilio), colonia (si es domicilio, elegida de la lista de cobertura), método de pago (efectivo o transferencia) y notas.
4. Se envía `POST /api/orders` con un `clientRequestId` (UUID). Si se superan los límites anti-abuso, la API responde **429** con un mensaje para el cliente. Si la solicitud se repite con los mismos datos, la base devuelve el mismo pedido (`duplicate: true`) en lugar de crear otro.
5. El pedido registrado muestra el **folio** de 6 caracteres. En pedidos por transferencia, la respuesta de la API incluye también los datos bancarios, que no forman parte del catálogo público. El carrito se vacía y el comprobante se guarda en `sessionStorage` (`food-menu-active-order`) para sobrevivir a una recarga. El botón «Terminar» lo elimina.
6. El botón de WhatsApp abre un mensaje con **solo el folio y el nombre**; el detalle del pedido no se envía por ese canal.
7. En transferencias, el cliente debe adjuntar el comprobante manualmente por WhatsApp. La aplicación **no verifica depósitos**.

## Seguimiento público

`/pedido/consultar` pide el folio y los **últimos 4 dígitos del teléfono**. La ruta `/api/orders/track` llama a la función SQL `get_public_order_status`, que solo devuelve: folio, estado, fecha de registro, minutos estimados y fecha de actualización. Mientras se muestra un resultado, la página se actualiza sola cada **30 s**.

Estados: `pending`, `confirmed`, `preparing`, `ready`, `delivered`, `cancelled`.

## Paneles de administración

El acceso requiere sesión de Supabase Auth con `app_metadata.role = "admin"`. La comprobación en la interfaz vive en un solo lugar (`src/lib/admin-session.ts`) y es solo de comodidad; **la seguridad real la imponen RLS y las funciones SQL** (`is_admin()`).

| Panel | Función | Actualización |
|---|---|---|
| `/admin` | Lista de pedidos y cambio de estado (`transition_order_status`) | Cada 15 s |
| `/admin/cocina` | Pestañas pendientes / preparando / listos. Avanza `pending`/`confirmed` → `preparing` → `ready` | Cada 12 s |
| `/admin/caja` | Registra el cobro (`record_order_payment`) y marca como entregado | Cada 15 s |
| `/admin/menu` | CRUD de categorías, productos, extras y configuración; subida de fotos | — |

Reglas relevantes de caja:

- Solo se cobra un pedido en estado `ready`.
- Un pedido admite un único pago activo.
- Efectivo: se registra el monto recibido (≥ total) y se calcula el cambio.
- Transferencia: se exige confirmar que el dinero llegó a la cuenta y capturar una referencia.
- No se puede marcar `delivered` sin un pago activo.

## Transiciones de estado permitidas

```
pending ──► confirmed ──► preparing ──► ready ──► delivered
   │            │
   └────────────┴──► cancelled
```

## Datos del cliente en el navegador

| Clave | Almacén | Contenido |
|---|---|---|
| `food-menu-cart` | localStorage | Líneas del carrito |
| `food-menu-pending-order-request` | sessionStorage | UUID de idempotencia y huella del payload |
| `food-menu-active-order` | sessionStorage | Comprobante del pedido recién creado |
