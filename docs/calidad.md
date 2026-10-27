# Calidad y pruebas

## Comandos

| Comando | Qué comprueba | Requisitos |
|---|---|---|
| `npm run typecheck` | Tipos TypeScript (modo estricto) | — |
| `npm run lint` | ESLint (reglas de Next.js y TypeScript) | — |
| `npm test` | Pruebas unitarias de `src/lib/` y de componentes React en jsdom (Vitest, 63 pruebas) | — |
| `npm run build` | Compilación de producción | Las 2 variables `NEXT_PUBLIC_SUPABASE_*` (sirven valores ficticios) |
| `npm run test:sql` | Esquema, reglas de negocio, permisos y concurrencia en un PostgreSQL real | PostgreSQL 16 local y ejecución como root (ver abajo) |

Antes de cada commit conviene ejecutar los cuatro primeros.

## Pruebas SQL (`supabase/tests/`)

Recrean una base local, aplican `migrations/` y `seed.sql` sobre un simulador mínimo de Supabase (`00_supabase_stub.sql`: roles `anon`/`authenticated`, `auth.jwt()`, `auth.uid()`) y ejecutan cada archivo de `sql/`. Cada prueba corre dentro de una transacción que se revierte.

| Archivo | Qué demuestra |
|---|---|
| `10_transfer_privacy.sql` | `anon` y usuarios normales no leen los datos bancarios; solo se entregan en pedidos por transferencia (también en reintentos); invariantes de activación |
| `20_abuse_protection.sql` | Límite por teléfono y tope global (SQLSTATE `PT429`); los reintentos idempotentes no se bloquean; se libera cupo al cancelar |
| `30_create_order_rules.sql` | Precio manipulado ignorado, cantidades fuera de rango, producto inexistente, teléfono/nombre/pago inválidos, efectivo insuficiente, conflicto de idempotencia, pedidos pausados, cobertura de entrega y cobro de envío |
| `40_security_and_lifecycle.sql` | `anon` y usuarios normales sin acceso a pedidos/pagos/tracking; seguimiento público mínimo; transiciones ordenadas; no se entrega sin pago; un solo pago activo; sincronización del tracking |
| `concurrency.sh` | 8 sesiones simultáneas con el mismo teléfono: solo se aceptan las que permite el límite |

Se comprobó con **pruebas de mutación** que no son decorativas: al conceder a propósito `SELECT` a `anon` sobre `transfer_details` o `orders`, o al quitar el bloqueo por teléfono, las pruebas correspondientes fallan.

En Ubuntu/Debian: `apt install postgresql` y luego `bash supabase/tests/run_tests.sh` (los scripts usan `su postgres`).

## Pruebas de componentes (`tests/components/`)

Se ejecutan con Vitest + Testing Library en **jsdom** (un DOM simulado, no un navegador real) y con `fetch` simulado:

| Archivo | Qué demuestra |
|---|---|
| `OrderTicket.test.tsx` | Muestra los datos bancarios solo en pedidos por transferencia y solo los que llegaron con el pedido; no falla con comprobantes antiguos; el enlace de WhatsApp usa el número limpio y el nombre del negocio |
| `OrderForm.test.tsx` | Muestra el nombre del negocio configurado (no uno fijo); entrega al ticket los datos bancarios de la API; el cliente no envía precios ni totales (solo IDs y cantidades); muestra el mensaje del servidor ante un 429; teléfono e importe en efectivo inválidos no se envían; pedidos pausados no se envían |
| `useBusinessName.test.tsx` | El nombre del negocio de las cabeceras admin viene de la configuración, con respaldo si falta o está vacío |
| `CartContext.test.tsx` | Agrupación de líneas, tope de 50, persistencia en `localStorage`, recuperación ante datos corruptos |

Se comprobó con una mutación que detectan fallos: al romper a propósito el traspaso de `transfer` en el formulario, la prueba correspondiente falla.

Además, `tests/unit/settings-save.test.ts` fija el orden de guardado de configuración y datos bancarios que exigen los triggers de la base.

## Estado de ESLint

0 errores y 12 advertencias, todas conocidas:

| Advertencia | Dónde | Por qué se deja | Plan |
|---|---|---|---|
| `react-hooks/set-state-in-effect` (8) | Carrito, `MenuApp`, `ProductCard`, consulta de pedido, cocina, caja | Es el patrón de hidratar estado desde `localStorage`/`sessionStorage` o cargar datos en un efecto. Funciona y evita errores de hidratación en SSR; la regla es nueva y propone otra técnica | Fase 7: hooks de datos y `useSyncExternalStore` |
| `no-img-element` (3) | Imágenes de productos | Las URL vienen de Supabase Storage y habría que configurar `remotePatterns` de `next/image` | Opcional |
| `no-location-assign-relative-destination` (1) | Cerrar sesión admin | Recarga intencional a una ruta propia | Opcional |

## Lo que todavía no está cubierto

- **No hay pruebas de extremo a extremo en un navegador real.** Las pruebas de componentes usan jsdom, que no ejecuta CSS ni reproduce diferencias entre navegadores. Al intentar usar Playwright en el entorno de revisión no fue posible descargar un navegador, así que sigue pendiente. Por eso las páginas de administración de ~500 líneas (`/admin`, `/admin/menu`) **no se han dividido en componentes**: sin pruebas de interfaz, ese refactor arriesga regresiones silenciosas. Las páginas de administración tampoco tienen pruebas de componentes. Conviene dividirlas después de añadir pruebas de interfaz para ellas (Playwright o Testing Library).
- Las rutas `/api/*` no tienen pruebas propias; su lógica crítica está en la base (probada).
- No hay integración continua configurada.
