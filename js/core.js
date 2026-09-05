/* ============================================================
   S_QUICK MART — CORE 
   ============================================================ */

const SQM_KEYS = { CART: 'sqm_cart', USER: 'sqm_user', WISH: 'sqm_wishlist' };

/* ---------- generic storage helpers ---------- */
function sqmRead(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { console.error('sqmRead failed', key, e); return fallback; }
}
function sqmWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { console.error('sqmWrite failed', key, e); return false; }
}

/* ---------- currency ---------- */
function sqmCurrency(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

/* ---------- cart key (supports variants, same scheme as original app) ---------- */
function sqmCartKey(pid, vIdx) { return (vIdx === undefined || vIdx === null) ? String(pid) : `${pid}-v${vIdx}`; }

/* ---------- Cart store ---------- */
const CartStore = {
  get() { return sqmRead(SQM_KEYS.CART, {}); },
  save(cart) { sqmWrite(SQM_KEYS.CART, cart); document.dispatchEvent(new CustomEvent('sqm:cart-changed')); },
  add(product, vIdx, qty = 1) {
    const cart = this.get();
    const key = sqmCartKey(product.id, vIdx);
    const variant = (vIdx !== undefined && vIdx !== null) ? product.variants[vIdx] : null;
    if (cart[key]) { cart[key].qty += qty; }
    else {
      cart[key] = {
        id: product.id, vIdx: vIdx ?? null,
        name: product.name + (variant ? ' — ' + variant.unit : ''),
        unit: variant ? variant.unit : product.unit,
        price: variant ? variant.price : product.price,
        mrp: variant ? variant.mrp : product.mrp,
        img: product.img, emoji: product.emoji, qty: qty
      };
    }
    this.save(cart);
  },
  setQty(key, qty) {
    const cart = this.get();
    if (qty <= 0) delete cart[key];
    else if (cart[key]) cart[key].qty = qty;
    this.save(cart);
  },
  remove(key) { const cart = this.get(); delete cart[key]; this.save(cart); },
  clear() { this.save({}); },
  items() { const cart = this.get(); return Object.keys(cart).map(k => ({ key: k, ...cart[k] })); },
  count() { return this.items().reduce((s, i) => s + i.qty, 0); },
  subtotal() { return this.items().reduce((s, i) => s + i.price * i.qty, 0); },
  mrpTotal() { return this.items().reduce((s, i) => s + (i.mrp || i.price) * i.qty, 0); },
  qtyOf(pid) {
    const cart = this.get();
    return Object.keys(cart).reduce((s, k) => (k === String(pid) || k.startsWith(pid + '-v')) ? s + cart[k].qty : s, 0);
  },
  qtyOfKey(key) { const cart = this.get(); return cart[key] ? cart[key].qty : 0; }
};

/* ---------- User / Address store (phone-based, matches original app) ---------- */
const UserStore = {
  get() { return sqmRead(SQM_KEYS.USER, { phone: '', name: '', address: '', area: '' }); },
  save(user) { sqmWrite(SQM_KEYS.USER, user); document.dispatchEvent(new CustomEvent('sqm:user-changed')); },
  isLoggedIn() { const u = this.get(); return !!(u && u.phone); },
  logout() { localStorage.removeItem(SQM_KEYS.USER); document.dispatchEvent(new CustomEvent('sqm:user-changed')); }
};

/* ---------- Wishlist store (heart icon on product cards, Budget-Buy style) ---------- */
const WishStore = {
  get() { return sqmRead(SQM_KEYS.WISH, []); },
  save(ids) { sqmWrite(SQM_KEYS.WISH, ids); document.dispatchEvent(new CustomEvent('sqm:wish-changed')); },
  toggle(id) {
    let ids = this.get();
    const has = ids.includes(id);
    ids = has ? ids.filter(x => x !== id) : [...ids, id];
    this.save(ids);
    return !has;
  },
  has(id) { return this.get().includes(Number(id)) || this.get().includes(id); },
  count() { return this.get().length; }
};
document.addEventListener('sqm:wish-changed', sqmSyncBadges);

/* ---------- toast ---------- */
function sqmToast(msg, type = '') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2200);
}

