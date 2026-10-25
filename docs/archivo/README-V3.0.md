# Toritos Burger V3.0 — formulario de pedido y cobertura de entrega

## Cambios de esta revisión
- Formulario más compacto, con jerarquía visual y espaciado mejorados.
- El formulario ya no muestra los datos bancarios; solo informa que aparecerán al registrar el pedido.
- La pantalla final conserva los datos de transferencia y el importe.
- Las colonias de cobertura se administran desde **Administrar menú → Configuración → Pedidos y entregas**. Escribe una colonia por línea.
- La colonia se elige desde un `select` en el pedido a domicilio.
- La cobertura se valida en el endpoint y también en PostgreSQL con un trigger, para que no dependa solo del navegador.

## Migración
Si ya aplicaste las migraciones 001–007, ejecuta únicamente `supabase/migrations/008_delivery_neighborhoods.sql` en Supabase SQL Editor.
Después abre `/admin/menu`, entra a Configuración y registra las colonias autorizadas. Hasta que configures al menos una colonia, no se aceptarán pedidos a domicilio; recoger en el local seguirá disponible si está habilitado.

## Verificación pendiente
El ZIP se genera con los cambios de código, pero debe probarse contra tu instancia de Supabase. No se afirma que `next build` haya pasado en este entorno.


## V3.2 — teléfono obligatorio y seguimiento

- El teléfono de contacto es obligatorio y debe contener 10 dígitos.
- El seguimiento valida el folio y los últimos cuatro dígitos del teléfono.
- La respuesta pública no incluye teléfono completo ni otros datos privados.
- WhatsApp usa saltos de línea reales en el mensaje.
- La pantalla de seguimiento distingue los estados con iconos y colores y actualiza automáticamente cada 30 segundos.
- Ejecuta `supabase/migrations/009_required_phone_tracking.sql` después de las migraciones anteriores.
