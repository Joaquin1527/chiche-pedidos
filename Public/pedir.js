// Chiche — App de pedido del cliente

// Tiempo estimado que se le muestra al cliente al confirmar el pago.
// Ajustable acá si en algún momento cambia según la demanda del local.
const TIEMPO_ESTIMADO_MINUTOS = 20;

// ---------- Datos del menú ----------
// "ingredientes": lo que trae CADA promo (para poder sacarlos individualmente).
// La carne y el pan no se listan porque son la base, no se sacan.
// "extrasDisponibles": subconjunto de EXTRAS que tiene sentido ofrecer en esa promo
// (no repetimos lo que ya trae, y en las mas simples no forzamos agregados pesados).
const PROMOS = [
  { id: 'promo1', nombre: 'Promo 1', descripcion: 'Carne 120gr, queso, pan de papa + caja de papas.', precio: 10800, imagen: 'img/promo1.png',
    ingredientes: ['Queso'], extrasDisponibles: ['Cheddar', 'Jamón', 'Panceta', 'Huevo', 'Medallón carne'] },
  { id: 'promo2', nombre: 'Promo 2', descripcion: 'Carne 120gr, queso, tomate, huevo, pan de papa + caja de papas.', precio: 11000, imagen: 'img/promo2.png',
    ingredientes: ['Queso', 'Tomate', 'Huevo'], extrasDisponibles: ['Cheddar', 'Jamón', 'Panceta', 'Medallón carne'] },
  { id: 'promo3', nombre: 'Promo 3', descripcion: 'Carne 120gr, cheddar, panceta, cebolla caramelizada, pan de papa + caja de papas.', precio: 11000, imagen: 'img/promo3.png',
    ingredientes: ['Cheddar', 'Panceta', 'Cebolla caramelizada'], extrasDisponibles: ['Queso Tybo', 'Jamón', 'Huevo', 'Medallón carne'] },
  { id: 'promo4', nombre: 'Promo 4', descripcion: 'Carne 120gr, huevo, lechuga, tomate, jamón, queso, pan de papa + caja de papas.', precio: 11000, imagen: 'img/promo4.png',
    ingredientes: ['Huevo', 'Lechuga', 'Tomate', 'Jamón', 'Queso'], extrasDisponibles: ['Cheddar', 'Panceta', 'Medallón carne'] },
  { id: 'promo5', nombre: 'Promo 5', descripcion: 'Carne 80gr, queso, cebolla caramelizada, pan de papa + caja de papas.', precio: 9700, imagen: 'img/promo5.png',
    ingredientes: ['Queso', 'Cebolla caramelizada'], extrasDisponibles: ['Cheddar', 'Jamón', 'Panceta', 'Huevo', 'Medallón carne'] },
  { id: 'promo6', nombre: 'Promo 6', descripcion: 'Carne 80gr, lechuga, tomate, pan de papa + caja de papas.', precio: 9700, imagen: 'img/promo6.png',
    ingredientes: ['Lechuga', 'Tomate'], extrasDisponibles: ['Queso Tybo', 'Jamón', 'Huevo', 'Medallón carne'] },
  { id: 'promo7', nombre: 'Promo 7 Mega Chiche', descripcion: 'Doble carne 120gr, doble cheddar, panceta, cebolla caramelizada, pan de papa + caja de papas.', precio: 13500, imagen: 'img/promo7.png',
    ingredientes: ['Cheddar', 'Panceta', 'Cebolla caramelizada'], extrasDisponibles: ['Queso Tybo', 'Jamón', 'Huevo', 'Medallón carne'] },
  { id: 'promo8', nombre: 'Promo 8 Mega Doble', descripcion: 'Doble carne 120gr, doble cheddar, panceta, cebolla caramelizada, pan de papa + caja de papas.', precio: 13500, imagen: 'img/promo8.png',
    ingredientes: ['Cheddar', 'Panceta', 'Cebolla caramelizada'], extrasDisponibles: ['Queso Tybo', 'Jamón', 'Huevo', 'Medallón carne'] },
  { id: 'promo9', nombre: 'Promo 9 Mega Duo 2x1', descripcion: '2 hamburguesas (combo 5 y/o 6) + caja de papas.', precio: 13500, imagen: 'img/promo9.png',
    ingredientes: ['Queso (combo 5)', 'Cebolla caramelizada (combo 5)', 'Lechuga (combo 6)', 'Tomate (combo 6)'], extrasDisponibles: ['Jamón', 'Huevo', 'Medallón carne'] },
];

