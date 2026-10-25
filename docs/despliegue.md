# Despliegue a producción

> Estado: guía redactada a partir del código y de pruebas locales. **No se ha ejecutado un despliegue real** con esta guía; los comandos de verificación posteriores están por ejecutar.

## 1. Proyecto de Supabase de producción

Usa un proyecto **distinto** al de desarrollo.

1. Aplica solo las migraciones (`supabase/migrations/`) en orden. Con Supabase CLI: `supabase link --project-ref <ref>` y `supabase db push`. Sin CLI: ejecuta cada archivo en el SQL Editor, en orden de nombre.
2. **No ejecutes `supabase/seed.sql`**: contiene datos ficticios.
3. En Authentication, desactiva el registro público de usuarios (la aplicación no lo necesita; los administradores se crean a mano). Aunque RLS impide que un usuario sin rol admin vea pedidos o pagos, no hay motivo para permitir cuentas anónimas.
4. Crea tu usuario administrador en Authentication y asígnale el rol desde tu equipo:
   ```bash
   # .env.local debe incluir SUPABASE_SERVICE_ROLE_KEY (solo ahí)
   npm run make-admin -- <uuid-del-usuario>
   ```
5. Crea el bucket de fotos y sus políticas (`docs/fotos-productos.md`).

## 2. Hosting de la aplicación web

Variables de entorno **solo** estas dos:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de producción |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publishable de producción |

No configures `SUPABASE_SERVICE_ROLE_KEY` en el hosting. Requiere Node.js 20.9 o superior. Comandos: `npm ci`, `npm run build`, `npm start`.

## 3. Configuración inicial del negocio

Entra a `/admin/menu` → Configuración y define: nombre, teléfono y WhatsApp (se limpian espacios o `+` al armar el enlace), colonias de cobertura, tarifas, mínimo, horario, métodos de pago y datos bancarios, además de los límites anti-abuso. Crea tus categorías, productos y extras. **Activa los pedidos al final.**

## 4. Verificaciones posteriores al despliegue (por ejecutar)

Sustituye `$URL` y `$KEY` por los de producción. Todas deben **fallar o venir vacías**:

```bash
# Los datos bancarios no deben ser legibles con la clave pública
curl -s "$URL/rest/v1/transfer_details?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# Los pedidos no deben ser legibles con la clave pública
curl -s "$URL/rest/v1/orders?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Esperado en ambas: error de permisos (no una lista de filas). Y debe seguir funcionando lo público:

```bash
curl -s "$URL/rest/v1/products?select=name,price" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Después, haz un pedido de prueba en efectivo y otro por transferencia, y comprueba: el folio, el seguimiento con los últimos 4 dígitos, que los datos bancarios aparezcan solo en el pedido por transferencia, y el flujo cocina → caja → entregado. Cancela o elimina los pedidos de prueba.

## 5. Lista de comprobación antes de abrir

- [ ] Migraciones aplicadas; `seed.sql` **no** aplicado.
- [ ] Registro público de usuarios desactivado.
- [ ] Administrador creado con `app_metadata.role = admin`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ausente del hosting y del repositorio.
- [ ] Bucket `product-images` y políticas creados.
- [ ] Verificaciones con `curl` ejecutadas con el resultado esperado.
- [ ] Límites anti-abuso ajustados a tu volumen real (por defecto: 3 pedidos en proceso por teléfono, 30 pendientes en total).
- [ ] Pedidos de prueba eliminados.
- [ ] Copia de seguridad / plan de respaldo de la base definido en Supabase.

## 6. Limitaciones que debes conocer

Ver `docs/seguridad.md`. En particular: sin captcha (un atacante con muchos teléfonos puede agotar el tope global y bloquear temporalmente a clientes reales), el límite de consultas de seguimiento es por instancia, y las transferencias se verifican manualmente en tu banco.
