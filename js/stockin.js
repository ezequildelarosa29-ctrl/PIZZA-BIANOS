/* ═══════════════════════════════════════════════════
   stockin.js  –  Pizza Bianos  |  Firestore backend
   ═══════════════════════════════════════════════════ */

async function renderStockin() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Stock In</h2>
        <p>Record incoming inventory — automatically adds quantity to the product.</p>
      </div>
      <button class="btn btn-success" onclick="stockInForm()">＋ New Stock In</button>
    </div>

    <div id="siStats" class="stats-grid stats-grid-3" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon-wrap si-blue">📥</div><div class="stat-body"><h3>…</h3><p>Total Records</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-green">📦</div><div class="stat-body"><h3>…</h3><p>Units Received</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-yellow">💸</div><div class="stat-body"><h3>…</h3><p>Total Stock Cost</p></div></div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>Stock In Records</h3></div>
      <div class="panel-body" style="padding-bottom:0">
        <div class="toolbar">
          <input id="siSearch"   class="search-box" placeholder="🔍  Search product, supplier, reference…">
          <input id="siDateFrom" type="date" class="form-control" style="max-width:160px" title="From date">
          <input id="siDateTo"   type="date" class="form-control" style="max-width:160px" title="To date">
        </div>
      </div>
      <div id="siTable">
        <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading records…</p></div>
      </div>
    </div>`;

  showLoading('Loading stock-in records…');
  const [sis, ps] = await Promise.all([stockIns(), products()]);
  hideLoading();
  window._allStockIns = sis;
  window._allProducts = ps;

  const totalUnits = sis.reduce((a, x) => a + Number(x.qty || 0), 0);
  const totalCost  = sis.reduce((a, x) => a + Number(x.qty || 0) * Number(x.cost || 0), 0);
  document.getElementById('siStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap si-blue">📥</div><div class="stat-body"><h3>${sis.length}</h3><p>Total Records</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-green">📦</div><div class="stat-body"><h3>${totalUnits.toLocaleString()}</h3><p>Units Received</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-yellow">💸</div><div class="stat-body"><h3>${money(totalCost)}</h3><p>Total Stock Cost</p></div></div>`;

  document.getElementById('siSearch').addEventListener('input', _drawSI);
  document.getElementById('siDateFrom').addEventListener('change', _drawSI);
  document.getElementById('siDateTo').addEventListener('change', _drawSI);
  _drawSI();
}

