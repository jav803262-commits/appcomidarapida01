# Seguridad

## Modelo

1. **Clave pública únicamente.** La aplicación usa la clave publishable de Supabase. Cualquiera puede verla y usarla contra la API de Supabase, por lo que **lo que protege los datos son RLS, `GRANT` y las funciones SQL**, no la interfaz.
2. **El servidor de la base decide.** Precios, disponibilidad, horario, cobertura y totales se calculan en `create_order`; los datos del navegador no se toman como verdaderos.
3. **Funciones `SECURITY DEFINER`** con `search_path` fijo y permisos de ejecución restringidos.
4. **Rol de administrador** en `app_metadata` (el usuario no puede modificarlo, a diferencia de `user_metadata`). Las páginas `/admin/*` comprueban el rol para mostrar la interfaz, pero el acceso real lo imponen RLS e `is_admin()`.
5. **Datos mínimos en el seguimiento público.** Solo estado y tiempos; sin nombre, teléfono, dirección, artículos, notas, modalidad ni total.
6. **Idempotencia** en la creación de pedidos para evitar duplicados.
7. **Sin secretos en el repositorio.** `.env.example` contiene valores ilustrativos; `.env*` está en `.gitignore`.

## Limitaciones conocidas

Estas limitaciones **existen hoy** en el código. Están priorizadas en el plan de corrección.

| # | Limitación | Riesgo | Estado |
|---|---|---|---|
| 1 | `settings` es legible por `anon` y `/api/menu` usa `select("*")`: **banco, titular y cuenta de transferencia se envían a cualquier visitante**, no solo después de registrar un pedido | Medio-alto | Pendiente (Fase 4) |
| 2 | No hay límite de frecuencia al crear pedidos. `create_order` es ejecutable por `anon`, de modo que también puede llamarse directamente a la API de Supabase sin pasar por `/api/orders` | Alto (pedidos falsos que saturen la cocina) | Pendiente (Fase 5) |
| 3 | El límite de intentos de `/api/orders/track` vive en la memoria de cada instancia y se basa en `x-forwarded-for`, que puede falsificarse. En despliegues serverless o con varias instancias es poco efectivo | Medio | Documentado; mitigado por el requisito de folio + 4 dígitos |
| 4 | El folio se genera con `random()` (no criptográfico). No es un secreto fuerte | Bajo | Aceptado; compensado por los 4 dígitos del teléfono |
| 5 | No hay pruebas automatizadas de RLS ni de `create_order` | Medio | Pendiente (Fase 6) |
| 6 | `schema03.sql` borra datos; no hay migraciones para actualizar producción | Alto si se usa con ventas reales | Pendiente (Fase 3) |

## Transferencias

El cliente ve los datos bancarios y puede copiarlos. Debe adjuntar el comprobante manualmente por WhatsApp. En caja, el administrador debe verificar en su banco que el dinero llegó antes de registrar la transferencia; la aplicación no consulta el banco.

## Seguimiento del pedido

El folio por sí solo no es una autenticación fuerte. La consulta exige además los últimos 4 dígitos del teléfono registrado. Comparte el folio únicamente con el cliente.

## Recomendaciones de despliegue

- Usa un proyecto de Supabase separado para producción y no ejecutes `schema03.sql` en él.
- Mantén `service_role` fuera de cualquier variable `NEXT_PUBLIC_*` y fuera del repositorio.
- Antes de recibir pedidos reales, resuelve al menos las limitaciones 1, 2 y 6.
