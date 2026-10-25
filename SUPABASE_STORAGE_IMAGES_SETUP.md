# Toritos Burger — configuración de fotografías en Supabase Storage

Esta integración usa la columna existente `public.products.image_url`. No agrega columnas ni tablas al esquema de la aplicación.

## 1. Crear el bucket

En Supabase Dashboard:

1. Abre **Storage**.
2. Selecciona **New bucket**.
3. Nombre: `product-images` (exacto).
4. Activa **Public bucket** para que el menú público pueda mostrar las fotografías mediante sus URL.
5. Si la interfaz permite límites por archivo, establece 5 MB y limita los tipos MIME a `image/jpeg`, `image/png`, `image/webp` e `image/avif`.
6. Guarda el bucket.

El bucket público permite que cualquier visitante vea una imagen si conoce su URL. La escritura y eliminación deben seguir restringidas a administradores.

## 2. Políticas de Storage para administradores

Antes de ejecutar estas políticas, verifica que los administradores tengan `app_metadata.role = 'admin'`, como espera el código actual. Estas políticas son para `storage.objects`; no alteran las tablas de negocio `products`, `categories`, `orders` ni `order_payments`.

```sql
-- Permitir que solo administradores carguen archivos en el bucket.
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Permitir que solo administradores eliminen imágenes del bucket.
create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

El código sube cada reemplazo con una ruta nueva (`products/<id>/<marca-de-tiempo>-<nombre>.<extensión>`), por lo que no necesita permiso de actualización de objetos. No crees políticas duplicadas con los mismos nombres si ya existen; revisa primero las políticas actuales en Storage.

## 3. Variables de entorno

La implementación reutiliza las variables existentes:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

No agregues una clave `service_role` al frontend ni a variables `NEXT_PUBLIC_*`.

## 4. Prueba recomendada

1. Inicia sesión en `/admin` con una cuenta cuyo `app_metadata.role` sea `admin`.
2. En `/admin/menu`, edita un producto de prueba y selecciona una imagen JPG, PNG, WebP o AVIF de hasta 5 MB.
3. Guarda el producto y comprueba que aparece la vista previa en la lista administrativa.
4. Abre el menú público y confirma que la fotografía se muestra en la tarjeta.
5. Reemplaza la imagen y verifica que se muestra la nueva. El sistema intenta eliminar la anterior si pertenece a este bucket.
6. Prueba quitar la imagen y confirma que vuelve a mostrarse el emoji alternativo.

Si falla la carga, comprueba que el bucket se llame exactamente `product-images`, que la sesión sea de administrador y que las políticas estén aplicadas. La aplicación no crea el bucket automáticamente.