const PAPAS = [
  { id: 'papas-cono', nombre: 'Papas Fritas Cono', precio: 4800 },
  { id: 'papas-caja', nombre: 'Papas Fritas Caja', precio: 3200 },
];

const BEBIDAS = [
  { id: 'pepsi', nombre: 'Pepsi 500ml', precio: 3000 },
  { id: '7up', nombre: '7up 500ml', precio: 3000 },
  { id: 'mirinda', nombre: 'Mirinda 500ml', precio: 3000 },
  { id: 'agua-mineral', nombre: 'Agua Mineral', precio: 2500 },
];

// Salsas y extras: son los mismos para todas las promos.
const SALSAS = [
  '4 quesos c/queso crema', 'Ajo, perejil y mayo', 'Albahaca y mayo', 'Barbacoa',
  'Salsa cheddar', 'Criolla', 'Chimi y mayo', 'Picante', 'Mayonesa', 'Mostaza', 'Ketchup',
];

const EXTRAS = [
  { nombre: 'Medallón carne', precio: 3200 },
  { nombre: 'Queso Tybo', precio: 1000 },
  { nombre: 'Cheddar', precio: 1000 },
  { nombre: 'Jamón', precio: 1000 },
  { nombre: 'Panceta', precio: 1000 },
  { nombre: 'Huevo', precio: 800 },
];

// Los extras disponibles ya vienen definidos a mano por promo (campo
// "extrasDisponibles" en PROMOS) — evita ofrecer combinaciones que no tienen
// sentido, como cheddar/panceta en una promo simple de lechuga y tomate.
function extrasDisponiblesPara(producto) {
  return EXTRAS.filter((extra) => producto.extrasDisponibles.includes(extra.nombre));
}

const CATEGORIAS = [
  { key: 'Hamburguesas', emoji: '🍔', productos: PROMOS, personalizable: true },
  { key: 'Papas Fritas', emoji: '🍟', productos: PAPAS, personalizable: false },
  { key: 'Bebidas', emoji: '🥤', productos: BEBIDAS, personalizable: false },
];

// ---------- Estado ----------
let categoriaActiva = 'Hamburguesas';
let carrito = []; // { id, tipo, nombre, salsa, extras, observaciones, cantidad, precioUnitario, subtotal }
let productoEnEdicion = null;
let cantidadEnEdicion = 1;

const $ = (id) => document.getElementById(id);
const el = {
  tabs: $('tabs'),
  menuList: $('menuList'),
  cartBar: $('cartBar'),
  cartCount: $('cartCount'),
  cartTotal: $('cartTotal'),

  detailOverlay: $('detailOverlay'),
  detailHero: $('detailHero'),
  detailName: $('detailName'),
  detailDesc: $('detailDesc'),
  detailPrice: $('detailPrice'),
  salsaOptions: $('salsaOptions'),
  ingredientesSection: $('ingredientesSection'),
  ingredientesOptions: $('ingredientesOptions'),
  extrasOptions: $('extrasOptions'),
  observaciones: $('observaciones'),
  qtyValue: $('qtyValue'),
  addPrice: $('addPrice'),

  cartOverlay: $('cartOverlay'),
  cartItems: $('cartItems'),
  cartOverlayTotal: $('cartOverlayTotal'),
  clienteNombre: $('clienteNombre'),
  clienteTelefono: $('clienteTelefono'),
  confirmOrder: $('confirmOrder'),

  successOverlay: $('successOverlay'),
  successIcon: $('successIcon'),
  successTitle: $('successTitle'),
  successMsg: $('successMsg'),
  estimatedTime: $('estimatedTime'),
  paymentOverlay: $('paymentOverlay'),
  paymentQr: $('paymentQr'),
  paymentLink: $('paymentLink'),
  paymentWaitingMsg: $('paymentWaitingMsg'),
  paymentFailedBox: $('paymentFailedBox'),
};