/* ---------- badge sync (cart count / amount in header) ---------- */
function sqmSyncBadges() {
  const cartCount = CartStore.count();
  document.querySelectorAll('[data-cart-badge]').forEach(el => { el.textContent = cartCount; el.classList.toggle('show', cartCount > 0); });
  document.querySelectorAll('[data-cart-amount]').forEach(el => { el.textContent = sqmCurrency(CartStore.subtotal()); });
  document.querySelectorAll('[data-user-label]').forEach(el => {
    const u = UserStore.get();
    el.textContent = u.name ? u.name.split(' ')[0] : (u.phone ? u.phone : 'Login');
  });
  const wishCount = WishStore.count();
  document.querySelectorAll('[data-wish-badge]').forEach(el => { el.textContent = wishCount; el.classList.toggle('show', wishCount > 0); });
}
function sqmBounceBadge() {
  document.querySelectorAll('[data-cart-badge]').forEach(el => { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); });
}
document.addEventListener('sqm:cart-changed', () => { sqmSyncBadges(); sqmBounceBadge(); });
document.addEventListener('sqm:user-changed', sqmSyncBadges);

/* ---------- header scroll shadow ---------- */
function sqmInitHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- reveal on scroll ---------- */
function sqmInitReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  targets.forEach(t => io.observe(t));
}

/* ---------- store timing (7AM - 10PM, same as original) ---------- */
const SQM_OPEN_HOUR = 7, SQM_CLOSE_HOUR = 22;
function sqmIsOpenByClock() { const h = new Date().getHours(); return h >= SQM_OPEN_HOUR && h < SQM_CLOSE_HOUR; }
function sqmIsOrderable() { return sqmIsOpenByClock() || window._storeOpen === true; }

function sqmRenderTimingBar() {
  const bar = document.getElementById('timingBar');
  if (!bar) return;
  if (sqmIsOpenByClock()) bar.innerHTML = `<span class="open-dot"></span>&nbsp;<span class="timing-status open">OPEN</span>&nbsp;Delivering 7AM–10PM`;
  else bar.innerHTML = `<span class="closed-dot"></span>&nbsp;<span class="timing-status closed">CLOSED</span>&nbsp;Open at 7AM`;
}

function sqmApplyStoreStatus() {
  const isClosed = !sqmIsOpenByClock() && window._storeOpen !== true;
  const overlay = document.getElementById('closedOverlay');
  if (overlay) overlay.classList.toggle('show', isClosed && !window._closedDismissed);
  sqmRenderTimingBar();
}

/* ---------- announcements ---------- */
let sqmAnnounceIndex = 0, sqmAnnounceTimer = null;
function sqmSetAnnounceText(t) {
  const el = document.getElementById('announceTrack');
  if (!el) return;
  el.textContent = '• ' + t.trim();
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'announce-scroll 18s linear infinite';
}
window.renderAnnouncements = function () {
  const items = (window.announceItems || []).filter(t => t && t.trim());
  const bar = document.getElementById('announceBar');
  if (!bar) return;
  if (!items.length) { bar.classList.add('hidden'); if (sqmAnnounceTimer) { clearInterval(sqmAnnounceTimer); sqmAnnounceTimer = null; } return; }
  sqmAnnounceIndex = 0; bar.classList.remove('hidden'); sqmSetAnnounceText(items[0]);
  if (sqmAnnounceTimer) clearInterval(sqmAnnounceTimer);
  if (items.length > 1) sqmAnnounceTimer = setInterval(() => { sqmAnnounceIndex = (sqmAnnounceIndex + 1) % items.length; sqmSetAnnounceText(items[sqmAnnounceIndex]); }, 18000);
};

/* ---------- product helpers ---------- */
function sqmProductById(id) { return (window.products || []).find(p => p.id === Number(id) || p.id === id); }
function sqmDiscount(price, mrp) {
  const m = parseFloat(mrp), pr = parseFloat(price);
  const has = !isNaN(m) && m > pr;
  return { has, pct: has ? Math.round((1 - pr / m) * 100) : 0 };
}
function sqmCatLabel(catId) {
  return (window.catInfo && window.catInfo[catId] && window.catInfo[catId].label) || catId;
}
function sqmCatEmoji(catId) {
  return (window.catInfo && window.catInfo[catId] && window.catInfo[catId].emoji) || '🏪';
}

/* ---------- product card markup (Budget-Buy style shell, S_Quick Mart data) ---------- */
function sqmProductMediaHTML(p) {
  return p.img
    ? `<img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="emoji-fallback" style="display:none;">${p.emoji || '🛒'}</span>`
    : `<span class="emoji-fallback">${p.emoji || '🛒'}</span>`;
}

