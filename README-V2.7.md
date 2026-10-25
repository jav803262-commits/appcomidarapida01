# Toritos Burger — V2.7

## Cambios de esta versión

- Los botones para agregar productos se desactivan cuando los pedidos están pausados o el negocio está fuera de horario.
- El carrito informa cuando no es posible continuar y conserva los productos para más tarde.
- Se corrigió la condición de los avisos para evitar mostrar a la vez “fuera de horario” y “pedidos pausados”.
- Se agregó teléfono de contacto opcional al formulario del cliente; se guarda a través del RPC existente y se incluye en el ticket y mensaje de WhatsApp.
- El carrito limita la cantidad por renglón a 50 unidades, alineándose con la validación de `create_order` en Supabase.
- Se añadieron validaciones de cliente para evitar enviar una modalidad de entrega o método de pago que esté desactivado.

## Actualización

Esta versión parte de V2.6. No requiere una migración SQL nueva: el teléfono usa el campo `customer_phone` que ya contempla la función `create_order`.

Si aún no se ha aplicado, ejecutar en Supabase las migraciones en orden: `001`, `002`, `003` y `004_business_configuration.sql`.

## Pruebas pendientes

La compilación completa debe ejecutarse en un entorno con las dependencias instaladas:

```bash
npm ci
npm run build
```

Luego probar manualmente:
1. Pausar pedidos desde `/admin/menu` y verificar que no se pueda agregar ni continuar con el carrito.
2. Activar horarios y simular un horario cerrado.
3. Desactivar domicilio o recogida y confirmar que la API rechace el tipo deshabilitado.
4. Crear un pedido con teléfono opcional y revisar que aparezca en el ticket y WhatsApp.


## V2.8 — Folio y envío simplificado

- La primera pantalla conserva la captura y el guardado completo del pedido.
- La segunda pantalla muestra confirmación de registro, folio y nombre.
- WhatsApp prepara únicamente el folio y el nombre del cliente; no se envía el detalle del pedido.
- El folio generado por la migración `002_create_order_rpc.sql` usa 6 caracteres, excluyendo `I`, `O`, `0` y `1`.
- Para aplicar el nuevo formato a una base de datos existente, vuelve a ejecutar la definición actualizada de la función `public.create_order(jsonb)` en el SQL Editor de Supabase, o aplica la migración correspondiente en tu flujo de despliegue. No se modifica el folio de los pedidos ya creados.


## V2.9 — Bloqueo de navegación tras registrar el pedido

- Se oculta el carrito y su importe en el encabezado mientras se muestra el comprobante.
- Se elimina el botón de regresar al formulario desde la pantalla de comprobante.
- Después de crear el pedido, se vacía el carrito activo y se conserva por separado el comprobante en `sessionStorage`.
- Al recargar la página en la misma pestaña, se recupera el comprobante guardado y no se vuelve a crear el pedido.
- El botón WhatsApp solo reutiliza el folio y el nombre existentes.
- El botón «Terminar» elimina el comprobante de la sesión y recarga el menú para iniciar una compra nueva de forma explícita.
- El carrito escribe su vaciado directamente en `localStorage` para evitar que reaparezca tras una recarga.
