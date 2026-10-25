# Toritos Burger — V3.1

Aplicación de menú y pedidos con Next.js, TypeScript, Tailwind CSS y Supabase.

## Novedades V3.1

- Consulta pública del estado del pedido en `/pedido/consultar`.
- La consulta pública requiere únicamente el folio de 6 caracteres.
- Tabla independiente `public_order_tracking`, sin nombre, teléfono, dirección, artículos ni notas.
- Trigger de PostgreSQL para mantener sincronizados estado y datos operativos.
- Función SQL que devuelve una lista explícita de campos permitidos; no hay lectura pública directa de la tabla.
- Límite básico de intentos en el endpoint de seguimiento. Es por instancia y no sustituye un limitador distribuido para una protección robusta en despliegues con varias instancias.
- El teléfono es opcional; si se proporciona, debe tener 10 dígitos.
- En pedidos por transferencia, el comprobante debe adjuntarse manualmente en WhatsApp después de realizar el pago. La aplicación no verifica automáticamente depósitos.
- La pantalla de confirmación conserva el folio y evita que el carrito reaparezca hasta que el cliente elija terminar.

## Requisitos

- Node.js 20.9 o superior.
- Proyecto Supabase configurado.

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura en `.env.local` las variables que aparecen en `.env.example`. Nunca pongas una clave `service_role` en una variable `NEXT_PUBLIC_*`.

## Migraciones Supabase

Aplica en orden las migraciones `001` a `007` que están en `supabase/migrations/`.

- Base nueva: aplica `001` a `007` en orden.
- Base que ya tenía `001` a `005` y aún no aplicó el seguimiento: aplica `006` y después `007`.
- Base donde ya se aplicó `006`: aplica únicamente `007`.

La migración 006 crea la tabla de seguimiento y el trigger. La migración 007 elimina del registro público el total y la modalidad, cambia la consulta para devolver solo los campos mínimos y vuelve opcional el teléfono. Revisa primero en un entorno de pruebas y conserva una copia de seguridad antes de aplicarla en producción.

## Seguridad del seguimiento

El folio funciona como un identificador secreto de consulta: compártelo únicamente con el cliente. La página no expone nombre, teléfono, dirección, productos, notas, modalidad ni total. El endpoint limita intentos por instancia; para despliegues públicos con tráfico real, se recomienda sustituirlo por un limitador distribuido. El folio por sí solo no equivale a una autenticación fuerte.


- `orders` sigue siendo la fuente privada del pedido completo.
- `public_order_tracking` contiene solo folio, estado, fecha de registro, tiempo estimado y fecha de actualización.
- RLS está habilitado y no se concede lectura directa a `anon` ni `authenticated`.
- El endpoint consulta la función SQL únicamente con el folio.
- El límite actual de intentos es una protección básica en memoria por instancia. Para producción con mayor tráfico, configurar rate limiting distribuido.

## Transferencias

El cliente ve los datos bancarios configurados por el negocio y puede copiar cada dato. Tras transferir, debe abrir WhatsApp y adjuntar el comprobante manualmente. La recepción y validación del pago sigue siendo una tarea del negocio.

## Fotografías de productos

El panel `/admin/menu` permite seleccionar, previsualizar, reemplazar y quitar fotografías. Las imágenes se guardan en el bucket `product-images` de Supabase Storage y la URL pública se almacena en la columna existente `products.image_url`; no requiere cambios en el esquema SQL de la aplicación.

Antes de usarlo, crea manualmente el bucket y configura sus permisos siguiendo `SUPABASE_STORAGE_IMAGES_SETUP.md`. El panel acepta JPG, PNG, WebP y AVIF de hasta 5 MB. La vista pública usa la fotografía y conserva el emoji como alternativa si no hay imagen o no puede cargarse.
