import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');

// ---------- "Base de datos" simple en archivo JSON ----------
// Para un negocio de este tamano alcanza de sobra. Si en el futuro crece mucho
// el volumen, se puede migrar a SQLite o Postgres sin tocar el resto del codigo.
function leerDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ pedidos: [] }, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function guardarDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- Mercado Pago ----------
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// ---------- QR interoperable (Transferencias 3.0 — cualquier banco/billetera) ----------
// A diferencia de Checkout Pro, esta caja usa un QR FIJO (modelo estatico):
// la imagen del QR no cambia, lo que cambia es el monto/pedido asociado a esa
// caja en Mercado Pago en el momento de generar el cobro. Por eso conviene
// usarlo de a un pedido por vez (no para pedidos simultaneos de varios clientes).
async function generarQrInteroperable(pedido) {
  const url = `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${process.env.MP_USER_ID}/pos/${process.env.MP_POS_ID}/qrs`;

  const body = {
    external_reference: pedido.id,
    title: 'Chiche Hamburguesería',
    description: pedido.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ').slice(0, 250),
    notification_url: `${process.env.PUBLIC_URL}/api/webhook/mercadopago-qr`,
    total_amount: pedido.total,
    items: pedido.items.map((it) => ({
      title: String(it.nombre).slice(0, 250),
      unit_price: Number(it.precio),
      quantity: Number(it.cantidad),
      unit_measure: 'unit',
      total_amount: Number(it.precio) * Number(it.cantidad),
    })),
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Mercado Pago rechazo la orden QR (${res.status}): ${errorText}`);
  }

  // La imagen del QR es siempre la misma para esta caja (la sacamos una vez
  // con GET /pos y la dejamos fija por variable de entorno).
  return process.env.MP_QR_IMAGE_URL;
}

// ---------- Crear pedido ----------
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente, items, metodo, empleado } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido necesita al menos un item' });
    }
    if (!['mercadopago', 'transferencia', 'qr_interoperable'].includes(metodo)) {
      return res.status(400).json({ error: 'Metodo de pago invalido' });
    }

    const total = items.reduce((acc, it) => acc + Number(it.precio) * Number(it.cantidad), 0);
    const id = nanoid(10);

    const pedido = {
      id,
      cliente: cliente || 'Sin nombre',
      items,
      total,
      metodo,
      estado: 'pendiente', // pendiente | pagado | cancelado
      listo: false, // si ya está preparado y listo para retirar
      listoEn: null,
      creadoPor: empleado || 'Sin especificar',
      confirmadoPor: null,
      mpPreferenceId: null,
      mpPaymentId: null,
      linkPago: null,
      qr: null,
      creadoEn: new Date().toISOString(),
      pagadoEn: null,
    };

    if (metodo === 'mercadopago') {
      const preference = await preferenceClient.create({
        body: {
          items: items.map((it) => ({
            title: it.nombre,
            quantity: Number(it.cantidad),
            unit_price: Number(it.precio),
            currency_id: 'ARS',
          })),
          external_reference: id,
          notification_url: `${process.env.PUBLIC_URL}/api/webhook/mercadopago`,
          back_urls: {
            success: `${process.env.PUBLIC_URL}/gracias.html`,
            pending: `${process.env.PUBLIC_URL}/gracias.html`,
            failure: `${process.env.PUBLIC_URL}/gracias.html`,
          },
          auto_return: 'approved',
        },
      });

      pedido.mpPreferenceId = preference.id;
      pedido.linkPago = preference.init_point;
      pedido.qr = await QRCode.toDataURL(preference.init_point);
    }

    if (metodo === 'qr_interoperable') {
      pedido.qr = await generarQrInteroperable(pedido);
    }

    const db = leerDB();
    db.pedidos.push(pedido);
    guardarDB(db);

    res.json(pedido);
  } catch (err) {
    console.error('Error creando pedido:', err);
    res.status(500).json({ error: 'No se pudo crear el pedido' });
  }
});

// ---------- Listar pedidos ----------
app.get('/api/pedidos', (req, res) => {
  const { estado } = req.query;
  const db = leerDB();
  let pedidos = db.pedidos;
  if (estado) pedidos = pedidos.filter((p) => p.estado === estado);
  // los mas nuevos primero
  pedidos = pedidos.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  res.json(pedidos);
});

// ---------- Consultar un pedido puntual (para el polling del frontend) ----------
app.get('/api/pedidos/:id', (req, res) => {
  const db = leerDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  res.json(pedido);
});

// ---------- Confirmacion MANUAL (transferencias) ----------
app.post('/api/pedidos/:id/confirmar-manual', (req, res) => {
  const { empleado } = req.body;
  const db = leerDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  if (pedido.metodo !== 'transferencia') {
    return res.status(400).json({ error: 'Este pedido no es por transferencia' });
  }
  pedido.estado = 'pagado';
  pedido.confirmadoPor = empleado || 'Sin especificar';
  pedido.pagadoEn = new Date().toISOString();
  guardarDB(db);
  res.json(pedido);
});

// ---------- Marcar pedido como listo para retirar ----------
app.post('/api/pedidos/:id/marcar-listo', (req, res) => {
  const db = leerDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  pedido.listo = true;
  pedido.listoEn = new Date().toISOString();
  guardarDB(db);
  res.json(pedido);
});

// ---------- Cancelar pedido ----------
app.post('/api/pedidos/:id/cancelar', (req, res) => {
  const db = leerDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  pedido.estado = 'cancelado';
  guardarDB(db);
  res.json(pedido);
});

// ---------- Webhook de Mercado Pago ----------
// MP puede mandar la notificacion por query params (formato viejo) o por body (formato nuevo).
// Contemplamos los dos para que no se escape ningun aviso.
app.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const topic = req.query.topic || req.query.type || req.body?.type;
    const paymentId = req.query['data.id'] || req.body?.data?.id || req.query.id;

    if (topic === 'payment' && paymentId) {
      const pago = await paymentClient.get({ id: paymentId });
      const orderId = pago.external_reference;

      const db = leerDB();
      const pedido = db.pedidos.find((p) => p.id === orderId);

      if (pedido) {
        pedido.mpPaymentId = String(paymentId);
        if (pago.status === 'approved' && pedido.estado !== 'pagado') {
          pedido.estado = 'pagado';
          pedido.pagadoEn = new Date().toISOString();
          pedido.confirmadoPor = 'Mercado Pago (automatico)';
        } else if (pago.status === 'rejected') {
          pedido.estado = 'cancelado';
        }
        guardarDB(db);
      }
    }

    // Siempre respondemos 200 rapido, MP reintenta si no le contestamos bien.
    res.sendStatus(200);
  } catch (err) {
    console.error('Error procesando webhook:', err);
    res.sendStatus(200); // igual devolvemos 200 para que MP no reintente en loop por un error nuestro
  }
});

// ---------- Webhook del QR interoperable (merchant_order) ----------
// Este producto de Mercado Pago avisa via el topico "merchant_order", distinto
// al webhook de pagos de Checkout Pro. La notificacion trae el ID de la orden;
// hay que consultarla para saber si de verdad se pago (order_status: "closed").
// NOTA: la documentacion de Mercado Pago para este producto tiene inconsistencias
// entre paginas propias — si esto no dispara solo tras una prueba real, revisar
// los logs de Render en el momento del pago para ajustar el formato exacto.
app.post('/api/webhook/mercadopago-qr', async (req, res) => {
  try {
    console.log('Webhook QR interoperable recibido:', JSON.stringify({ query: req.query, body: req.body }));

    const topic = req.query.topic || req.body?.topic || req.body?.type;
    const resourceUrl = req.query.resource || req.body?.resource;
    const merchantOrderId = req.query.id || req.body?.id;

    if (topic === 'merchant_order' || topic === 'merchant_orders' || resourceUrl || merchantOrderId) {
      let merchantOrderUrl = resourceUrl;
      if (!merchantOrderUrl && merchantOrderId) {
        merchantOrderUrl = `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`;
      }

      if (merchantOrderUrl) {
        const mOrderRes = await fetch(merchantOrderUrl, {
          headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        });
        const merchantOrder = await mOrderRes.json();
        console.log('Detalle de merchant_order:', JSON.stringify(merchantOrder));

        const orderId = merchantOrder.external_reference;
        const db = leerDB();
        const pedido = db.pedidos.find((p) => p.id === orderId);

        if (pedido) {
          const pagoAprobado =
            merchantOrder.order_status === 'closed' ||
            merchantOrder.payments?.some((p) => p.status === 'approved');

          if (pagoAprobado && pedido.estado !== 'pagado') {
            pedido.estado = 'pagado';
            pedido.pagadoEn = new Date().toISOString();
            pedido.confirmadoPor = 'Mercado Pago QR (automatico)';
            guardarDB(db);
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error procesando webhook de QR interoperable:', err);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de cobros de Chiche Hamburguesería corriendo en el puerto ${PORT}`);
});
