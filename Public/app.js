// Chiche — Panel de cobros — diseño nuevo + lógica real conectada a server.js

const PRODUCTS = [
  { id: 'promo1', name: 'Promo 1', price: 10800, category: 'Hamburguesas' },
  { id: 'promo2', name: 'Promo 2', price: 11000, category: 'Hamburguesas' },
  { id: 'promo3', name: 'Promo 3', price: 11000, category: 'Hamburguesas' },
  { id: 'promo4', name: 'Promo 4', price: 11000, category: 'Hamburguesas' },
  { id: 'promo5', name: 'Promo 5', price: 9700, category: 'Hamburguesas' },
  { id: 'promo6', name: 'Promo 6', price: 9700, category: 'Hamburguesas' },
  { id: 'promo7', name: 'Promo 7 Mega Chiche', price: 13500, category: 'Hamburguesas' },
  { id: 'promo8', name: 'Promo 8 Mega Doble', price: 13500, category: 'Hamburguesas' },
  { id: 'promo9', name: 'Promo 9 Mega Duo 2x1', price: 13500, category: 'Hamburguesas' },
  { id: 'papas-cono', name: 'Papas Fritas Cono', price: 4800, category: 'Papas Fritas' },
  { id: 'papas-caja', name: 'Papas Fritas Caja', price: 3200, category: 'Papas Fritas' },
  { id: 'pepsi', name: 'Pepsi 500ml', price: 3000, category: 'Bebidas' },
  { id: '7up', name: '7up 500ml', price: 3000, category: 'Bebidas' },
  { id: 'mirinda', name: 'Mirinda 500ml', price: 3000, category: 'Bebidas' },
  { id: 'agua-mineral', name: 'Agua Mineral', price: 2500, category: 'Bebidas' },
];
const CATEGORY_ORDER = ['Hamburguesas', 'Papas Fritas', 'Bebidas'];

let nextItemId = 1;
let items = [];          // filas del pedido actual: {id, productId, qty, customName, customPrice}
let paymentMethod = 'mercadopago';
let pollingInterval = null;

const el = {
  employeeName: document.getElementById('employeeName'),
  customerName: document.getElementById('customerName'),
  itemsList: document.getElementById('itemsList'),
  addItemBtn: document.getElementById('addItemBtn'),
  payMP: document.getElementById('payMercadoPago'),
  payTransfer: document.getElementById('payTransferencia'),
  totalAmount: document.getElementById('totalAmount'),
  generateBtn: document.getElementById('generateChargeBtn'),
  ordersList: document.getElementById('ordersList'),
  ordersEmpty: document.getElementById('ordersEmpty'),
  orderCount: document.getElementById('orderCount'),
  itemRowTpl: document.getElementById('itemRowTemplate'),
  orderCardTpl: document.getElementById('orderCardTemplate'),
  panelPedidoActivo: document.getElementById('panelPedidoActivo'),
  detallePedidoActivo: document.getElementById('detallePedidoActivo'),
};

// recordar el nombre del empleado entre sesiones (en memoria de este dispositivo)
el.employeeName.value = localStorage.getItem('empleadoGuardado') || '';
el.employeeName.addEventListener('change', () => {
  localStorage.setItem('empleadoGuardado', el.employeeName.value);
});