let pollingPago = null;
let pollingListo = null;

function formatPrice(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

// ---------- Tabs de categoría ----------
function renderTabs() {
  el.tabs.innerHTML = CATEGORIAS.map((cat) => `
    <button class="tab ${cat.key === categoriaActiva ? 'active' : ''}" data-cat="${cat.key}">${cat.emoji} ${cat.key}</button>
  `).join('');
  el.tabs.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      categoriaActiva = btn.dataset.cat;
      renderTabs();
      renderMenu();
    });
  });
}

// ---------- Lista de productos ----------
function cantidadEnCarrito(productoId) {
  return carrito
    .filter((it) => it.productoId === productoId)
    .reduce((sum, it) => sum + it.cantidad, 0);
}

function iconoProducto(p, cat) {
  return p.imagen
    ? `<img src="${p.imagen}" alt="${p.nombre}" class="product-photo" />`
    : `<div class="product-emoji">${cat.emoji}</div>`;
}

function renderMenu() {
  const cat = CATEGORIAS.find((c) => c.key === categoriaActiva);
  el.menuList.innerHTML = cat.productos.map((p) => {
    if (cat.personalizable) {
      return `
        <div class="product-card" data-id="${p.id}">
          ${iconoProducto(p, cat)}
          <div class="product-info">
            <div class="product-name">${p.nombre}</div>
            <div class="product-desc">${p.descripcion}</div>
            <div class="product-price">${formatPrice(p.precio)}</div>
          </div>
          <button class="product-add-btn" type="button" aria-label="Agregar">+</button>
        </div>
      `;
    }
    const cantidad = cantidadEnCarrito(p.id);
    return `
      <div class="product-card">
        ${iconoProducto(p, cat)}
        <div class="product-info">
          <div class="product-name">${p.nombre}</div>
          <div class="product-price">${formatPrice(p.precio)}</div>
        </div>
        <div class="simple-stepper">
          <button class="stepper-btn" type="button" data-action="quitar" data-id="${p.id}">−</button>
          <span class="simple-qty">${cantidad}</span>
          <button class="stepper-btn" type="button" data-action="sumar" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
  }).join('');

  if (cat.personalizable) {
    el.menuList.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => abrirDetalle(cat.productos.find((p) => p.id === card.dataset.id)));
    });
  } else {
    el.menuList.querySelectorAll('[data-action="sumar"]').forEach((btn) => {
      btn.addEventListener('click', () => agregarSimple(cat.productos.find((p) => p.id === btn.dataset.id)));
    });
    el.menuList.querySelectorAll('[data-action="quitar"]').forEach((btn) => {
      btn.addEventListener('click', () => quitarSimple(btn.dataset.id));
    });
  }
}

// ---------- Productos simples (papas, bebidas): se agregan directo con +/- ----------
function agregarSimple(producto) {
  const existente = carrito.find((it) => it.productoId === producto.id);
  if (existente) {
    existente.cantidad += 1;
    existente.subtotal = existente.precioUnitario * existente.cantidad;
  } else {
    carrito.push({
      id: `${producto.id}-${Date.now()}`,
      productoId: producto.id,
      tipo: 'simple',
      nombre: producto.nombre,
      salsa: null,
      extras: [],
      observaciones: '',
      cantidad: 1,
      precioUnitario: producto.precio,
      subtotal: producto.precio,
    });
  }
  renderMenu();
  actualizarCartBar();
}

function quitarSimple(productoId) {
  const existente = carrito.find((it) => it.productoId === productoId);
  if (!existente) return;
  existente.cantidad -= 1;
  if (existente.cantidad <= 0) {
    carrito = carrito.filter((it) => it.id !== existente.id);
  } else {
    existente.subtotal = existente.precioUnitario * existente.cantidad;
  }
  renderMenu();
  actualizarCartBar();
}

// ---------- Detalle de hamburguesa: salsa + extras + observaciones + cantidad ----------
function abrirDetalle(producto) {
  productoEnEdicion = producto;
  cantidadEnEdicion = 1;

  el.detailName.textContent = producto.nombre;
  el.detailDesc.textContent = producto.descripcion;
  el.detailPrice.textContent = formatPrice(producto.precio);
  el.observaciones.value = '';
  el.qtyValue.textContent = '1';

  if (producto.imagen) {
    el.detailHero.innerHTML = `<img src="${producto.imagen}" alt="${producto.nombre}" class="detail-hero-photo" />`;
  } else {
    el.detailHero.textContent = '🍔';
  }

  el.salsaOptions.innerHTML = SALSAS.map((salsa, i) => `
    <label class="option-row">
      <span class="option-label">${salsa}</span>
      <input type="radio" name="salsa" class="option-input" value="${salsa}" ${i === 0 ? 'checked' : ''} />
    </label>
  `).join('');

  // Ingredientes que trae ESTA promo puntual — tildados por default (vienen incluidos),
  // si el cliente destilda alguno, se saca de la hamburguesa.
  if (producto.ingredientes.length > 0) {
    el.ingredientesSection.classList.remove('hidden');
    el.ingredientesOptions.innerHTML = producto.ingredientes.map((ing) => `
      <label class="option-row">
        <span class="option-label">${ing}</span>
        <input type="checkbox" class="option-input ingrediente-check" value="${ing}" checked />
      </label>
    `).join('');
  } else {
    el.ingredientesSection.classList.add('hidden');
    el.ingredientesOptions.innerHTML = '';
  }

  // Extras: solo los que tiene sentido ofrecer (no lo que ya trae de base esta promo).
  const extrasDisponibles = extrasDisponiblesPara(producto);
  el.extrasOptions.innerHTML = extrasDisponibles.map((extra) => `
    <label class="option-row">
      <span class="option-label">${extra.nombre} <span class="option-extra-price">(+${formatPrice(extra.precio)})</span></span>
      <input type="checkbox" class="option-input extra-check" value="${extra.nombre}" data-precio="${extra.precio}" />
    </label>
  `).join('');

  el.extrasOptions.querySelectorAll('.extra-check').forEach((chk) => {
    chk.addEventListener('change', actualizarPrecioDetalle);
  });

  actualizarPrecioDetalle();
  el.detailOverlay.classList.remove('hidden');
}

function ingredientesQuitados() {
  return [...el.ingredientesOptions.querySelectorAll('.ingrediente-check:not(:checked)')]
    .map((chk) => chk.value);
}

function extrasSeleccionados() {
  return [...el.extrasOptions.querySelectorAll('.extra-check:checked')]
    .map((chk) => ({ nombre: chk.value, precio: Number(chk.dataset.precio) }));
}

function actualizarPrecioDetalle() {
  const extras = extrasSeleccionados();
  const extrasTotal = extras.reduce((sum, ex) => sum + ex.precio, 0);
  const precioUnitario = productoEnEdicion.precio + extrasTotal;
  el.addPrice.textContent = formatPrice(precioUnitario * cantidadEnEdicion);
}

$('qtyPlus').addEventListener('click', () => {
  cantidadEnEdicion += 1;
  el.qtyValue.textContent = cantidadEnEdicion;
  actualizarPrecioDetalle();
});
$('qtyMinus').addEventListener('click', () => {
  cantidadEnEdicion = Math.max(1, cantidadEnEdicion - 1);
  el.qtyValue.textContent = cantidadEnEdicion;
  actualizarPrecioDetalle();
});

$('closeDetail').addEventListener('click', () => el.detailOverlay.classList.add('hidden'));
$('cancelDetail').addEventListener('click', () => el.detailOverlay.classList.add('hidden'));

$('addToCart').addEventListener('click', () => {
  const salsa = el.salsaOptions.querySelector('input[name="salsa"]:checked')?.value || null;
  const sinIngredientes = ingredientesQuitados();
  const extras = extrasSeleccionados();
  const extrasTotal = extras.reduce((sum, ex) => sum + ex.precio, 0);
  const precioUnitario = productoEnEdicion.precio + extrasTotal;

  carrito.push({
    id: `${productoEnEdicion.id}-${Date.now()}`,
    productoId: productoEnEdicion.id,
    tipo: 'promo',
    nombre: productoEnEdicion.nombre,
    salsa,
    sinIngredientes,
    extras,
    observaciones: el.observaciones.value.trim(),
    cantidad: cantidadEnEdicion,
    precioUnitario,
    subtotal: precioUnitario * cantidadEnEdicion,
  });

  el.detailOverlay.classList.add('hidden');
  actualizarCartBar();
});

// ---------- Barra flotante del carrito ----------
function actualizarCartBar() {
  const totalItems = carrito.reduce((sum, it) => sum + it.cantidad, 0);
  const total = carrito.reduce((sum, it) => sum + it.subtotal, 0);
  el.cartCount.textContent = totalItems;
  el.cartTotal.textContent = formatPrice(total);
  el.cartBar.classList.toggle('hidden', totalItems === 0);
}

el.cartBar.addEventListener('click', abrirCarrito);

// ---------- Overlay del carrito ----------
function abrirCarrito() {
  renderCarrito();
  el.cartOverlay.classList.remove('hidden');
}

function renderCarrito() {
  el.cartItems.innerHTML = carrito.map((it) => {
    const detalles = [];
    if (it.salsa) detalles.push(`Salsa: ${it.salsa}`);
    if (it.sinIngredientes && it.sinIngredientes.length) detalles.push(`Sin: ${it.sinIngredientes.join(', ')}`);
    if (it.extras.length) detalles.push(`Extras: ${it.extras.map((e) => e.nombre).join(', ')}`);
    if (it.observaciones) detalles.push(`"${it.observaciones}"`);

    return `
      <div class="cart-item">
        <div class="cart-item-top">
          <span class="cart-item-name">${it.cantidad}x ${it.nombre}</span>
        </div>
        ${detalles.length ? `<div class="cart-item-detail">${detalles.join(' · ')}</div>` : ''}
        <div class="cart-item-bottom">
          <span class="cart-item-price">${formatPrice(it.subtotal)}</span>
          <button class="cart-item-remove" type="button" data-id="${it.id}">Quitar</button>
        </div>
      </div>
    `;
  }).join('');

  el.cartItems.querySelectorAll('.cart-item-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      carrito = carrito.filter((it) => it.id !== btn.dataset.id);
      renderCarrito();
      actualizarCartBar();
      renderMenu();
      if (carrito.length === 0) el.cartOverlay.classList.add('hidden');
    });
  });

  const total = carrito.reduce((sum, it) => sum + it.subtotal, 0);
  el.cartOverlayTotal.textContent = formatPrice(total);
  validarConfirmar();
}

function validarConfirmar() {
  el.confirmOrder.disabled = !(carrito.length > 0 && el.clienteNombre.value.trim());
}
el.clienteNombre.addEventListener('input', validarConfirmar);

$('closeCart').addEventListener('click', () => el.cartOverlay.classList.add('hidden'));

// Arma un solo texto con salsa + extras + observaciones para que el
// empleado vea el detalle completo del producto dentro del nombre del item.
function nombreCompletoItem(item) {
  const partes = [item.nombre];
  if (item.salsa) partes.push(`(Salsa: ${item.salsa})`);
  if (item.sinIngredientes && item.sinIngredientes.length) partes.push(`SIN: ${item.sinIngredientes.join(', ')}`);
  if (item.extras && item.extras.length) partes.push(`+ ${item.extras.map((e) => e.nombre).join(', ')}`);
  if (item.observaciones) partes.push(`— "${item.observaciones}"`);
  return partes.join(' ');
}

// ---------- Confirmar pedido: genera el cobro real y muestra el QR ----------
$('confirmOrder').addEventListener('click', async () => {
  el.confirmOrder.disabled = true;
  el.confirmOrder.textContent = 'Generando...';

  const body = {
    cliente: el.clienteNombre.value.trim(),
    empleado: 'Pedido online (pedir.html)',
    metodo: 'mercadopago',
    items: carrito.map((it) => ({
      nombre: nombreCompletoItem(it),
      cantidad: it.cantidad,
      precio: it.precioUnitario,
    })),
  };

  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 403) {
      el.cartOverlay.classList.add('hidden');
      $('cerradoOverlay').classList.remove('hidden');
      return;
    }
    if (!res.ok) throw new Error('Error al generar el cobro');
    const pedido = await res.json();

    el.cartOverlay.classList.add('hidden');
    mostrarPago(pedido);

    // reset del carrito (ya quedó registrado el pedido, no hace falta conservarlo)
    carrito = [];
    el.clienteNombre.value = '';
    el.clienteTelefono.value = '';
    actualizarCartBar();
    renderMenu();
  } catch (err) {
    alert('No se pudo generar el cobro. Probá de nuevo.');
  } finally {
    el.confirmOrder.textContent = 'Pagar pedido';
    validarConfirmar();
  }
});

// ---------- Pantalla de pago: QR + link + espera de confirmación ----------
function mostrarPago(pedido) {
  el.paymentQr.src = pedido.qr;
  el.paymentLink.href = pedido.linkPago;
  el.paymentLink.textContent = pedido.linkPago;
  el.paymentWaitingMsg.classList.remove('hidden');
  el.paymentFailedBox.classList.add('hidden');
  el.paymentOverlay.classList.remove('hidden');

  if (pollingPago) clearInterval(pollingPago);
  pollingPago = setInterval(async () => {
    const res = await fetch(`/api/pedidos/${pedido.id}`);
    const actualizado = await res.json();

    if (actualizado.estado === 'pagado') {
      clearInterval(pollingPago);
      el.paymentOverlay.classList.add('hidden');
      mostrarExito(pedido.id);
    } else if (actualizado.estado === 'cancelado') {
      clearInterval(pollingPago);
      el.paymentWaitingMsg.classList.add('hidden');
      el.paymentFailedBox.classList.remove('hidden');
    }
  }, 4000);
}

// ---------- Pantalla de éxito: tiempo estimado + aviso en vivo cuando está listo ----------
function mostrarExito(pedidoId) {
  el.successIcon.textContent = '✅';
  el.successTitle.textContent = '¡Tu pedido está en marcha!';
  el.successMsg.textContent = 'Ya confirmamos tu pago. Chiche Hamburguesería ya lo está preparando.';
  el.estimatedTime.textContent = `⏱️ Tiempo estimado: ${TIEMPO_ESTIMADO_MINUTOS} minutos`;
  el.estimatedTime.classList.remove('listo');
  el.successOverlay.classList.remove('hidden');

  if (pollingListo) clearInterval(pollingListo);
  pollingListo = setInterval(async () => {
    const res = await fetch(`/api/pedidos/${pedidoId}`);
    const actualizado = await res.json();
    if (actualizado.listo) {
      clearInterval(pollingListo);
      el.successIcon.textContent = '🎉';
      el.successTitle.textContent = '¡Tu pedido está listo!';
      el.successMsg.textContent = 'Ya lo podés pasar a buscar por Chiche Hamburguesería.';
      el.estimatedTime.textContent = '✅ Listo para retirar';
      el.estimatedTime.classList.add('listo');
    }
  }, 5000);
}

$('backToMenuBtn').addEventListener('click', () => {
  el.paymentOverlay.classList.add('hidden');
});

$('newOrderBtn').addEventListener('click', () => {
  if (pollingListo) clearInterval(pollingListo);
  el.successOverlay.classList.add('hidden');
});

// ---------- Estado de la tienda: si está cerrada, tapamos todo con un aviso ----------
async function chequearTiendaAbierta() {
  try {
    const res = await fetch('/api/estado-tienda');
    const data = await res.json();
    const cerradoOverlay = $('cerradoOverlay');
    if (!data.abierta) {
      cerradoOverlay.classList.remove('hidden');
    } else {
      cerradoOverlay.classList.add('hidden');
    }
  } catch (err) {
    console.error('No se pudo consultar el estado de la tienda:', err);
  }
}

// ---------- Init ----------
renderTabs();
renderMenu();
actualizarCartBar();
chequearTiendaAbierta();
setInterval(chequearTiendaAbierta, 20000);
