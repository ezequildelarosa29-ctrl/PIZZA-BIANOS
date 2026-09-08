/* ═══════════════════════════════════════════════════
   sales.js  –  Pizza Bianos  |  Firestore backend
   ═══════════════════════════════════════════════════ */

async function renderSales() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Sales</h2>
        <p>Record product sales — automatically deducts from inventory.</p>
      </div>
      <button class="btn btn-primary" onclick="saleForm()">＋ New Sale</button>
    </div>

    <div id="salesStats" class="stats-grid stats-grid-4" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon-wrap si-green">💰</div><div class="stat-body"><h3>…</h3><p>Total Revenue</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-blue">🧾</div><div class="stat-body"><h3>…</h3><p>Transactions</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-red">📦</div><div class="stat-body"><h3>…</h3><p>Units Sold</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-yellow">🗓</div><div class="stat-body"><h3>…</h3><p>Today's Revenue</p></div></div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>Sales Records</h3></div>
      <div class="panel-body" style="padding-bottom:0">
        <div class="toolbar">
          <input id="salesSearch" class="search-box" placeholder="🔍  Search receipt, product, cashier…">
          <select id="salesPayFilter" class="select-box">
            <option value="">All Payment Methods</option>
            <option>Cash</option>
            <option>GCash</option>
            <option>Card</option>
            <option>Other</option>
          </select>
          <input id="salesDateFrom" type="date" class="form-control" style="max-width:160px" title="From date">
          <input id="salesDateTo"   type="date" class="form-control" style="max-width:160px" title="To date">
        </div>
      </div>
      <div id="salesTable">
        <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading sales…</p></div>
      </div>
    </div>`;

  showLoading('Loading sales…');
  const [ss, ps] = await Promise.all([sales(), products()]);
  hideLoading();
  window._allSales    = ss;
  window._allProducts = ps;

  const totalRev = ss.reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0);
  const totalQty = ss.reduce((a, x) => a + (x.qty || 0), 0);
  const todayRev = ss.filter(x => x.date === todayISO()).reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0);

  document.getElementById('salesStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap si-green">💰</div><div class="stat-body"><h3>${money(totalRev)}</h3><p>Total Revenue</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-blue">🧾</div><div class="stat-body"><h3>${ss.length}</h3><p>Transactions</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-red">📦</div><div class="stat-body"><h3>${totalQty.toLocaleString()}</h3><p>Units Sold</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-yellow">🗓</div><div class="stat-body"><h3>${money(todayRev)}</h3><p>Today's Revenue</p></div></div>`;

  document.getElementById('salesSearch').addEventListener('input', _drawSales);
  document.getElementById('salesPayFilter').addEventListener('change', _drawSales);
  document.getElementById('salesDateFrom').addEventListener('change', _drawSales);
  document.getElementById('salesDateTo').addEventListener('change', _drawSales);
  _drawSales();
}

