/* ============================================================
   S_QUICK MART — ORDER HISTORY 
   ============================================================ */

const SQM_STATUS_MAP = {
  pending: 'Pending', confirmed: 'Confirmed', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Rejected'
};
const SQM_STATUS_COLOR = {
  pending: 'var(--amber-deep)', confirmed: 'var(--green)', out_for_delivery: 'var(--amber-deep)',
  delivered: 'var(--green)', cancelled: 'var(--red)', rejected: 'var(--red)'
};

let sqmOrderHistoryUnsub = null;
let sqmAllOrders = [];
let sqmOrdersFilter = 'all';

function sqmOrderCardHTML(o) {
  const isYN = o._type === 'yourneed';
  const st = o.status || 'pending';
  const dt = o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const idShort = (isYN ? '✨ YourNeed #' : 'Order #') + (o.id || '').slice(-6).toUpperCase();
  const itemsText = isYN
    ? (o.type === 'pickup_drop' ? (o.itemDesc || 'Pickup & Drop request') : (o.items || []).map(i => i.name + ' ×' + i.qty).join(', ') || o.itemDesc || '')
    : (o.items || []).slice(0, 3).map(i => i.name).join(', ') + ((o.items||[]).length > 3 ? ` +${o.items.length-3} more` : '');

  return `
    <div class="order-card">
      <div class="oc-top">
        <div><span class="oc-id">${idShort}</span><span class="text-muted" style="font-size:12px;"> · ${dt}</span></div>
        <span class="oc-status" style="color:${SQM_STATUS_COLOR[st] || 'var(--ink-soft)'};">${SQM_STATUS_MAP[st] || st}</span>
      </div>
      <div class="oc-items">${itemsText}</div>
      <div class="oc-bottom">
        <span class="oc-total">${isYN ? '' : sqmCurrency(o.total)}</span>
        <a href="order-details.html?id=${o.id}&type=${isYN ? 'yourneed' : 'regular'}" class="btn btn-ghost btn-sm">View Details</a>
      </div>
    </div>`;
}

function sqmRenderOrdersList(hostEl, filter) {
  if (!hostEl) return;
  let list = [...sqmAllOrders];
  if (filter === 'active') list = list.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status || 'pending'));
  else if (filter === 'delivered') list = list.filter(o => o.status === 'delivered');
  else if (filter === 'cancelled') list = list.filter(o => ['cancelled', 'rejected'].includes(o.status));

  if (!list.length) {
    hostEl.innerHTML = `<div class="empty-cart"><div class="ic">📭</div><h3 style="font-size:19px;margin-bottom:6px;">No orders here yet</h3><p class="text-muted" style="margin-bottom:20px;">Your order history will show up here.</p><a href="products.html" class="btn btn-primary">Start Shopping</a></div>`;
    return;
  }
  hostEl.innerHTML = list.map(sqmOrderCardHTML).join('');
}

function loadOrderHistory(phone, hostEl, tabsEl) {
  if (!hostEl) return;
  hostEl.innerHTML = `<p class="text-muted" style="text-align:center;padding:20px;">Loading orders…</p>`;

  if (sqmOrderHistoryUnsub) { sqmOrderHistoryUnsub(); sqmOrderHistoryUnsub = null; }
  if (!window._db) { setTimeout(() => loadOrderHistory(phone, hostEl, tabsEl), 400); return; }

  let regularOrders = [], ynOrders = [], regularDone = false, ynDone = false;

  function renderAll() {
    if (!regularDone || !ynDone) return;
    sqmAllOrders = [...regularOrders, ...ynOrders].sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.seconds : 0, tb = b.createdAt ? b.createdAt.seconds : 0;
      return tb - ta;
    });
    sqmRenderOrdersList(hostEl, sqmOrdersFilter);
  }

  const q1 = window._query(window._collection(window._db, 'orders'), window._orderBy('createdAt', 'desc'));
  const unsub1 = window._onSnapshot(q1, (snap) => {
    regularOrders = snap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'regular' })).filter(o => o.phone === phone);
    regularDone = true; renderAll();
  }, () => { regularDone = true; renderAll(); });

  const q2 = window._query(window._collection(window._db, 'yourneed_requests'), window._orderBy('createdAt', 'desc'));
  const unsub2 = window._onSnapshot(q2, (snap) => {
    ynOrders = snap.docs.map(d => ({ id: d.id, ...d.data(), _type: 'yourneed' })).filter(o => o.phone === phone);
    ynDone = true; renderAll();
  }, () => { ynDone = true; renderAll(); });

  sqmOrderHistoryUnsub = () => { unsub1(); unsub2(); };

  if (tabsEl) {
    tabsEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-filter]'); if (!t) return;
      tabsEl.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      t.classList.add('active');
      sqmOrdersFilter = t.dataset.filter;
      sqmRenderOrdersList(hostEl, sqmOrdersFilter);
    });
  }
}