function _drawSI() {
  const q    = (document.getElementById('siSearch')?.value || '').toLowerCase();
  const from = document.getElementById('siDateFrom')?.value || '';
  const to   = document.getElementById('siDateTo')?.value   || '';
  const ps   = window._allProducts || [];
  let list   = window._allStockIns || [];

  if (q)    list = list.filter(x => {
    const prod = ps.find(p => p.id === x.productId);
    return [prod?.name || '', x.ref || '', x.supplier || '', x.remarks || ''].join(' ').toLowerCase().includes(q);
  });
  if (from) list = list.filter(x => (x.date || '') >= from);
  if (to)   list = list.filter(x => (x.date || '') <= to);

  if (!list.length) {
    document.getElementById('siTable').innerHTML =
      `<div class="empty-state"><div class="es-icon">📥</div><h4>No Records Found</h4><p>Try adjusting the filters or record a new stock-in.</p></div>`;
    return;
  }

  const rows = list.map(x => {
    const prod = ps.find(p => p.id === x.productId);
    return `<tr>
      <td>${fmtDate(x.date)}</td>
      <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(x.ref || x.id)}</code></td>
      <td>
        <div style="font-weight:700">${esc(prod?.name || '(Deleted)')}</div>
        ${prod ? `<div style="font-size:11.5px;color:var(--muted)">${esc(prod.category)}</div>` : ''}
      </td>
      <td><span style="font-weight:700;color:var(--green)">+${x.qty}</span> <small class="text-muted">${esc(prod?.unit || '')}</small></td>
      <td>${money(x.cost)}</td>
      <td><span style="font-weight:700">${money(Number(x.qty || 0) * Number(x.cost || 0))}</span></td>
      <td>${esc(x.supplier || '—')}</td>
      <td><small class="text-muted">${esc(x.createdBy || '—')}</small></td>
      <td>${esc(x.remarks || '—')}</td>
      <td class="actions">
        <button class="btn btn-danger btn-xs" onclick="deleteStockIn('${esc(x.id)}')">🗑</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('siTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Reference</th><th>Product</th><th>Quantity</th>
            <th>Unit Cost</th><th>Total Cost</th><th>Supplier</th><th>Received By</th><th>Remarks</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="table-meta">${list.length} record(s)</div>`;
}

/* ══════════════════════════════════════════════════
   STOCK IN FORM
══════════════════════════════════════════════════ */
async function stockInForm() {
  const ps = window._allProducts || await products();
  if (!ps.length) { toast('Add a product first before recording stock-in.', 'info'); navigate('products'); return; }

  openModal('Record Stock In', `
    <form id="siForm">
      <div class="form-grid">
        <div class="form-group full">
          <label>Product <span class="req">*</span></label>
          <select class="form-control select-box" name="productId" id="siProduct" required>
            ${ps.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.model ? ' (' + esc(p.model) + ')' : ''} — Current Stock: ${stockQty(p)} ${esc(p.unit || '')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity <span class="req">*</span></label>
          <input class="form-control" type="number" min="1" name="qty" value="1" id="siQty" required>
        </div>
        <div class="form-group">
          <label>Unit Cost (₱) <span class="req">*</span></label>
          <input class="form-control" type="number" min="0" step="0.01" name="cost" id="siCost" value="0" required>
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <input class="form-control" type="date" name="date" value="${todayISO()}" required>
        </div>
        <div class="form-group">
          <label>Supplier / Provider</label>
          <input class="form-control" name="supplier" placeholder="e.g. Supplier A, Local Market">
        </div>
        <div class="form-group">
          <label>Current Stock (after)</label>
          <input class="form-control" id="siNewStock" readonly style="background:#f9fafb;font-weight:700;color:var(--green)">
        </div>
        <div class="form-group full">
          <label>Remarks</label>
          <textarea class="form-control" name="remarks" rows="2" placeholder="Optional notes about this delivery…"></textarea>
        </div>
        <div class="form-group full" style="background:#f0fdf4;padding:14px;border-radius:10px;border:1.5px solid #86efac">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted);font-size:13px;font-weight:600">Total Cost of this Delivery:</span>
            <span id="siTotalCost" style="font-size:20px;font-weight:800;color:var(--green)">₱0.00</span>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" type="submit" id="siSaveBtn">📥 Save Stock In</button>
      </div>
    </form>`);

  const sel      = document.getElementById('siProduct');
  const costInp  = document.getElementById('siCost');
  const qtyInp   = document.getElementById('siQty');
  const newStock = document.getElementById('siNewStock');
  const total    = document.getElementById('siTotalCost');

  const refresh = () => {
    const p = ps.find(x => x.id === sel.value);
    if (p) {
      costInp.value     = p.cost || 0;
      const afterQty    = (stockQty(p)) + (+qtyInp.value || 0);
      newStock.value    = afterQty + ' ' + (p.unit || 'pcs');
    }
    total.textContent = money((+qtyInp.value || 0) * (+costInp.value || 0));
  };
  refresh();
  sel.addEventListener('change', refresh);
  qtyInp.addEventListener('input', refresh);
  costInp.addEventListener('input', refresh);

  document.getElementById('siForm').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('siSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const f   = new FormData(e.target);
    const qty = +f.get('qty');
    if (!qty || qty < 1) {
      toast('Quantity must be at least 1.', 'error');
      btn.disabled = false; btn.textContent = '📥 Save Stock In'; return;
    }

    const prodDoc = await fbGetOne(COL.PRODUCTS, f.get('productId'));
    if (!prodDoc) {
      toast('Product not found.', 'error');
      btn.disabled = false; btn.textContent = '📥 Save Stock In'; return;
    }

    try {
      await fbUpdate(COL.PRODUCTS, prodDoc.id, { stock: (prodDoc.stock || 0) + qty });
      await fbAdd(COL.STOCK_IN, {
        ref:       'SI-' + Date.now().toString(36).toUpperCase(),
        productId: prodDoc.id,
        qty,
        cost:      +f.get('cost'),
        date:      f.get('date'),
        supplier:  f.get('supplier').trim(),
        remarks:   f.get('remarks').trim(),
        createdBy: currentUser()?.fullname || 'Unknown',
        createdAt: new Date().toISOString()
      });
      closeModal();
      toast('Stock In recorded successfully.', 'success');
      renderStockin();
    } catch (err) {
      toast('Error saving: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '📥 Save Stock In';
    }
  };
}

/* ══════════════════════════════════════════════════
   DELETE  (reverses stock)
══════════════════════════════════════════════════ */
async function deleteStockIn(id) {
  const ok = await confirmAction('Delete this record? The stock quantity will be reversed.');
  if (!ok) return;
  showLoading('Deleting record…');
  const rec = await fbGetOne(COL.STOCK_IN, id);
  if (rec) {
    const prod = await fbGetOne(COL.PRODUCTS, rec.productId);
    if (prod) await fbUpdate(COL.PRODUCTS, prod.id, { stock: Math.max(0, (prod.stock || 0) - (rec.qty || 0)) });
    await fbDelete(COL.STOCK_IN, id);
  }
  hideLoading();
  toast('Record deleted. Stock quantity reversed.', 'info');
  renderStockin();
}
