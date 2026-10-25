# Toritos Burger

Aplicación web de menú y pedidos para un negocio de comida rápida a llevar. Los clientes arman su pedido y lo registran; el negocio lo gestiona desde paneles de administración, cocina y caja.

> **Estado:** en desarrollo. Ver [`CHANGELOG.md`](CHANGELOG.md) y la sección «Limitaciones conocidas» de [`docs/seguridad.md`](docs/seguridad.md) antes de usarlo con ventas reales.

## Tecnologías

Next.js 16 (App Router) · React 19 · TypeScript (modo estricto) · Tailwind CSS 4 · Supabase (Postgres, Auth y Storage).

## Requisitos previos

- Node.js 20.9 o superior.
- Un proyecto de Supabase **de desarrollo** (que puedas recrear sin perder datos).

## Instalación

```bash
npm ci
cp .env.example .env.local     # y completa las dos variables
npm run dev
```

Variables (ver `.env.example`):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (publishable/anon) |

Nunca pongas una clave `service_role` en una variable `NEXT_PUBLIC_*`. Solo el script `scripts/make-admin.ts` la usa, desde `.env.local` y en tu equipo.

## Base de datos

El esquema está en migraciones versionadas (`supabase/migrations/`) y los datos de ejemplo en `supabase/seed.sql` (solo desarrollo). Las migraciones no borran datos. Pasos y detalles en [`docs/base-de-datos.md`](docs/base-de-datos.md).

## Rutas

| Ruta | Quién | Para qué |
|---|---|---|
| `/` | Público | Menú, carrito y formulario de pedido |
| `/pedido/consultar` | Público | Estado del pedido (folio + últimos 4 dígitos del teléfono) |
| `/admin` | Administrador | Lista de pedidos y cambio de estado |
| `/admin/cocina` | Administrador | Tablero de preparación |
| `/admin/caja` | Administrador | Registro de cobros y entregas |
| `/admin/menu` | Administrador | Catálogo, configuración y fotografías |

## Comprobaciones

```bash
npm run typecheck   # tipos
npm run lint        # ESLint
npm test            # pruebas unitarias (Vitest)
npm run build       # compilación (requiere las dos variables de entorno)
npm run test:sql    # pruebas del esquema SQL (requiere PostgreSQL local; ver docs/calidad.md)
```

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — estructura y flujos.
- [`docs/base-de-datos.md`](docs/base-de-datos.md) — tablas, funciones y permisos.
- [`docs/seguridad.md`](docs/seguridad.md) — modelo de seguridad y limitaciones conocidas.
- [`docs/despliegue.md`](docs/despliegue.md) — pasos y lista de comprobación para producción.
- [`docs/calidad.md`](docs/calidad.md) — pruebas, lint y deuda técnica conocida.
- [`docs/fotos-productos.md`](docs/fotos-productos.md) — configuración del bucket de imágenes.
- [`docs/archivo/`](docs/archivo/LEEME.md) — README antiguos (desactualizados).
