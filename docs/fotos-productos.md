# Fotografías de productos (Supabase Storage)

El panel `/admin/menu` permite seleccionar, previsualizar, reemplazar y quitar fotos. Los archivos se guardan en el bucket `product-images` y la URL pública se almacena en `products.image_url` (no requiere cambios de esquema). En el menú público, si un producto no tiene imagen o no carga, se muestra su emoji.

Formatos: JPG, PNG, WebP y AVIF, hasta 5 MB (se valida en la interfaz).

## 1. Crear el bucket (manual)

La aplicación **no** lo crea. En Supabase Dashboard → Storage → New bucket:

1. Nombre exacto: `product-images`.
2. Activar **Public bucket** (el menú público necesita las URL abiertas).
3. Si está disponible, límite de 5 MB y tipos MIME `image/jpeg`, `image/png`, `image/webp`, `image/avif`.

Un bucket público permite ver una imagen a quien conozca su URL; la escritura y el borrado deben quedar restringidos a administradores.

## 2. Políticas de `storage.objects`

Verifica antes que tus administradores tengan `app_metadata.role = 'admin'`. Revisa las políticas existentes para no duplicar nombres.

```sql
create policy "Admins can upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins can delete product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
```

Cada reemplazo sube un archivo con ruta nueva (`products/<id>/<marca-de-tiempo>-<nombre>.<ext>`), por eso no hace falta permiso de actualización. Al reemplazar o quitar, la aplicación intenta borrar la imagen anterior si pertenece a este bucket.

## 3. Prueba manual

1. Inicia sesión en `/admin` con un usuario administrador.
2. En `/admin/menu`, edita un producto y sube una imagen válida.
3. Comprueba la vista previa en el panel y la tarjeta en el menú público.
4. Reemplaza la imagen y verifica que se muestra la nueva.
5. Quítala y confirma que vuelve el emoji.

Si falla la carga: revisa el nombre exacto del bucket, que la sesión sea de administrador y que las políticas estén aplicadas.
