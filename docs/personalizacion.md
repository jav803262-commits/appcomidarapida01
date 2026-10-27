# Personalizar la plantilla para un negocio

## Lo que se configura sin tocar código

Entra en `/admin/menu` con una cuenta administradora:

| Qué | Dónde |
|---|---|
| Nombre del negocio | Configuración. Aparece en el menú, el formulario, los paneles, el título de la pestaña, el logotipo de texto (iniciales) y los mensajes de WhatsApp |
| Teléfono, WhatsApp y dirección | Configuración |
| Categorías, productos, extras y fotos | Pestañas del catálogo |
| Modalidades (recoger / domicilio), tarifa de envío, mínimo y colonias de cobertura | Configuración |
| Horario y tiempos estimados | Configuración |
| Efectivo y transferencia (banco, titular y cuenta) | Configuración |
| Límites anti-abuso | Configuración |

Un negocio nuevo arranca con el nombre «Mi negocio» y los pedidos **desactivados** hasta que se configure.

## Datos de ejemplo

`supabase/seed.sql` carga un negocio y un catálogo genéricos marcados `[DEMO]` para desarrollo. **Nunca** se aplica en producción (ver `docs/despliegue.md`).

## Lo que todavía está fijo en el código

Para ser honestos con quien vaya a reutilizarla, esto **no** es configurable hoy y requiere editar código:

| Aspecto | Situación | Dónde |
|---|---|---|
| **Colores y estilo visual** | El rojo y el diseño son los del proyecto original | Clases de Tailwind (`bg-red-…`, `text-red-…`) repartidas por los componentes, y `src/app/globals.css` |
| **Logotipo** | Solo hay un logotipo de texto con las iniciales; no hay subida de imagen | Cabeceras de los paneles |
| **Teléfono** | Exactamente **10 dígitos** (formato mexicano), validado en el formulario, en `create_order` y por una restricción de la tabla `orders` | `OrderForm.tsx`, migración base (SQL) |
| **Moneda** | La tabla `settings` tiene una columna `currency`, pero el formato y las etiquetas «MXN» están escritos en el código | `lib/order.ts`, `OrderTicket.tsx`, `admin/page.tsx`, `admin/caja/page.tsx` y los formularios de `admin/menu` |
| **Fechas y números** | Formato `es-MX` fijo | Los mismos archivos, `pedido/consultar/page.tsx` y `layout.tsx` (`lang="es-MX"`) |
| **Idioma** | Todos los textos están en español dentro del código | `src/components` y `src/app` |
| **Textos de WhatsApp de la interfaz del cliente** | Plantilla fija (folio y nombre) | `src/lib/whatsapp.ts` |
| **Emojis de ejemplo** | Los productos usan un emoji como respaldo de imagen | Catálogo (editable por producto) |

La **zona horaria** sí es configurable (campo «Zona horaria» en `/admin/menu`; por defecto `America/Mexico_City`). Si vas a ofrecerla a negocios de otros países, la validación del teléfono (cliente y SQL) y el formato de moneda son los primeros puntos a parametrizar. Un bloque de «marca» en la configuración (color principal y logotipo) sería la siguiente mejora natural.

## Lista rápida para un negocio nuevo

1. Proyecto de Supabase nuevo y migraciones aplicadas (sin `seed.sql`).
2. Usuario administrador creado.
3. Configuración, catálogo y cobertura en `/admin/menu`.
4. Pedidos activados y prueba de extremo a extremo (`docs/despliegue.md`).
