/* ═══════════════════════════════════════════════════
   reports.js  –  Pizza Bianos  |  Firestore backend
   ═══════════════════════════════════════════════════ */

let _rCache = null;

async function renderReports() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Reports</h2>
        <p>Inventory valuation, stock movements, and sales analysis.</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-ghost" onclick="window.print()">🖨 Print</button>
        <button class="btn btn-secondary" onclick="exportCSV()">⬇ Export CSV</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchReportTab('overview',  this)">📊 Overview</button>
      <button class="tab-btn"        onclick="switchReportTab('sales',     this)">💰 Sales Report</button>
      <button class="tab-btn"        onclick="switchReportTab('inventory', this)">📦 Inventory</button>
      <button class="tab-btn"        onclick="switchReportTab('movement',  this)">🔄 Stock Movement</button>
    </div>

    <div id="reportContent">
      <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading report data…</p></div>
    </div>`;

  showLoading('Loading reports…');
  const [ps, ss, si, so] = await Promise.all([products(), sales(), stockIns(), stockOuts()]);
  hideLoading();
  _rCache = { ps, ss, si, so };
  renderReportOverview();
}

function switchReportTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ({
    overview:  renderReportOverview,
    sales:     renderReportSales,
    inventory: renderReportInventory,
    movement:  renderReportMovement
  }[tab] || renderReportOverview)();
}

/* ══════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════ */
function renderReportOverview() {
  const { ps, ss, si, so } = _rCache;
  const revenue  = ss.reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0);
  const cogs     = ss.reduce((a, x) => {
    const p = ps.find(p => p.id === x.productId);
    return a + (x.qty || 0) * Number(p?.cost || 0);
  }, 0);
  const profit   = revenue - cogs;
  const invValue = ps.reduce((a, p) => a + stockQty(p) * Number(p.cost || 0), 0);
  const lowItems = ps.filter(p => stockQty(p) > 0 && stockQty(p) <= Number(p.reorder || 0));
  const outItems = ps.filter(p => stockQty(p) <= 0);

  /* Top 5 products by revenue */
  const revMap = {};
  ss.forEach(x => { revMap[x.productId] = (revMap[x.productId] || 0) + (x.qty || 0) * (x.price || 0); });
  const top5 = Object.entries(revMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, rev]) => ({ name: ps.find(p => p.id === id)?.name || 'Unknown', rev }));

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const maxRev = Math.max(...top5.map(t => t.rev), 1);

  document.getElementById('reportContent').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card green"><h3 style="color:var(--green)">${money(revenue)}</h3><p>Total Revenue</p></div>
      <div class="summary-card red"><h3 style="color:var(--primary)">${money(profit)}</h3><p>Gross Profit (est.)</p></div>
      <div class="summary-card blue"><h3>${money(invValue)}</h3><p>Inventory Value</p></div>
      <div class="summary-card yellow"><h3>${ps.length}</h3><p>Total Products</p></div>
    </div>

    <div class="dashboard-grid">
      <div>
        <div class="panel mb-16">
          <div class="panel-header"><h3>🏆 Top 5 Products by Revenue</h3></div>
          <div>
            ${top5.length ? top5.map((t, i) => `
              <div style="padding:12px 20px;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-size:13.5px;font-weight:600">${medals[i]} ${esc(t.name)}</span>
                  <span style="font-weight:800;color:var(--green)">${money(t.rev)}</span>
                </div>
                <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden">
                  <div style="background:var(--primary);width:${Math.round((t.rev/maxRev)*100)}%;height:100%;border-radius:4px;transition:width .4s"></div>
                </div>
              </div>`).join('')
            : '<div class="empty-state" style="padding:32px"><p>No sales data yet.</p></div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>📋 Activity Summary</h3></div>
          <div class="panel-body" style="padding:0">
            <table style="min-width:unset;width:100%">
              <tr><td style="padding:11px 20px;color:var(--muted)">Total Transactions</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${ss.length}</td></tr>
              <tr style="background:#fafbfc"><td style="padding:11px 20px;color:var(--muted)">Total Units Sold</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${ss.reduce((a,x)=>a+(x.qty||0),0).toLocaleString()}</td></tr>
              <tr><td style="padding:11px 20px;color:var(--muted)">COGS (est.)</td><td style="padding:11px 20px;text-align:right;font-weight:700;color:var(--red);border-left:1px solid var(--border)">${money(cogs)}</td></tr>
              <tr style="background:#fafbfc"><td style="padding:11px 20px;color:var(--muted)">Stock In Records</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${si.length}</td></tr>
              <tr><td style="padding:11px 20px;color:var(--muted)">Units Received</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${si.reduce((a,x)=>a+(x.qty||0),0).toLocaleString()}</td></tr>
              <tr style="background:#fafbfc"><td style="padding:11px 20px;color:var(--muted)">Stock Out Records</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${so.length}</td></tr>
              <tr><td style="padding:11px 20px;color:var(--muted)">Units Deducted</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${so.reduce((a,x)=>a+(x.qty||0),0).toLocaleString()}</td></tr>
            </table>
          </div>
        </div>
      </div>
      <div>
        <div class="panel mb-16">
          <div class="panel-header"><h3>⚠️ Stock Alerts</h3></div>
          <div class="panel-body" style="padding:0">
            ${outItems.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid var(--border)">
                <div><div style="font-weight:700;font-size:13.5px">${esc(p.name)}</div>
                <div style="font-size:11.5px;color:var(--muted)">${esc(p.category)}</div></div>
                <span class="badge badge-red">Out of Stock</span>
              </div>`).join('')}
            ${lowItems.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid var(--border)">
                <div><div style="font-weight:700;font-size:13.5px">${esc(p.name)}</div>
                <div style="font-size:11.5px;color:var(--muted)">${esc(p.category)}</div></div>
                <span class="badge badge-yellow">${stockQty(p)} left</span>
              </div>`).join('')}
            ${!outItems.length && !lowItems.length
              ? '<div class="empty-state" style="padding:28px"><div class="es-icon">✅</div><p>All products are well-stocked.</p></div>'
              : ''}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>💰 Revenue Breakdown</h3></div>
          <div class="panel-body" style="padding:0">
            <table style="min-width:unset;width:100%">
              <tr><td style="padding:11px 20px;color:var(--muted)">Total Revenue</td><td style="padding:11px 20px;text-align:right;font-weight:700;color:var(--green);border-left:1px solid var(--border)">${money(revenue)}</td></tr>
              <tr style="background:#fafbfc"><td style="padding:11px 20px;color:var(--muted)">Est. COGS</td><td style="padding:11px 20px;text-align:right;font-weight:700;color:var(--red);border-left:1px solid var(--border)">${money(cogs)}</td></tr>
              <tr><td style="padding:11px 20px;font-weight:700">Gross Profit</td><td style="padding:11px 20px;text-align:right;font-weight:800;font-size:15px;color:var(--primary);border-left:1px solid var(--border)">${money(profit)}</td></tr>
              <tr style="background:#fafbfc"><td style="padding:11px 20px;color:var(--muted)">Inventory Value</td><td style="padding:11px 20px;text-align:right;font-weight:700;border-left:1px solid var(--border)">${money(invValue)}</td></tr>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   SALES TAB
══════════════════════════════════════════════════ */
function renderReportSales() {
  document.getElementById('reportContent').innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Sales Report</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="rSalesFrom" type="date" class="form-control" style="width:150px" onchange="_drawRSales()">
          <span style="color:var(--muted);font-size:12px">to</span>
          <input id="rSalesTo"   type="date" class="form-control" style="width:150px" onchange="_drawRSales()">
        </div>
      </div>
      <div id="rSalesBody"></div>
    </div>`;
  _drawRSales();
}

