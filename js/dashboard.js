/* ═══════════════════════════════════════════════════
   dashboard.js  –  Pizza Bianos Inventory System
   Early-load utility guards (loads before app.js)
   ═══════════════════════════════════════════════════ */

if (typeof money === 'undefined') {
  window.money = v => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
if (typeof esc === 'undefined') {
  window.esc = v => String(v ?? '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])
  );
}
if (typeof uid === 'undefined') {
  window.uid = (p = 'id') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}
if (typeof todayISO === 'undefined') {
  window.todayISO = () => new Date().toISOString().slice(0, 10);
}
if (typeof fmtDate === 'undefined') {
  window.fmtDate = iso => {
    if (!iso) return '—';
    try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  };
}
if (typeof stockQty === 'undefined') {
  window.stockQty = p => Number(p.stock || 0);
}
if (typeof statusBadge === 'undefined') {
  window.statusBadge = p => {
    const s = window.stockQty(p), r = Number(p.reorder || 0);
    if (s <= 0) return '<span class="badge badge-red">Out of Stock</span>';
    if (s <= r) return '<span class="badge badge-yellow">Low Stock</span>';
    return '<span class="badge badge-green">In Stock</span>';
  };
}
if (typeof initials === 'undefined') {
  window.initials = name => (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
