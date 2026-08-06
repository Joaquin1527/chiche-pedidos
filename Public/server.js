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

// ---------- Crear pedido ----------
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente, items, metodo, empleado } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido necesita al menos un item' });
    }
    if (!['mercadopago', 'transferencia'].includes(metodo)) {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de cobros de Chiche Hamburguesería corriendo en el puerto ${PORT}`);
});
