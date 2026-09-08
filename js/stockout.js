/* ═══════════════════════════════════════════════════
   stockout.js  –  Pizza Bianos  |  Firestore backend
   ═══════════════════════════════════════════════════ */

const STOCKOUT_REASONS = [
  'Damaged', 'Expired', 'Used in Kitchen',
  'Adjustment', 'Returned to Supplier', 'Theft / Loss', 'Other'
];

async function renderStockout() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Stock Out</h2>
        <p>Record damaged, expired, used, or manually adjusted stock deductions.</p>
      </div>
      <button class="btn btn-danger" onclick="stockOutForm()">＋ New Stock Out</button>
    </div>

    <div id="soStats" class="stats-grid stats-grid-3" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon-wrap si-red">📤</div><div class="stat-body"><h3>…</h3><p>Total Records</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-yellow">📉</div><div class="stat-body"><h3>…</h3><p>Units Deducted</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-orange">🗓</div><div class="stat-body"><h3>…</h3><p>Today's Deductions</p></div></div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>Stock Out Records</h3></div>
      <div class="panel-body" style="padding-bottom:0">
        <div class="toolbar">
          <input id="soSearch" class="search-box" placeholder="🔍  Search product or reason…">
          <select id="soReasonFilter" class="select-box">
            <option value="">All Reasons</option>
            ${STOCKOUT_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}
          </select>
          <input id="soDateFrom" type="date" class="form-control" style="max-width:160px" title="From date">
          <input id="soDateTo"   type="date" class="form-control" style="max-width:160px" title="To date">
        </div>
      </div>
      <div id="soTable">
        <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading records…</p></div>
      </div>
    </div>`;

  showLoading('Loading stock-out records…');
  const [sos, ps] = await Promise.all([stockOuts(), products()]);
  hideLoading();
  window._allStockOuts = sos;
  window._allProducts  = ps;

  const totalUnits = sos.reduce((a, x) => a + Number(x.qty || 0), 0);
  const todayCount = sos.filter(x => x.date === todayISO()).reduce((a, x) => a + Number(x.qty || 0), 0);
  document.getElementById('soStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap si-red">📤</div><div class="stat-body"><h3>${sos.length}</h3><p>Total Records</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-yellow">📉</div><div class="stat-body"><h3>${totalUnits.toLocaleString()}</h3><p>Units Deducted</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-orange">🗓</div><div class="stat-body"><h3>${todayCount}</h3><p>Today's Deductions</p></div></div>`;

  document.getElementById('soSearch').addEventListener('input', _drawSO);
  document.getElementById('soReasonFilter').addEventListener('change', _drawSO);
  document.getElementById('soDateFrom').addEventListener('change', _drawSO);
  document.getElementById('soDateTo').addEventListener('change', _drawSO);
  _drawSO();
}

