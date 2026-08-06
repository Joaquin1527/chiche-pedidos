# APP de Cobro Chiche — Resumen del proyecto

## Qué es
Sistema de cobro remoto para **Chiche Hamburguesería** (un solo local, Puerto Madryn).
Permite generar un cobro (Mercado Pago o transferencia) por un pedido, y bloquea el
botón de "proceder con el pedido" hasta que el pago se confirma. Para Mercado Pago,
la confirmación es 100% automática vía webhook (nadie tiene que revisar nada a mano).

## Estado actual
- **Desplegado y funcionando en Render**: https://files-don-pancho.onrender.com
- **Repositorio en GitHub**: privado, del usuario Joaquin1527 (nombre del repo:
  "files-don-pancho", quedó así porque tomó el nombre de la carpeta local al crearlo,
  no tiene relación con Pancheria Chiche, es cosmético y no afecta el funcionamiento).
- Probado de punta a punta con credenciales de **prueba** de Mercado Pago — funcionó
  perfecto (QR, pago simulado, confirmación automática).
- Falta pasar a **credenciales de producción** en la variable `MP_ACCESS_TOKEN` de Render
  cuando el usuario esté listo para cobrar de verdad.

## Stack técnico
- Node.js + Express (server.js)
- SDK oficial de Mercado Pago (Preference API para generar el link/QR, Payment API
  para confirmar vía webhook)
- Frontend simple en HTML/CSS/JS vanilla (public/index.html, app.js, style.css)
- Almacenamiento: archivo `db.json` en el propio servidor (ver limitación abajo)
- Desplegado en Render (plan gratuito, Free instance)

## Decisiones tomadas en el camino
- Al principio se planteó multi-sucursal (Pancheria Chiche, 6 sucursales) — se sacó
  esa lógica porque en realidad Chiche es **un solo local**, no una cadena.
- El usuario ya tiene contratado un servicio externo llamado "Pedido Directo"
  (pedidodirecto.app/chichehamburguesas) que funciona como catálogo digital: el
  cliente arma su pedido ahí y llega por WhatsApp — pero ESE servicio no cobra
  automático. Por eso este sistema de cobro es el complemento que falta, no un
  reemplazo del catálogo.
- Se armó un catálogo de productos con precios fijos (desplegable) para que el
  empleado no tenga que escribir todo a mano al transcribir el pedido de WhatsApp:
  9 promos de hamburguesas, papas fritas (cono/caja), bebidas (Pepsi, 7up, Mirinda,
  Agua Mineral). Está en `public/app.js`, array `PRODUCTOS` — para agregar o cambiar
  precios se edita esa lista directamente.
- Nombre del negocio corregido de "Pancheria Chiche" a "Chiche Hamburguesería" en
  toda la interfaz, con emoji 🍔 en vez de 🌭.

## Problema pendiente de resolver (importante)
El plan gratuito de Render tiene **sistema de archivos efímero**: cada vez que el
servicio se "duerme" (a los 15 min sin uso) y se despierta de nuevo, o cada vez que
se hace un redeploy, **se borra el archivo `db.json`** — o sea, se pierde el
historial de pedidos guardado ahí. El cobro y la confirmación de pago en sí no se
ven afectados (eso funciona igual), pero no hay manera de llevar un historial
confiable de ventas con el almacenamiento actual.

**Dos soluciones posibles, todavía no implementadas:**
1. Pasar a un plan pago de Render (~USD 7/mes) y sumar un disco persistente.
2. Migrar el almacenamiento a una base de datos externa con capa gratuita permanente
   (ej. Neon o Supabase, Postgres) en vez del archivo `db.json`.

Quedó pendiente que el usuario decida cuál prefiere.

## Cosas que el usuario tuvo que resolver en el camino (para referencia si vuelve
a pasar algo parecido)
- Confusión Windows/PowerShell: `npm install` bloqueado por política de ejecución de
  scripts — se resolvió usando CMD en vez de PowerShell.
- Error de mayúscula/minúscula: la carpeta `public` había quedado como `Public` en
  el repositorio (Windows no distingue mayúsculas, Linux/Render sí) — se resolvió
  cambiando la referencia en `server.js` de `'public'` a `'Public'` en vez de pelear
  con el renombre en Windows.
- Varios servicios duplicados/fallidos quedaron creados en Render durante el proceso
  de prueba y error (pancheria-cobros-1, pancheria-cobros-2) — no se llegaron a
  borrar, están inactivos/fallidos y no afectan nada, pero se podrían limpiar.
- El repositorio de GitHub tiene un solo commit por ahora; se recomienda que de acá
  en más el usuario edite archivos directo en github.com (botón lápiz → editar →
  commit) en vez de usar GitHub Desktop, porque le resultó más simple y con menos
  errores de sincronización.

## Próximos pasos posibles (no iniciados)
- Resolver el tema de persistencia de datos (ver arriba).
- Etapa 2 del plan original: página pública para que el cliente arme su propio
  pedido y pague sin depender de que el empleado transcriba desde WhatsApp.
- Etapa 3: panel de cocina con estados en vivo (pendiente de pago → pagado →
  en preparación → listo).
- Pasar el Access Token de Mercado Pago a producción cuando el usuario confirme
  que está listo para cobrar de verdad.
