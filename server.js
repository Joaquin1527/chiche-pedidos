import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { google } from 'googleapis';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');

// ---------- "Base de datos" simple en archivo JSON ----------
// Para un negocio de este tamano alcanza de sobra. Si en el futuro crece mucho
// el volumen, se puede migrar a SQLite o Postgres sin tocar el resto del codigo.
//
// IMPORTANTE: tiendaAbierta arranca en FALSE (cerrada) por defecto. Es la opcion
// "a prueba de fallos": si Render se reinicia solo (plan gratis, duerme cada
// 15 min sin uso) y se pierde este archivo, preferimos que el sistema quede
// bloqueado sin querer antes que acepte pedidos sin querer. Un empleado
// siempre puede reabrirla a mano con el boton del panel.
function leerDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ pedidos: [], tiendaAbierta: false }, null, 2));
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  if (typeof db.tiendaAbierta !== 'boolean') db.tiendaAbierta = false; // compatibilidad con db.json viejos
  return db;
}
function guardarDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- Mercado Pago ----------
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

// ---------- Google Sheets (respaldo automatico de pedidos, sobrevive a que Render duerma) ----------
// Si no estan cargadas las variables de entorno, esto queda desactivado sin
// romper el resto del sistema (los pedidos se siguen cobrando igual).
const SHEETS_CONFIGURADO = !!(
  process.env.GOOGLE_SHEET_ID &&
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
);

let sheetsClient = null;
if (SHEETS_CONFIGURADO) {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // en la variable de entorno los saltos de linea quedan como "\n" literal, hay que restaurarlos
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
}

const SHEET_NOMBRE = 'Pedidos';
const SHEET_ENCABEZADOS = [
  'ID', 'Fecha/Hora', 'Cliente', 'Items', 'Total', 'Metodo', 'Estado', 'Listo', 'Creado por',
];

function pedidoAFila(pedido) {
  return [
    pedido.id,
    new Date(pedido.creadoEn).toLocaleString('es-AR'),
    pedido.cliente,
    pedido.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(' | '),
    pedido.total,
    pedido.metodo,
    pedido.estado,
    pedido.listo ? 'SI' : 'NO',
    pedido.creadoPor || '',
  ];
}

// Asegura que la hoja tenga el encabezado (solo la primera vez que se usa).
async function asegurarEncabezadoSheet() {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NOMBRE}!A1:I1`,
  });
  if (!res.data.values || res.data.values.length === 0) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NOMBRE}!A1:I1`,
      valueInputOption: 'RAW',
      requestBody: { values: [SHEET_ENCABEZADOS] },
    });
  }
}