function _drawSales() {
  const q       = (document.getElementById('salesSearch')?.value || '').toLowerCase();
  const payment = document.getElementById('salesPayFilter')?.value  || '';
  const from    = document.getElementById('salesDateFrom')?.value   || '';
  const to      = document.getElementById('salesDateTo')?.value     || '';
  const ps      = window._allProducts || [];
  let list      = window._allSales || [];

  if (q)       list = list.filter(x => {
    const prod = ps.find(p => p.id === x.productId);
    return [x.receipt || '', prod?.name || '', x.cashier || '', x.payment || ''].join(' ').toLowerCase().includes(q);
  });
  if (payment) list = list.filter(x => (x.payment || 'Cash') === payment);
  if (from)    list = list.filter(x => (x.date || '') >= from);
  if (to)      list = list.filter(x => (x.date || '') <= to);

  if (!list.length) {
    document.getElementById('salesTable').innerHTML =
      `<div class="empty-state"><div class="es-icon">💰</div><h4>No Sales Records</h4><p>No records match your filters. Record a new sale to get started.</p></div>`;
    return;
  }

  const rows = list.map(x => {
    const prod  = ps.find(p => p.id === x.productId);
    const total = (x.qty || 0) * (x.price || 0);
    const pmBadge = x.payment === 'GCash' ? 'badge-blue'
                  : x.payment === 'Card'  ? 'badge-purple'
                  : 'badge-green';
    return `<tr>
      <td>${fmtDate(x.date)}</td>
      <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(x.receipt || x.id)}</code></td>
      <td>
        <div style="font-weight:700">${esc(prod?.name || '(Deleted)')}</div>
        ${prod ? `<div style="font-size:11.5px;color:var(--muted)">${esc(prod.category)}</div>` : ''}
      </td>
      <td style="font-weight:700">${x.qty || 0}</td>
      <td>${money(x.price)}</td>
      <td><span style="font-weight:800;color:var(--green)">${money(total)}</span></td>
      <td><span class="badge ${pmBadge}">${esc(x.payment || 'Cash')}</span></td>
      <td><small class="text-muted">${esc(x.cashier || '—')}</small></td>
      <td class="actions">
        <button class="btn btn-secondary btn-xs" onclick="viewReceipt('${esc(x.id)}')">🧾 Receipt</button>
        <button class="btn btn-danger btn-xs"    onclick="deleteSale('${esc(x.id)}')">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const filteredRev = list.reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0);

  document.getElementById('salesTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Receipt #</th><th>Product</th><th>Qty</th>
            <th>Unit Price</th><th>Total</th><th>Payment</th><th>Cashier</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--surface)">
            <td colspan="5" style="padding:12px 16px;text-align:right;font-weight:700;color:var(--muted)">
              Showing ${list.length} record(s) — Total:
            </td>
            <td style="padding:12px 16px;font-weight:800;font-size:15px;color:var(--green)">${money(filteredRev)}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

/* ══════════════════════════════════════════════════
   SALE FORM
══════════════════════════════════════════════════ */
async function saleForm() {
  const ps      = window._allProducts || await products();
  const inStock = ps.filter(p => stockQty(p) > 0);

  if (!ps.length) {
    toast('Add a product first before recording a sale.', 'info');
    navigate('products');
    return;
  }

  openModal('Record New Sale', `
    <form id="sForm">
      <div class="form-grid">
        <div class="form-group full">
          <label>Product <span class="req">*</span></label>
          <select class="form-control select-box" name="productId" id="sProduct" required>
            ${inStock.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.model ? ' (' + esc(p.model) + ')' : ''} — ₱${p.price} — Stock: ${stockQty(p)}</option>`).join('')}
            ${ps.filter(p => stockQty(p) <= 0).map(p => `<option value="${esc(p.id)}" disabled style="color:#ccc">[Out of Stock] ${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity <span class="req">*</span></label>
          <input class="form-control" type="number" min="1" name="qty" value="1" id="sQty" required>
        </div>
        <div class="form-group">
          <label>Selling Price (₱) <span class="req">*</span></label>
          <input class="form-control" type="number" min="0" step="0.01" name="price" id="sPrice" required>
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <select class="form-control select-box" name="payment">
            <option>Cash</option>
            <option>GCash</option>
            <option>Card</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <input class="form-control" type="date" name="date" value="${todayISO()}" required>
        </div>
        <div class="form-group">
          <label>Available Stock</label>
          <input class="form-control" id="sAvailStock" readonly style="background:#f9fafb;color:var(--muted)">
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea class="form-control" name="notes" rows="2" placeholder="Customer name, order number, etc.…"></textarea>
        </div>
        <div class="form-group full" style="background:#f0fdf4;padding:16px;border-radius:10px;border:1.5px solid #86efac">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted);font-size:13px;font-weight:600">Order Total:</span>
            <span id="sTotal" style="font-size:24px;font-weight:800;color:var(--green)">₱0.00</span>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" type="submit" id="sSaveBtn">💰 Save Sale</button>
      </div>
    </form>`);

  const sel       = document.getElementById('sProduct');
  const qtyInp    = document.getElementById('sQty');
  const priceInp  = document.getElementById('sPrice');
  const totalDisp = document.getElementById('sTotal');
  const availDisp = document.getElementById('sAvailStock');

  const calcTotal = () => {
    const t = (+qtyInp.value || 0) * (+priceInp.value || 0);
    totalDisp.textContent = '₱' + t.toLocaleString('en-PH', { minimumFractionDigits: 2 });
  };
  const fillProduct = () => {
    const p = ps.find(x => x.id === sel.value);
    if (p) {
      priceInp.value   = p.price;
      availDisp.value  = stockQty(p) + ' ' + (p.unit || 'pcs');
      calcTotal();
    }
  };
  fillProduct();
  sel.addEventListener('change', fillProduct);
  qtyInp.addEventListener('input', calcTotal);
  priceInp.addEventListener('input', calcTotal);

  document.getElementById('sForm').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('sSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const f    = new FormData(e.target);
    const qty  = +f.get('qty');
    if (!qty || qty < 1) {
      toast('Quantity must be at least 1.', 'error');
      btn.disabled = false; btn.textContent = '💰 Save Sale'; return;
    }

    const prodDoc = await fbGetOne(COL.PRODUCTS, f.get('productId'));
    if (!prodDoc) {
      toast('Product not found.', 'error');
      btn.disabled = false; btn.textContent = '💰 Save Sale'; return;
    }
    if (qty > (prodDoc.stock || 0)) {
      toast(`Insufficient stock. Available: ${prodDoc.stock} ${prodDoc.unit || ''}`, 'error');
      btn.disabled = false; btn.textContent = '💰 Save Sale'; return;
    }

    try {
      await fbUpdate(COL.PRODUCTS, prodDoc.id, { stock: (prodDoc.stock || 0) - qty });
      await fbAdd(COL.SALES, {
        receipt:   'R-' + Date.now().toString(36).toUpperCase(),
        productId: prodDoc.id,
        qty,
        price:     +f.get('price'),
        payment:   f.get('payment'),
        date:      f.get('date'),
        notes:     f.get('notes').trim(),
        cashier:   currentUser()?.fullname || 'Unknown',
        createdAt: new Date().toISOString()
      });
      closeModal();
      toast('Sale recorded successfully!', 'success');
      renderSales();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '💰 Save Sale';
    }
  };
}

/* ══════════════════════════════════════════════════
   VIEW RECEIPT
══════════════════════════════════════════════════ */
function viewReceipt(id) {
  const sale = (window._allSales || []).find(x => x.id === id);
  if (!sale) return;
  const prod  = (window._allProducts || []).find(p => p.id === sale.productId);
  const total = (sale.qty || 0) * (sale.price || 0);

  openModal('🧾 Receipt', `
    <div style="padding:28px 24px;max-width:360px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:36px;margin-bottom:8px">🍕</div>
        <h2 style="font-size:20px;font-weight:800;color:var(--primary-dark)">Pizza Bianos</h2>
        <p style="font-size:12px;color:var(--muted);font-style:italic">Official Receipt</p>
      </div>
      <div style="border-top:2px dashed var(--border);border-bottom:2px dashed var(--border);padding:14px 0;margin-bottom:14px">
        <table style="width:100%;min-width:unset;font-size:13px">
          <tr><td style="padding:5px 0;color:var(--muted)">Receipt #</td><td style="text-align:right;font-weight:700">${esc(sale.receipt || sale.id)}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted)">Date</td><td style="text-align:right">${fmtDate(sale.date)}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted)">Cashier</td><td style="text-align:right">${esc(sale.cashier || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted)">Payment</td><td style="text-align:right"><span class="badge badge-green">${esc(sale.payment || 'Cash')}</span></td></tr>
        </table>
      </div>
      <table style="width:100%;min-width:unset;font-size:13px;margin-bottom:14px">
        <tr>
          <td style="padding:5px 0">
            <div style="font-weight:700">${esc(prod?.name || 'Product')}</div>
            ${prod?.model ? `<div style="font-size:11px;color:var(--muted)">${esc(prod.model)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:var(--muted);font-size:12px">Qty ${sale.qty} × ${money(sale.price)}</td>
          <td style="text-align:right;font-weight:700">${money(total)}</td>
        </tr>
      </table>
      <div style="border-top:2px solid var(--border);padding-top:14px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700;color:var(--muted)">TOTAL AMOUNT</span>
        <span style="font-size:22px;font-weight:800;color:var(--green)">${money(total)}</span>
      </div>
      ${sale.notes ? `<div class="info-box" style="margin-top:14px"><small>Notes: ${esc(sale.notes)}</small></div>` : ''}
      <p style="text-align:center;font-size:11px;color:var(--muted);margin-top:20px">Thank you for dining at Pizza Bianos! 🍕</p>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-secondary" onclick="window.print()">🖨 Print Receipt</button>
    </div>`);
}

/* ══════════════════════════════════════════════════
   DELETE  (restores stock)
══════════════════════════════════════════════════ */
async function deleteSale(id) {
  const ok = await confirmAction('Delete this sale? The deducted stock will be restored.');
  if (!ok) return;
  showLoading('Deleting sale…');
  const rec = await fbGetOne(COL.SALES, id);
  if (rec) {
    const prod = await fbGetOne(COL.PRODUCTS, rec.productId);
    if (prod) await fbUpdate(COL.PRODUCTS, prod.id, { stock: (prod.stock || 0) + Number(rec.qty || 0) });
    await fbDelete(COL.SALES, id);
  }
  hideLoading();
  toast('Sale deleted. Stock quantity restored.', 'info');
  renderSales();
}