function formatPrice(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function itemPrice(item) {
  if (item.productId === 'custom') return Number(item.customPrice) || 0;
  const p = findProduct(item.productId);
  return p ? p.price : 0;
}

function itemName(item) {
  if (item.productId === 'custom') return item.customName.trim();
  const p = findProduct(item.productId);
  return p ? p.name : '';
}

function itemIsValid(item) {
  if (!item.productId) return false;
  if (Number(item.qty) <= 0) return false;
  if (item.productId === 'custom') {
    return !!(item.customName && item.customName.trim()) && Number(item.customPrice) > 0;
  }
  return true;
}

function computeTotal() {
  return items.reduce((sum, it) => sum + itemPrice(it) * (Number(it.qty) || 0), 0);
}

function addItem() {
  items.push({ id: nextItemId++, productId: '', qty: 1, customName: '', customPrice: '' });
  renderItems();
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  if (items.length === 0) items.push({ id: nextItemId++, productId: '', qty: 1, customName: '', customPrice: '' });
  renderItems();
}

function buildProductOptions(select, selectedId) {
  select.innerHTML = '<option value="">Elegí un producto...</option>';
  CATEGORY_ORDER.forEach((cat) => {
    const group = document.createElement('optgroup');
    group.label = cat;
    PRODUCTS.filter((p) => p.category === cat).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} — ${formatPrice(p.price)}`;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Otro (escribir manualmente)';
  select.appendChild(customOpt);
  select.value = selectedId || '';
}

function renderItems() {
  el.itemsList.innerHTML = '';
  items.forEach((item) => {
    const node = el.itemRowTpl.content.firstElementChild.cloneNode(true);
    const select = node.querySelector('[data-field="product"]');
    const qtyInput = node.querySelector('[data-field="qty"]');
    const removeBtn = node.querySelector('[data-action="remove"]');
    const customBox = node.querySelector('[data-custom]');
    const customNameInput = node.querySelector('[data-field="customName"]');
    const customPriceInput = node.querySelector('[data-field="customPrice"]');

    buildProductOptions(select, item.productId);
    qtyInput.value = item.qty;
    customNameInput.value = item.customName;
    customPriceInput.value = item.customPrice;
    customBox.hidden = item.productId !== 'custom';

    select.addEventListener('change', (e) => {
      item.productId = e.target.value;
      renderItems();
    });
    qtyInput.addEventListener('input', (e) => {
      item.qty = Math.max(1, Number(e.target.value) || 1);
      updateTotals();
    });
    customNameInput.addEventListener('input', (e) => {
      item.customName = e.target.value;
      updateTotals();
    });
    customPriceInput.addEventListener('input', (e) => {
      item.customPrice = e.target.value;
      updateTotals();
    });
    removeBtn.addEventListener('click', () => removeItem(item.id));

    el.itemsList.appendChild(node);
  });
  updateTotals();
}

function updateTotals() {
  const total = computeTotal();
  el.totalAmount.textContent = formatPrice(total);
  const valid = items.some((it) => itemIsValid(it));
  el.generateBtn.disabled = !(el.customerName.value.trim() && el.employeeName.value.trim() && valid);
}

function setPaymentMethod(method) {
  paymentMethod = method;
  el.payMP.classList.toggle('active', method === 'mercadopago');
  el.payTransfer.classList.toggle('active', method === 'transferencia');
}

// ---------- Generar cobro (conectado de verdad al servidor) ----------
async function generateCharge() {
  const valid = items.filter((it) => itemIsValid(it));
  if (!el.customerName.value.trim() || valid.length === 0) return;
  if (!el.employeeName.value.trim()) {
    alert('Poné tu nombre arriba para dejar registro de quién generó el cobro.');
    return;
  }

  const body = {
    cliente: el.customerName.value.trim(),
    empleado: el.employeeName.value.trim(),
    metodo: paymentMethod,
    items: valid.map((it) => ({
      nombre: itemName(it),
      cantidad: Number(it.qty),
      precio: itemPrice(it),
    })),
  };

  el.generateBtn.disabled = true;
  el.generateBtn.textContent = 'Generando...';

  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Error al crear el pedido');
    const pedido = await res.json();

    mostrarPedidoActivo(pedido);

    // reset del formulario
    el.customerName.value = '';
    items = [{ id: nextItemId++, productId: '', qty: 1, customName: '', customPrice: '' }];
    renderItems();
    cargarPedidos();
  } catch (err) {
    alert('No se pudo generar el cobro. Probá de nuevo.');
  } finally {
    el.generateBtn.textContent = 'Generar cobro';
    updateTotals();
  }
}

// ---------- Pedido activo: QR / link / estado en vivo ----------
function mostrarPedidoActivo(pedido) {
  el.panelPedidoActivo.classList.remove('hidden');
  renderPedidoActivo(pedido);
  el.panelPedidoActivo.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (pollingInterval) clearInterval(pollingInterval);

  if (pedido.metodo === 'mercadopago' && pedido.estado === 'pendiente') {
    pollingInterval = setInterval(async () => {
      const res = await fetch(`/api/pedidos/${pedido.id}`);
      const actualizado = await res.json();
      renderPedidoActivo(actualizado);
      if (actualizado.estado !== 'pendiente') {
        clearInterval(pollingInterval);
        cargarPedidos();
      }
    }, 4000);
  }
}

function renderPedidoActivo(pedido) {
  const puedeProceder = pedido.estado === 'pagado';

  let bloquePago = '';
  if (pedido.metodo === 'mercadopago') {
    bloquePago = pedido.estado === 'pendiente'
      ? `
        <div class="qr-container">
          <img src="${pedido.qr}" alt="QR de pago" />
        </div>
        <a class="link-pago" href="${pedido.linkPago}" target="_blank">${pedido.linkPago}</a>
        <p class="esperando">⏳ Esperando confirmación automática de Mercado Pago...</p>
      `
      : `<p class="confirmado-msg">✅ Pago confirmado automáticamente por Mercado Pago.</p>`;
  } else {
    bloquePago = pedido.estado === 'pendiente'
      ? `<p class="active-order-items">Pedile al cliente que transfiera y verificá en el resumen bancario antes de confirmar.</p>
         <button class="btn-confirmar-manual" onclick="confirmarManual('${pedido.id}')">
           Confirmar transferencia recibida
         </button>`
      : `<p class="confirmado-msg">✅ Transferencia confirmada por ${pedido.confirmadoPor || 'empleado'}.</p>`;
  }

  el.detallePedidoActivo.innerHTML = `
    <span class="badge ${pedido.estado}">${pedido.estado.toUpperCase()}</span>
    <div class="active-order-summary">${pedido.cliente} — ${formatPrice(pedido.total)}</div>
    <div class="active-order-items">${pedido.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}</div>
    ${bloquePago}
    <button class="btn-proceder ${puedeProceder ? 'habilitado' : 'deshabilitado'}" ${puedeProceder ? '' : 'disabled'}>
      ${puedeProceder ? '✅ Proceder con el pedido' : '🔒 Bloqueado hasta confirmar el pago'}
    </button>
  `;
}

async function confirmarManual(id) {
  const empleado = el.employeeName.value.trim();
  const res = await fetch(`/api/pedidos/${id}/confirmar-manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empleado }),
  });
  const pedido = await res.json();
  renderPedidoActivo(pedido);
  cargarPedidos();
}
window.confirmarManual = confirmarManual;

