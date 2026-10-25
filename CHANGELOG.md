# Historial de cambios

Reconstruido a partir de los README originales (archivados en `docs/archivo/`) y contrastado con el código actual. Las fechas no se conservaban en esos documentos.

## V3.2.0

- El teléfono pasa a ser **obligatorio** (10 dígitos), validado en la API y en la base de datos.
- El seguimiento exige el folio **y** los últimos 4 dígitos del teléfono.
- La consulta se actualiza sola cada 30 s y distingue los estados con iconos y colores.
- El mensaje de WhatsApp usa saltos de línea reales.
- La base incorpora el libro de pagos (`order_payments`), `record_order_payment` y `transition_order_status`; caja registra cobros y exige un pago activo para entregar.

## V3.1

- Consulta pública del estado en `/pedido/consultar`.
- Tabla `public_order_tracking` con trigger de sincronización y función `get_public_order_status`, sin lectura directa.
- Límite básico de intentos en el endpoint de seguimiento (en memoria, por instancia).
- Fotografías de productos en Supabase Storage (`product-images`).
- Pantalla de confirmación que conserva el folio.

## V3.0

- Formulario de pedido más compacto; los datos bancarios aparecen en la pantalla final.
- Cobertura de entrega por colonias, administrada desde `/admin/menu` → Configuración, validada en la API y con trigger en PostgreSQL.

## V2.9

- Tras registrar el pedido se oculta el carrito y no se puede volver al formulario.
- El comprobante se conserva en `sessionStorage` y se recupera al recargar sin crear otro pedido.
- «Terminar» elimina el comprobante y reinicia la compra.

## V2.8

- WhatsApp envía solo folio y nombre; el detalle del pedido queda en la base de datos.
- Folio de 6 caracteres sin `I`, `O`, `0`, `1`.

## V2.7

- Botones de agregar desactivados cuando los pedidos están pausados o el negocio está cerrado.
- Cantidad máxima de 50 por línea, alineada con `create_order`.
- Validaciones de modalidad y método de pago deshabilitados.
- Panel de cocina y panel de caja (consulta; el registro de pagos llegó después).

## Cambios en este repositorio (rama `fix/auditoria-v3.1`)

- **Fase 0:** repositorio Git con un commit de línea base.
- **Fase 1:** documentación reconciliada con el código; README antiguos movidos a `docs/archivo/`; añadidos `docs/` y este historial.
- **Fase 2:** limpieza. Versión fijada en **3.2.0** (el código ya incluía lo descrito como V3.2). Eliminados `src/lib/supabase.zip` y `generateOrderId()` (código muerto). `dotenv` pasa a `devDependencies`. `scripts/make-admin.ts` recibe el UUID por argumento (`npm run make-admin -- <uuid>`) y se añaden los scripts `typecheck` y `make-admin`. El mensaje de WhatsApp usa el nombre del negocio de `settings`. Se corrige `package-lock.json`, que seguía llamándose `menu-whatsapp-v2` 2.7.0.
- **Fase 3:** `schema03.sql` (destructivo) se divide en `supabase/migrations/20261024000000_baseline.sql` (sin `DROP`) y `supabase/seed.sql` (solo desarrollo); el original pasa a `docs/archivo/`. Se verificó en un PostgreSQL 16 local que el resultado tiene estructura y permisos idénticos al esquema anterior. Se añade `supabase/tests/` para probar el SQL.
- **Fase 4:** los datos bancarios salen de `settings` (legible por cualquiera) y pasan a `transfer_details`, solo admin. `/api/menu` ya no usa `select("*")` ni publica banco/cuenta; `create_order` los devuelve únicamente en pedidos por transferencia. Triggers que mantienen la coherencia (no activar sin cuenta; no borrar la cuenta si está activa). Migración `20261024010000`; los datos existentes se copian, no se pierden. Pruebas SQL con roles `anon`, usuario normal y admin.
- **Fase 5:** protección anti-abuso dentro de `create_order` (donde no se puede esquivar llamando directo a Supabase): máximo de pedidos en proceso por teléfono y tope de pedidos pendientes global, configurables en `/admin/menu`. Bloqueo por teléfono (`pg_advisory_xact_lock`) para que solicitudes simultáneas no eludan el conteo; los reintentos idempotentes no se ven afectados. `/api/orders` responde 429. Verificado con una prueba de concurrencia real (8 sesiones simultáneas, 2 aceptadas) y comprobando que sin el bloqueo la prueba falla. Migración `20261024020000`.
- **Fase 6:** ESLint (0 errores; 11 advertencias documentadas en `docs/calidad.md`), Vitest con 21 pruebas unitarias y 38 comprobaciones SQL en 5 archivos (RLS con roles `anon`/usuario/admin, reglas de `create_order`, ciclo de vida, concurrencia real). Se eliminó código muerto de `admin/page.tsx` y un import sobrante, se usaron `<Link>` para enlaces internos y se corrigieron las dependencias de dos efectos. **Corrección de un fallo latente:** el enlace de WhatsApp se rompía si el número de configuración incluía `+`, espacios o guiones; ahora se limpia. Scripts `lint`, `test`, `test:sql`.

## Pendiente (ver plan de corrección)

Refactor y actualización automática de caja (Fase 7).