function _drawSO() {
  const q      = (document.getElementById('soSearch')?.value || '').toLowerCase();
  const reason = document.getElementById('soReasonFilter')?.value || '';
  const from   = document.getElementById('soDateFrom')?.value || '';
  const to     = document.getElementById('soDateTo')?.value   || '';
  const ps     = window._allProducts || [];
  let list     = window._allStockOuts || [];

  if (q)      list = list.filter(x => {
    const prod = ps.find(p => p.id === x.productId);
    return [prod?.name || '', x.reason || '', x.remarks || '', x.createdBy || ''].join(' ').toLowerCase().includes(q);
  });
  if (reason) list = list.filter(x => x.reason === reason);
  if (from)   list = list.filter(x => (x.date || '') >= from);
  if (to)     list = list.filter(x => (x.date || '') <= to);

  if (!list.length) {
    document.getElementById('soTable').innerHTML =
      `<div class="empty-state"><div class="es-icon">📤</div><h4>No Records Found</h4><p>Try adjusting the filters or record a new stock deduction.</p></div>`;
    return;
  }

  const rows = list.map(x => {
    const prod = ps.find(p => p.id === x.productId);
    return `<tr>
      <td>${fmtDate(x.date)}</td>
      <td>
        <div style="font-weight:700">${esc(prod?.name || '(Deleted)')}</div>
        ${prod ? `<div style="font-size:11.5px;color:var(--muted)">${esc(prod.category)}</div>` : ''}
      </td>
      <td><span style="font-weight:700;color:var(--red)">−${x.qty}</span> <small class="text-muted">${esc(prod?.unit || '')}</small></td>
      <td><span class="badge badge-yellow">${esc(x.reason || '—')}</span></td>
      <td><small>${esc(x.remarks || '—')}</small></td>
      <td><small class="text-muted">${esc(x.createdBy || '—')}</small></td>
      <td class="actions">
        <button class="btn btn-secondary btn-xs" onclick="viewStockOut('${esc(x.id)}')">👁 View</button>
        <button class="btn btn-danger btn-xs"    onclick="deleteStockOut('${esc(x.id)}')">🗑</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('soTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Product</th><th>Quantity</th>
            <th>Reason</th><th>Remarks</th><th>Recorded By</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="table-meta">${list.length} record(s)</div>`;
}

/* ══════════════════════════════════════════════════
   STOCK OUT FORM
══════════════════════════════════════════════════ */
async function stockOutForm() {
  const ps = window._allProducts || await products();
  const avail = ps.filter(p => stockQty(p) > 0);
  if (!ps.length) { toast('Add a product first.', 'info'); navigate('products'); return; }

  openModal('Record Stock Out', `
    <form id="soForm">
      <div class="form-grid">
        <div class="form-group full">
          <label>Product <span class="req">*</span></label>
          <select class="form-control select-box" name="productId" id="soProduct" required>
            ${avail.map(p => `<option value="${esc(p.id)}">${esc(p.name)} — Available: ${stockQty(p)} ${esc(p.unit || '')}</option>`).join('')}
            ${ps.filter(p => stockQty(p) <= 0).map(p => `<option value="${esc(p.id)}" disabled style="color:#ccc">[Out of Stock] ${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity to Deduct <span class="req">*</span></label>
          <input class="form-control" type="number" min="1" name="qty" value="1" id="soQty" required>
        </div>
        <div class="form-group">
          <label>Available Stock</label>
          <input class="form-control" id="soAvail" readonly style="background:#f9fafb;color:var(--muted)">
        </div>
        <div class="form-group">
          <label>Reason <span class="req">*</span></label>
          <select class="form-control select-box" name="reason" required>
            ${STOCKOUT_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date <span class="req">*</span></label>
          <input class="form-control" type="date" name="date" value="${todayISO()}" required>
        </div>
        <div class="form-group full">
          <label>Remarks / Notes</label>
          <textarea class="form-control" name="remarks" rows="2" placeholder="Optional details about this deduction…"></textarea>
        </div>
        <div class="form-group full" id="soStockAfterWrap" style="background:#fef2f2;padding:14px;border-radius:10px;border:1.5px solid #fca5a5">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted);font-size:13px;font-weight:600">Stock After Deduction:</span>
            <span id="soStockAfter" style="font-size:20px;font-weight:800;color:var(--red)">—</span>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" type="submit" id="soSaveBtn">📤 Save Stock Out</button>
      </div>
    </form>`);

  const sel        = document.getElementById('soProduct');
  const qtyInp     = document.getElementById('soQty');
  const availDisp  = document.getElementById('soAvail');
  const afterDisp  = document.getElementById('soStockAfter');

  const refresh = () => {
    const p = ps.find(x => x.id === sel.value);
    if (p) {
      availDisp.value = `${stockQty(p)} ${p.unit || 'pcs'}`;
      const after     = stockQty(p) - (+qtyInp.value || 0);
      afterDisp.textContent = after + ' ' + (p.unit || 'pcs');
      afterDisp.style.color = after < 0 ? 'var(--red)' : after === 0 ? 'var(--yellow)' : 'var(--text)';
      document.getElementById('soStockAfterWrap').style.borderColor = after < 0 ? '#ef4444' : '#fca5a5';
    }
  };
  refresh();
  sel.addEventListener('change', refresh);
  qtyInp.addEventListener('input', refresh);

  document.getElementById('soForm').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('soSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const f   = new FormData(e.target);
    const qty = +f.get('qty');
    if (!qty || qty < 1) {
      toast('Quantity must be at least 1.', 'error');
      btn.disabled = false; btn.textContent = '📤 Save Stock Out'; return;
    }

    const prodDoc = await fbGetOne(COL.PRODUCTS, f.get('productId'));
    if (!prodDoc) {
      toast('Product not found.', 'error');
      btn.disabled = false; btn.textContent = '📤 Save Stock Out'; return;
    }
    if (qty > (prodDoc.stock || 0)) {
      toast(`Insufficient stock. Available: ${prodDoc.stock} ${prodDoc.unit || ''}`, 'error');
      btn.disabled = false; btn.textContent = '📤 Save Stock Out'; return;
    }

    try {
      await fbUpdate(COL.PRODUCTS, prodDoc.id, { stock: (prodDoc.stock || 0) - qty });
      await fbAdd(COL.STOCK_OUT, {
        productId: prodDoc.id,
        qty,
        reason:    f.get('reason'),
        date:      f.get('date'),
        remarks:   f.get('remarks').trim(),
        createdBy: currentUser()?.fullname || 'Unknown',
        createdAt: new Date().toISOString()
      });
      closeModal();
      toast('Stock Out recorded successfully.', 'success');
      renderStockout();
    } catch (err) {
      toast('Error saving: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '📤 Save Stock Out';
    }
  };
}

/* ══════════════════════════════════════════════════
   VIEW DETAIL
══════════════════════════════════════════════════ */
function viewStockOut(id) {
  const rec  = (window._allStockOuts || []).find(x => x.id === id);
  if (!rec) return;
  const prod = (window._allProducts || []).find(p => p.id === rec.productId);
  openModal('Stock Out Detail', `
    <div style="padding:24px">
      <table style="min-width:unset;width:100%;font-size:13.5px">
        <tr><td style="padding:8px 0;color:var(--muted);width:140px">Date</td><td style="font-weight:600">${fmtDate(rec.date)}</td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Product</td><td style="font-weight:700">${esc(prod?.name || '(Deleted)')}</td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Category</td><td>${esc(prod?.category || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Qty Deducted</td><td class="text-red fw-bold">−${rec.qty} ${esc(prod?.unit || '')}</td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Reason</td><td><span class="badge badge-yellow">${esc(rec.reason || '—')}</span></td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Recorded By</td><td>${esc(rec.createdBy || '—')}</td></tr>
        <tr><td style="padding:8px 0;color:var(--muted)">Remarks</td><td>${esc(rec.remarks || '—')}</td></tr>
      </table>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-danger btn-sm" onclick="closeModal();deleteStockOut('${esc(id)}')">🗑 Delete</button>
    </div>`);
}

/* ══════════════════════════════════════════════════
   DELETE  (restores stock)
══════════════════════════════════════════════════ */
async function deleteStockOut(id) {
  const ok = await confirmAction('Delete this record? The deducted stock quantity will be restored.');
  if (!ok) return;
  showLoading('Deleting record…');
  const rec = await fbGetOne(COL.STOCK_OUT, id);
  if (rec) {
    const prod = await fbGetOne(COL.PRODUCTS, rec.productId);
    if (prod) await fbUpdate(COL.PRODUCTS, prod.id, { stock: (prod.stock || 0) + Number(rec.qty || 0) });
    await fbDelete(COL.STOCK_OUT, id);
  }
  hideLoading();
  toast('Record deleted. Stock quantity restored.', 'info');
  renderStockout();
}