function _drawRSales() {
  const { ps, ss } = _rCache;
  const from = document.getElementById('rSalesFrom')?.value || '';
  const to   = document.getElementById('rSalesTo')?.value   || '';
  let list   = ss.slice();
  if (from) list = list.filter(x => x.date >= from);
  if (to)   list = list.filter(x => x.date <= to);
  const total = list.reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0);

  const rows = list.length
    ? list.map(x => {
        const p = ps.find(p => p.id === x.productId);
        return `<tr>
          <td>${fmtDate(x.date)}</td>
          <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(x.receipt || x.id)}</code></td>
          <td>${esc(p?.name || '—')}</td>
          <td>${x.qty || 0}</td>
          <td>${money(x.price)}</td>
          <td class="text-green fw-bold">${money((x.qty||0)*(x.price||0))}</td>
          <td><span class="badge badge-green">${esc(x.payment || 'Cash')}</span></td>
          <td>${esc(x.cashier || '—')}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" class="empty-state" style="padding:28px"><p>No sales in this date range.</p></td></tr>';

  document.getElementById('rSalesBody').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Date</th><th>Receipt</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Payment</th><th>Cashier</th></tr></thead>
        <tbody>${rows}</tbody>
        ${list.length ? `<tfoot><tr style="background:var(--surface)">
          <td colspan="5" style="padding:12px 16px;text-align:right;font-weight:700;color:var(--muted)">Total (${list.length} records):</td>
          <td style="padding:12px 16px;font-weight:800;font-size:15px;color:var(--green)">${money(total)}</td>
          <td colspan="2"></td>
        </tr></tfoot>` : ''}
      </table>
    </div>`;
}

/* ══════════════════════════════════════════════════
   INVENTORY TAB
══════════════════════════════════════════════════ */
function renderReportInventory() {
  const { ps } = _rCache;
  const totalVal = ps.reduce((a, p) => a + stockQty(p) * Number(p.cost || 0), 0);

  const rows = ps.length
    ? ps.map(p => `
      <tr class="${stockQty(p) <= Number(p.reorder || 0) ? 'low-stock' : ''}">
        <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(p.id.slice(0,8))}…</code></td>
        <td>
          <div style="font-weight:700">${esc(p.name)}</div>
          ${p.model ? `<div style="font-size:11.5px;color:var(--muted)">${esc(p.model)}</div>` : ''}
        </td>
        <td><span class="badge badge-blue">${esc(p.category)}</span></td>
        <td>${money(p.cost)}</td>
        <td>${money(p.price)}</td>
        <td class="${stockQty(p) <= Number(p.reorder||0) ? 'text-red fw-bold' : ''}">${stockQty(p)} <small class="text-muted">${esc(p.unit || '')}</small></td>
        <td>${p.reorder || 0}</td>
        <td style="font-weight:700">${money(stockQty(p) * Number(p.cost || 0))}</td>
        <td>${statusBadge(p)}</td>
      </tr>`)
    .join('')
    : '<tr><td colspan="9" class="empty-state" style="padding:28px"><p>No products found.</p></td></tr>';

  document.getElementById('reportContent').innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Current Inventory Report</h3>
        <span style="font-size:13px;color:var(--muted)">${ps.length} products &nbsp;·&nbsp; Total Value: <b style="color:var(--text)">${money(totalVal)}</b></span>
      </div>
      <div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th>Reorder</th><th>Value</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   MOVEMENT TAB
══════════════════════════════════════════════════ */
function renderReportMovement() {
  const { ps, si, so } = _rCache;
  const all = [
    ...si.map(x => ({ ...x, _type: 'IN' })),
    ...so.map(x => ({ ...x, _type: 'OUT' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = all.length
    ? all.map(x => {
        const prod = ps.find(p => p.id === x.productId);
        return `<tr>
          <td>${fmtDate(x.date)}</td>
          <td>
            ${x._type === 'IN'
              ? '<span class="badge badge-green">📥 IN</span>'
              : '<span class="badge badge-red">📤 OUT</span>'}
          </td>
          <td>
            <div style="font-weight:700">${esc(prod?.name || '—')}</div>
            ${prod ? `<div style="font-size:11.5px;color:var(--muted)">${esc(prod.category)}</div>` : ''}
          </td>
          <td class="${x._type === 'IN' ? 'text-green' : 'text-red'} fw-bold">
            ${x._type === 'IN' ? '+' : '−'}${x.qty || 0}
          </td>
          <td>${esc(x._type === 'IN' ? (x.supplier || '—') : (x.reason || '—'))}</td>
          <td><small class="text-muted">${esc(x.createdBy || '—')}</small></td>
          <td>${esc(x.remarks || '—')}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-state" style="padding:28px"><p>No stock movements recorded yet.</p></td></tr>';

  document.getElementById('reportContent').innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3>Stock Movement Log</h3>
        <div style="display:flex;gap:8px">
          <span class="badge badge-green">IN: +${si.reduce((a,x)=>a+(x.qty||0),0)} units</span>
          <span class="badge badge-red">OUT: −${so.reduce((a,x)=>a+(x.qty||0),0)} units</span>
        </div>
      </div>
      <div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Supplier / Reason</th><th>Recorded By</th><th>Remarks</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   CSV EXPORT
══════════════════════════════════════════════════ */
function exportCSV() {
  if (!_rCache) { toast('Open the Reports page first.', 'info'); return; }
  const activeTab = document.querySelector('.tab-btn.active')?.textContent?.trim() || '';
  let csv = '', filename = 'report.csv';

  if (activeTab.includes('Sales')) {
    csv = 'Date,Receipt,Product,Qty,Price,Total,Payment,Cashier\n' +
      _rCache.ss.map(x => {
        const p = _rCache.ps.find(p => p.id === x.productId);
        return [x.date, x.receipt || x.id, p?.name || '', x.qty, x.price, (x.qty||0)*(x.price||0), x.payment || 'Cash', x.cashier || '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }).join('\n');
    filename = 'sales_report_' + todayISO() + '.csv';

  } else if (activeTab.includes('Inventory')) {
    csv = 'ID,Name,Category,Brand,Cost,Price,Stock,Unit,Reorder,Value,Status\n' +
      _rCache.ps.map(p => {
        const s = stockQty(p), r = Number(p.reorder || 0);
        const st = s <= 0 ? 'Out of Stock' : s <= r ? 'Low Stock' : 'In Stock';
        return [p.id, p.name, p.category, p.brand || '', p.cost, p.price, s, p.unit || 'pcs', r, s * Number(p.cost||0), st]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }).join('\n');
    filename = 'inventory_report_' + todayISO() + '.csv';

  } else if (activeTab.includes('Movement')) {
    csv = 'Date,Type,Product,Qty,Supplier/Reason,Recorded By,Remarks\n' + [
      ..._rCache.si.map(x => ({ ...x, _t: 'IN' })),
      ..._rCache.so.map(x => ({ ...x, _t: 'OUT' }))
    ].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x => {
      const p = _rCache.ps.find(p => p.id === x.productId);
      return [x.date, x._t, p?.name || '', x.qty, x._t === 'IN' ? (x.supplier||'') : (x.reason||''), x.createdBy||'', x.remarks||'']
        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    }).join('\n');
    filename = 'stock_movement_' + todayISO() + '.csv';

  } else {
    /* Overview — export sales as default */
    csv = 'Date,Receipt,Product,Qty,Price,Total,Payment,Cashier\n' +
      _rCache.ss.map(x => {
        const p = _rCache.ps.find(p => p.id === x.productId);
        return [x.date, x.receipt||x.id, p?.name||'', x.qty, x.price, (x.qty||0)*(x.price||0), x.payment||'Cash', x.cashier||'']
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
      }).join('\n');
    filename = 'report_export_' + todayISO() + '.csv';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV exported: ' + filename, 'success');
}