function sqmActionHTML(p) {
  const oos = p.active === false;
  const pclosed = window._productsClosed === true && !oos;
  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;

  if (oos) return `<button class="not-available-btn" disabled>Not Available</button>`;
  if (pclosed) return `<button class="add-btn" disabled style="opacity:.5;">+ Add</button>`;
  if (hasVariants) {
    const totalQty = CartStore.qtyOf(p.id);
    const optCount = p.variants.length + (p.unit && p.price ? 1 : 0);
    return `<button class="add-btn multi ${totalQty > 0 ? 'in-cart' : ''}" data-action="variant" data-id="${p.id}">
      <span>${totalQty > 0 ? totalQty + ' in cart' : 'ADD'}</span><span class="opt-count">${optCount} options</span>
    </button>`;
  }
  const qty = CartStore.qtyOfKey(String(p.id));
  if (qty > 0) {
    return `<div class="qty-stepper" data-id="${p.id}">
      <button data-action="dec" data-id="${p.id}">−</button><span class="n">${qty}</span><button data-action="inc" data-id="${p.id}">+</button>
    </div>`;
  }
  return `<button class="add-btn" data-action="add" data-id="${p.id}">+ Add</button>`;
}

function sqmProductCardHTML(p) {
  const oos = p.active === false;
  const pclosed = window._productsClosed === true && !oos;
  const disc = sqmDiscount(p.price, p.mrp);
  const wished = (typeof WishStore !== 'undefined' && WishStore.has(p.id));
  return `
  <div class="prod-card ${oos ? 'out-of-stock' : ''}" data-product-id="${p.id}" id="pc-${p.id}">
    <div class="prod-media" ${!oos && !pclosed ? `data-open-detail="${p.id}"` : ''}>
      ${oos ? `<span class="oos-badge">Out of Stock</span>` : (disc.has ? `<span class="prod-discount">${disc.pct}% OFF</span>` : '')}
      ${pclosed ? `<div class="closed-badge"><span>Closed</span></div>` : ''}
      ${sqmProductMediaHTML(p)}
    </div>
    <button class="wish-btn ${wished ? 'active' : ''}" data-wish-id="${p.id}" aria-label="Wishlist">
      <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-10-9.3C.4 8 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.3C11.6 4.7 13.4 3.7 15.4 4c3.6.5 5.2 4 3.6 7.7C19 16.1 12 21 12 21z"/></svg>
    </button>
    <div class="prod-body">
      <div data-open-detail="${p.id}"><h3 class="prod-name">${p.name}</h3></div>
      <span class="prod-qty">${p.unit || ''}</span>
      <div class="prod-price-row">
        <span class="now">${sqmCurrency(p.price)}</span>
        ${disc.has ? `<span class="mrp">${sqmCurrency(p.mrp)}</span>` : ''}
      </div>
      <div class="prod-foot" id="act-${p.id}">${sqmActionHTML(p)}</div>
    </div>
  </div>`;
}

function sqmRenderProductGrid(container, products) {
  if (!container) return;
  if (!products.length) { container.innerHTML = `<p class="text-muted" style="grid-column:1/-1;padding:40px 0;text-align:center;">No products found.</p>`; return; }
  container.innerHTML = products.map(sqmProductCardHTML).join('');
}

function sqmRefreshCard(id) {
  const el = document.getElementById('pc-' + id);
  const act = document.getElementById('act-' + id);
  const p = sqmProductById(id);
  if (!p) return;
  if (act) act.innerHTML = sqmActionHTML(p);
  else if (el) el.outerHTML = sqmProductCardHTML(p);
}