// ---------- Sonido de aviso (se genera con el navegador, sin archivos externos) ----------
function reproducirSonidoAviso() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (err) {
    console.error('No se pudo reproducir el sonido de aviso:', err);
  }
}

let idsYaAvisados = new Set();
let primeraCargaDePedidos = true;

// ---------- Lista de pedidos de hoy (datos reales del servidor) ----------
function renderOrders(pedidos) {
  el.orderCount.textContent = pedidos.length;
  el.ordersEmpty.hidden = pedidos.length > 0;
  el.ordersList.innerHTML = '';

  let hayPedidoNuevoPagado = false;

  pedidos.forEach((order) => {
    if (order.estado === 'pagado' && !idsYaAvisados.has(order.id)) {
      if (!primeraCargaDePedidos) hayPedidoNuevoPagado = true;
      idsYaAvisados.add(order.id);
    }

    const node = el.orderCardTpl.content.firstElementChild.cloneNode(true);
    const badge = node.querySelector('[data-field="badge"]');
    badge.textContent = order.estado.toUpperCase();
    badge.classList.add(order.estado);
    node.querySelector('[data-field="customerName"]').textContent = order.cliente;
    node.querySelector('[data-field="itemsSummary"]').textContent =
      order.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ');
    node.querySelector('[data-field="time"]').textContent =
      new Date(order.creadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const listoSlot = node.querySelector('[data-field="listoSlot"]');
    if (order.estado === 'pagado') {
      if (order.listo) {
        listoSlot.innerHTML = `<span class="badge listo-badge">✅ LISTO PARA RETIRAR</span>`;
      } else {
        const btn = document.createElement('button');
        btn.className = 'btn-marcar-listo';
        btn.type = 'button';
        btn.textContent = 'Marcar como listo';
        btn.addEventListener('click', () => marcarComoListo(order.id, btn));
        listoSlot.appendChild(btn);
      }
    }

    el.ordersList.appendChild(node);
  });

  if (hayPedidoNuevoPagado) reproducirSonidoAviso();
  primeraCargaDePedidos = false;
}

async function marcarComoListo(id, boton) {
  boton.disabled = true;
  boton.textContent = 'Marcando...';
  try {
    const res = await fetch(`/api/pedidos/${id}/marcar-listo`, { method: 'POST' });
    if (!res.ok) throw new Error('No se pudo marcar como listo');
    cargarPedidos();
  } catch (err) {
    alert('No se pudo marcar el pedido como listo. Probá de nuevo.');
    boton.disabled = false;
    boton.textContent = 'Marcar como listo';
  }
}

async function cargarPedidos() {
  const res = await fetch('/api/pedidos');
  const pedidos = await res.json();
  const hoy = new Date().toDateString();
  const deHoy = pedidos.filter((p) => new Date(p.creadoEn).toDateString() === hoy);
  renderOrders(deHoy);
}

// Eventos
el.addItemBtn.addEventListener('click', addItem);
el.customerName.addEventListener('input', updateTotals);
el.payMP.addEventListener('click', () => setPaymentMethod('mercadopago'));
el.payTransfer.addEventListener('click', () => setPaymentMethod('transferencia'));
el.generateBtn.addEventListener('click', generateCharge);

// Init
items.push({ id: nextItemId++, productId: '', qty: 1, customName: '', customPrice: '' });
renderItems();
cargarPedidos();
setInterval(cargarPedidos, 15000);