// Busca si el pedido ya tiene una fila (por su ID en la columna A) y la
// actualiza; si no existe todavia, la agrega al final.
async function sincronizarPedidoEnSheet(pedido) {
  if (!SHEETS_CONFIGURADO) return; // no configurado todavia, no hacemos nada

  try {
    await asegurarEncabezadoSheet();

    const columnaId = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET_NOMBRE}!A:A`,
    });
    const filas = columnaId.data.values || [];
    const indiceFila = filas.findIndex((fila) => fila[0] === pedido.id);

    const fila = pedidoAFila(pedido);

    if (indiceFila === -1) {
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${SHEET_NOMBRE}!A:I`,
        valueInputOption: 'RAW',
        requestBody: { values: [fila] },
      });
    } else {
      const numeroFila = indiceFila + 1; // las filas de Sheets empiezan en 1
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${SHEET_NOMBRE}!A${numeroFila}:I${numeroFila}`,
        valueInputOption: 'RAW',
        requestBody: { values: [fila] },
      });
    }
  } catch (err) {
    // Si falla el respaldo en Sheets, no queremos que se caiga el cobro real.
    console.error('No se pudo sincronizar con Google Sheets:', err.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// ---------- Estado de la tienda (abierta / cerrada) ----------
app.get('/api/estado-tienda', (req, res) => {
  const db = leerDB();
  res.json({ abierta: db.tiendaAbierta });
});

app.post('/api/estado-tienda', (req, res) => {
  const { abierta } = req.body;
  if (typeof abierta !== 'boolean') {
    return res.status(400).json({ error: "Falta el campo 'abierta' (true/false)" });
  }
  const db = leerDB();
  db.tiendaAbierta = abierta;
  guardarDB(db);
  res.json({ abierta: db.tiendaAbierta });
});

// ---------- Crear pedido ----------
app.post('/api/pedidos', async (req, res) => {
  try {
    const dbCheck = leerDB();
    if (!dbCheck.tiendaAbierta) {
      return res.status(403).json({ error: 'La tienda esta cerrada en este momento' });
    }

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
    sincronizarPedidoEnSheet(pedido); // no bloqueamos la respuesta esperando esto

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
  sincronizarPedidoEnSheet(pedido);
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
  sincronizarPedidoEnSheet(pedido);
  res.json(pedido);
});

// ---------- Cancelar pedido ----------
app.post('/api/pedidos/:id/cancelar', (req, res) => {
  const db = leerDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  pedido.estado = 'cancelado';
  guardarDB(db);
  sincronizarPedidoEnSheet(pedido);
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
        sincronizarPedidoEnSheet(pedido);
      }
    }

    // Siempre respondemos 200 rapido, MP reintenta si no le contestamos bien.
    res.sendStatus(200);
  } catch (err) {
    console.error('Error procesando webhook:', err);
    res.sendStatus(200); // igual devolvemos 200 para que MP no reintente en loop por un error nuestro
  }
});

// ---------- Metricas de pedidos ----------
app.get('/api/metricas', (req, res) => {
  const db = leerDB();
  const pagados = db.pedidos.filter((p) => p.estado === 'pagado');

  const totalFacturado = pagados.reduce((acc, p) => acc + p.total, 0);
  const cantidadPedidos = pagados.length;
  const ticketPromedio = cantidadPedidos > 0 ? totalFacturado / cantidadPedidos : 0;

  // ranking de productos mas pedidos (por cantidad)
  const conteoProductos = {};
  pagados.forEach((p) => {
    p.items.forEach((it) => {
      conteoProductos[it.nombre] = (conteoProductos[it.nombre] || 0) + Number(it.cantidad);
    });
  });
  const rankingProductos = Object.entries(conteoProductos)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // ventas agrupadas por dia (para los ultimos 14 dias con datos)
  const ventasPorDia = {};
  pagados.forEach((p) => {
    const dia = new Date(p.pagadoEn || p.creadoEn).toLocaleDateString('es-AR');
    if (!ventasPorDia[dia]) ventasPorDia[dia] = { dia, total: 0, cantidad: 0 };
    ventasPorDia[dia].total += p.total;
    ventasPorDia[dia].cantidad += 1;
  });
  const historialDiario = Object.values(ventasPorDia).sort(
    (a, b) => new Date(a.dia.split('/').reverse().join('-')) - new Date(b.dia.split('/').reverse().join('-'))
  );

  res.json({
    totalFacturado,
    cantidadPedidos,
    ticketPromedio,
    pendientes: db.pedidos.filter((p) => p.estado === 'pendiente').length,
    cancelados: db.pedidos.filter((p) => p.estado === 'cancelado').length,
    rankingProductos,
    historialDiario,
    sheetsConfigurado: SHEETS_CONFIGURADO,
    sheetUrl: SHEETS_CONFIGURADO ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : null,
  });
});

// ---------- Exportar todos los pedidos a un archivo Excel ----------
app.get('/api/exportar-excel', async (req, res) => {
  try {
    const db = leerDB();
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Pedidos');

    hoja.columns = [
      { header: 'ID', key: 'id', width: 14 },
      { header: 'Fecha/Hora', key: 'fecha', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 20 },
      { header: 'Items', key: 'items', width: 50 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Metodo', key: 'metodo', width: 14 },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Listo', key: 'listo', width: 10 },
      { header: 'Creado por', key: 'creadoPor', width: 18 },
    ];
    hoja.getRow(1).font = { bold: true };

    db.pedidos
      .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
      .forEach((p) => {
        hoja.addRow({
          id: p.id,
          fecha: new Date(p.creadoEn).toLocaleString('es-AR'),
          cliente: p.cliente,
          items: p.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(' | '),
          total: p.total,
          metodo: p.metodo,
          estado: p.estado,
          listo: p.listo ? 'SI' : 'NO',
          creadoPor: p.creadoPor || '',
        });
      });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="chiche-pedidos.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exportando a Excel:', err);
    res.status(500).json({ error: 'No se pudo generar el Excel' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de cobros de Chiche Hamburguesería corriendo en el puerto ${PORT}`);
});