/* ---------- delegated add/inc/dec + open-detail (works across pages) ---------- */
document.addEventListener('click', (e) => {
  const wb = e.target.closest('[data-wish-id]');
  if (wb) {
    const id = Number(wb.dataset.wishId);
    const nowActive = WishStore.toggle(id);
    wb.classList.toggle('active', nowActive);
    wb.classList.remove('pulse'); void wb.offsetWidth; wb.classList.add('pulse');
    sqmToast(nowActive ? 'Added to wishlist' : 'Removed from wishlist', nowActive ? 'success' : '');
    return;
  }
  const openEl = e.target.closest('[data-open-detail]');
  if (openEl && !e.target.closest('button')) {
    location.href = `product-details.html?id=${openEl.dataset.openDetail}`;
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);
  if (!id) return;

  if (action === 'variant') { openVariantModal(id); return; }

  const p = sqmProductById(id);
  if (!p) return;

  if (action === 'add') {
    CartStore.add(p, null, 1);
    sqmToast(`${p.name} added to cart`, 'success');
    sqmRefreshCard(id);
  } else if (action === 'inc') {
    CartStore.setQty(String(id), CartStore.qtyOfKey(String(id)) + 1);
    sqmRefreshCard(id);
  } else if (action === 'dec') {
    CartStore.setQty(String(id), CartStore.qtyOfKey(String(id)) - 1);
    sqmRefreshCard(id);
  }
});
document.addEventListener('sqm:cart-changed', () => {
  document.querySelectorAll('[data-product-id]').forEach(el => sqmRefreshCard(el.dataset.productId));
});

/* ============================================================
   VARIANT MODAL (shared across pages: home/products/details)
   ============================================================ */
