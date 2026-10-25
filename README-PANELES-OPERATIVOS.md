# Paneles operativos — Toritos Burger

Esta versión agrega dos vistas sobre la tabla `orders` existente:

- `/admin/cocina`: tablero de cocina con pendientes, preparando y listos. Cocina puede avanzar `pending`/`confirmed` → `preparing` → `ready`.
- `/admin/caja`: lista de pedidos listos o historial operativo con importe y método de pago elegido.

## Acceso

Las nuevas vistas reutilizan la sesión de Supabase Auth y, como la versión actual del proyecto, requieren `app_metadata.role = admin`. No se crearon roles ni políticas nuevas.

## Importante sobre caja

El esquema actual no contiene un estado de pago independiente. Por seguridad, el panel de caja es de consulta y no presenta un botón para marcar como pagado. Tampoco interpreta el estado `delivered` como confirmación de pago. Antes de registrar cobros, hay que diseñar y aplicar una migración compatible para guardar el estado del pago, cuándo se cobró y quién lo registró.

## Validación

No se pudo completar la compilación en este entorno porque las dependencias del proyecto no están instaladas y no se pudo resolver `react`/`@supabase/supabase-js` con el chequeo TypeScript local. Instalar dependencias (`npm ci`) y ejecutar `npm run build` antes de desplegar. Probar también las políticas RLS en Supabase.
