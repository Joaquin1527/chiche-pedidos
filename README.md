# Sistema de Cobros — Chiche Hamburguesería

Sistema para generar cobros remotos (Mercado Pago o transferencia) y bloquear
el pedido hasta que el pago esté confirmado.

## Cómo funciona

1. El empleado carga el pedido (cliente, productos, método de pago).
2. **Mercado Pago:** el sistema genera un link + QR de pago. Cuando el cliente paga,
   Mercado Pago avisa automáticamente al servidor (webhook) y el pedido pasa a "PAGADO" solo.
3. **Transferencia:** el empleado verifica en el resumen bancario y confirma con un botón
   (queda registrado quién confirmó y cuándo).
4. El botón "Proceder con el pedido" queda bloqueado hasta que el estado sea "PAGADO".

## Paso 1 — Conseguir las credenciales de Mercado Pago

1. Entrá a https://www.mercadopago.com.ar/developers/panel
2. Creá una aplicación (cualquier nombre, ej. "Cobros Chiche").
3. Andá a **Credenciales de producción** y copiá el **Access Token**.
   ⚠️ Es una clave sensible — nunca la compartas ni la subas a un repositorio público.

## Paso 2 — Instalar localmente (para probar)

```bash
cd pancheria-cobros
npm install
cp .env.example .env
```

Editá `.env` y pegá tu `MP_ACCESS_TOKEN`. Para probar en tu compu, `PUBLIC_URL` no va a
funcionar con Mercado Pago real (necesita una URL pública), pero podés levantar el server:

```bash
npm start
```

Abrí `http://localhost:3000` en el navegador.

## Paso 3 — Desplegar en la nube (para que funcione de verdad)

Necesitás una URL pública para que Mercado Pago te pueda avisar de los pagos (webhook).
La opción más simple y gratuita para empezar es **Render**:

1. Subí esta carpeta a un repositorio de GitHub (puede ser privado).
2. Entrá a https://render.com → **New Web Service** → conectá el repositorio.
3. Build command: `npm install` — Start command: `npm start`
4. En **Environment Variables** cargá:
   - `MP_ACCESS_TOKEN` = tu access token
   - `PUBLIC_URL` = la URL que te da Render (algo como `https://pancheria-cobros.onrender.com`)
5. Deploy. Listo — esa URL es la que abren los empleados de cada sucursal desde el celu.

(Railway o Fly.io funcionan igual de bien si preferís otra plataforma.)

## Cosas para tener en cuenta

- **Los datos se guardan en un archivo `db.json`** en el servidor. Para el volumen de un
  local gastronómico alcanza sin problema. Si en algún momento crece mucho el volumen o
  querés reportes históricos más robustos, se puede migrar a una base de datos real
  (te lo puedo armar cuando llegue el momento).
- **Transferencias no se pueden confirmar 100% automático** porque no hay una API estándar
  para leer resúmenes bancarios en tiempo real — por eso quedan con confirmación manual
  con doble registro (quién y cuándo).
- Si en el futuro querés sumar reportes de caja, conciliación diaria o que esto se conecte
  con el Excel de indicadores que armamos antes, avisame y lo integramos.