function sqmEnsureVariantModal() {
  if (document.getElementById('variantOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="overlay" id="variantOverlay" onclick="if(event.target===this) closeVariantModal()">
      <div class="drawer" id="variantModal" style="max-width:460px;width:92vw;top:50%;left:50%;right:auto;transform:translate(-50%,-50%);height:auto;max-height:80vh;border-radius:var(--r-lg);">
        <div class="cart-head"><h2 style="font-size:16px;" id="vmTitle"></h2><button onclick="closeVariantModal()" style="font-size:20px;">✕</button></div>
        <div id="vmBody" style="padding:18px 22px;overflow-y:auto;"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);
}
function openVariantModal(pid) {
  if (window._productsClosed === true) return;
  sqmEnsureVariantModal();
  const p = sqmProductById(pid);
  if (!p) return;
  document.getElementById('vmTitle').textContent = p.name;
  renderVariantRows(pid);
  document.getElementById('variantOverlay').classList.add('open');
}
function closeVariantModal() { const o = document.getElementById('variantOverlay'); if (o) o.classList.remove('open'); }
function renderVariantRows(pid) {
  const p = sqmProductById(pid);
  const body = document.getElementById('vmBody');
  const rows = [];
  if (p.unit && p.price) rows.push({ vIdx: null, unit: p.unit, price: p.price, mrp: p.mrp });
  (p.variants || []).forEach((v, i) => rows.push({ vIdx: i, unit: v.unit, price: v.price, mrp: v.mrp }));
  body.innerHTML = rows.map(r => {
    const key = sqmCartKey(pid, r.vIdx);
    const qty = CartStore.qtyOfKey(key);
    const disc = sqmDiscount(r.price, r.mrp);
    return `<div class="pd-variant-row">
      <div><div class="vname">${r.unit}</div><div class="vprice">${sqmCurrency(r.price)} ${disc.has ? `<span style="text-decoration:line-through;color:var(--ink-soft);">${sqmCurrency(r.mrp)}</span>` : ''}</div></div>
      ${qty > 0
        ? `<div class="qty-stepper" style="width:auto;"><button onclick="chQtyVariant(${pid},${r.vIdx},-1)">−</button><span class="n" style="padding:0 8px;">${qty}</span><button onclick="chQtyVariant(${pid},${r.vIdx},1)">+</button></div>`
        : `<button class="add-btn" style="width:auto;padding:8px 18px;" onclick="addVariantToCart(${pid},${r.vIdx})">+ Add</button>`}
    </div>`;
  }).join('');
}
function addVariantToCart(pid, vIdx) {
  const p = sqmProductById(pid);
  CartStore.add(p, vIdx, 1);
  renderVariantRows(pid);
  sqmToast(`${p.name} added to cart`, 'success');
}
function chQtyVariant(pid, vIdx, d) {
  const key = sqmCartKey(pid, vIdx);
  CartStore.setQty(key, CartStore.qtyOfKey(key) + d);
  renderVariantRows(pid);
}

/* ---------- header search ---------- */
function sqmInitSearch() {
  const input = document.getElementById('searchInput');
  const drop = document.getElementById('searchDrop');
  const shell = document.getElementById('searchShell');
  if (!input || !drop) return;
  input.addEventListener('input', (e) => sqmRunSearch(e.target.value, drop, shell));
  input.addEventListener('focus', (e) => { if (e.target.value.trim()) sqmRunSearch(e.target.value, drop, shell); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-shell')) shell && shell.classList.remove('is-open'); });
}
function sqmRunSearch(val, drop, shell) {
  const q = val.trim().toLowerCase();
  if (!q) { shell && shell.classList.remove('is-open'); return; }
  const results = (window.products || []).filter(p => {
    const name = (p.name || '').toLowerCase();
    const cat = sqmCatLabel(p.cat).toLowerCase();
    const sub = (p.sub || '').toLowerCase();
    return name.includes(q) || cat.includes(q) || sub.includes(q);
  }).slice(0, 8);
  if (!results.length) { drop.innerHTML = `<div class="group-label">😕 "${val}" not found</div>`; }
  else {
    drop.innerHTML = `<div class="group-label">Products</div>` + results.map(p => {
      const oos = p.active === false;
      const pclosed = window._productsClosed === true && !oos;
      return `
      <a class="row" href="product-details.html?id=${p.id}" style="${oos ? 'opacity:.6;' : ''}">
        <span class="row-img">${p.img ? `<img src="${p.img}">` : p.emoji || '🛒'}</span>
        <span>${p.name}${oos ? ` <span style="color:var(--red);font-size:11px;font-weight:700;">(Out of Stock)</span>` : (pclosed ? ` <span style="color:var(--red);font-size:11px;font-weight:700;">(Closed)</span>` : '')}</span>
        <span class="price">${sqmCurrency(p.price)}</span>
      </a>`;
    }).join('');
  }
  shell && shell.classList.add('is-open');
}

/* ---------- pincode live validation hint (Parbhani-only delivery) ---------- */
function sqmCheckPinHint(inputEl, hintId) {
  const hint = document.getElementById(hintId);
  const val = inputEl.value.trim();
  if (!hint) return;
  if (val.length < 6) { hint.className = 'pin-hint'; hint.textContent = ''; inputEl.classList.remove('invalid', 'valid'); return; }
  if (val === '431401') { hint.className = 'pin-hint ok'; hint.textContent = '✅ Parbhani — Delivery available!'; inputEl.classList.remove('invalid'); inputEl.classList.add('valid'); }
  else { hint.className = 'pin-hint bad'; hint.textContent = '❌ We deliver only in Parbhani (431401)'; inputEl.classList.remove('valid'); inputEl.classList.add('invalid'); }
}

/* ---------- location pill (professional: shows saved area, click to change) ---------- */
let sqmLocationLookupStarted = false;

async function sqmLoadSavedLocation() {
  const user = UserStore.get();
  if (user.area || !user.phone || sqmLocationLookupStarted) return;
  if (!window._db || !window._getDoc || !window._doc) {
    setTimeout(sqmLoadSavedLocation, 400);
    return;
  }
  sqmLocationLookupStarted = true;
  try {
    const snap = await window._getDoc(
      window._doc(window._db, "customers", user.phone),
    );
    if (!snap.exists()) return;
    const data = snap.data();
    const addresses = Array.isArray(data.addresses) ? data.addresses : [];
    const saved = addresses.find((address) => address.isDefault) || addresses[0];
    const area = data.area || (saved && (saved.street || saved.area));
    if (area) {
      UserStore.save({ ...user, area });
      sqmRenderLocationPill();
    }
  } catch (error) {
    console.error("Could not load saved delivery area", error);
  }
}

function sqmRenderLocationPill() {
  document.querySelectorAll('.location-pill').forEach(el => {
    const u = UserStore.get();
    const line1 = el.querySelector('.loc-line1');
    if (!line1) return;
    line1.textContent = u.area ? u.area : 'Select delivery area';
    el.classList.toggle('is-set', !!u.area);
  });
  sqmLoadSavedLocation();
}
document.addEventListener('sqm:user-changed', sqmRenderLocationPill);
document.addEventListener('DOMContentLoaded', sqmRenderLocationPill);

/* ---------- init on every page ---------- */
document.addEventListener('DOMContentLoaded', () => {
  sqmInitHeaderScroll();
  sqmInitReveal();
  sqmInitSearch();
  sqmSyncBadges();
  sqmRenderTimingBar();
  setInterval(sqmRenderTimingBar, 60000);
});
