/* ═══════════════════════════════════════════════════
   products.js  –  Pizza Bianos  |  Firestore backend
   ═══════════════════════════════════════════════════ */

const CATEGORIES = ['Ingredients', 'Pizza', 'Drinks', 'Sides', 'Dessert', 'Supplies', 'Other'];

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
async function renderProducts() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <h2>Products</h2>
        <p>Add, edit, search and manage all inventory products.</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-primary" onclick="productForm()">＋ Add Product</button>
      </div>
    </div>

    <div id="productStats" class="stats-grid stats-grid-4" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon-wrap si-blue">🍕</div><div class="stat-body"><h3>…</h3><p>Total Products</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-green">✅</div><div class="stat-body"><h3>…</h3><p>In Stock</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-yellow">⚠️</div><div class="stat-body"><h3>…</h3><p>Low Stock</p></div></div>
      <div class="stat-card"><div class="stat-icon-wrap si-red">❌</div><div class="stat-body"><h3>…</h3><p>Out of Stock</p></div></div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h3>Product List</h3>
        <div style="display:flex;gap:8px">
          <span id="productCount" style="font-size:12px;color:var(--muted);align-self:center"></span>
        </div>
      </div>
      <div class="panel-body" style="padding-bottom:0">
        <div class="toolbar">
          <input id="productSearch" class="search-box" placeholder="🔍  Search name, category, brand…">
          <select id="productCatFilter" class="select-box">
            <option value="">All Categories</option>
            ${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('')}
          </select>
          <select id="productStatusFilter" class="select-box">
            <option value="">All Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>
      <div id="productTable">
        <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading products…</p></div>
      </div>
    </div>`;

  document.getElementById('productSearch').addEventListener('input', _filterProducts);
  document.getElementById('productCatFilter').addEventListener('change', _filterProducts);
  document.getElementById('productStatusFilter').addEventListener('change', _filterProducts);

  showLoading('Loading products…');
  window._allProducts = await products();
  hideLoading();

  /* Update stat cards */
  const all  = window._allProducts;
  const ins  = all.filter(p => stockQty(p) > Number(p.reorder || 0));
  const low  = all.filter(p => stockQty(p) > 0 && stockQty(p) <= Number(p.reorder || 0));
  const out  = all.filter(p => stockQty(p) <= 0);
  document.getElementById('productStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon-wrap si-blue">🍕</div><div class="stat-body"><h3>${all.length}</h3><p>Total Products</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-green">✅</div><div class="stat-body"><h3>${ins.length}</h3><p>In Stock</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-yellow">⚠️</div><div class="stat-body"><h3>${low.length}</h3><p>Low Stock</p></div></div>
    <div class="stat-card"><div class="stat-icon-wrap si-red">❌</div><div class="stat-body"><h3>${out.length}</h3><p>Out of Stock</p></div></div>`;

  _filterProducts();
}

function _drawProducts(list) {
  const count = document.getElementById('productCount');
  if (count) count.textContent = list.length + ' product(s)';

  if (!list.length) {
    document.getElementById('productTable').innerHTML =
      `<div class="empty-state"><div class="es-icon">🍕</div><h4>No products found</h4><p>Try adjusting your filters or add a new product.</p></div>`;
    return;
  }

  const rows = list.map(p => `
    <tr class="${stockQty(p) <= Number(p.reorder || 0) && stockQty(p) >= 0 ? (stockQty(p) <= 0 ? 'low-stock' : 'low-stock') : ''}">
      <td><code style="font-size:11px;color:var(--muted);background:#f3f4f6;padding:2px 6px;border-radius:4px">${esc(p.id.slice(0,8))}…</code></td>
      <td>
        <div style="font-weight:700;font-size:13.5px">${esc(p.name)}</div>
        ${p.model ? `<div style="font-size:11.5px;color:var(--muted);margin-top:1px">${esc(p.model)}</div>` : ''}
      </td>
      <td><span class="badge badge-blue">${esc(p.category)}</span></td>
      <td>${esc(p.brand || '—')}</td>
      <td>${money(p.cost)}</td>
      <td>${money(p.price)}</td>
      <td class="${stockQty(p) <= Number(p.reorder || 0) ? 'text-red fw-bold' : ''}">
        ${stockQty(p)}<span style="color:var(--muted);font-weight:400;font-size:11.5px"> ${esc(p.unit || 'pcs')}</span>
      </td>
      <td>${p.reorder || 0}</td>
      <td>${statusBadge(p)}</td>
      <td class="actions">
        <button class="btn btn-secondary btn-xs" onclick="productForm('${esc(p.id)}')">✏ Edit</button>
        <button class="btn btn-danger btn-xs"    onclick="deleteProduct('${esc(p.id)}')">🗑</button>
      </td>
    </tr>`).join('');

  document.getElementById('productTable').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Product Name</th><th>Category</th><th>Brand/Supplier</th>
            <th>Cost</th><th>Price</th><th>Stock</th><th>Reorder</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="table-meta">${list.length} product(s) shown</div>`;
}

function _filterProducts() {
  const q      = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const cat    = document.getElementById('productCatFilter')?.value  || '';
  const status = document.getElementById('productStatusFilter')?.value || '';
  let list     = window._allProducts || [];

  if (q)      list = list.filter(p =>
    [p.name, p.category, p.brand, p.model, p.description, p.id].join(' ').toLowerCase().includes(q)
  );
  if (cat)    list = list.filter(p => p.category === cat);
  if (status) list = list.filter(p => {
    const s = stockQty(p), r = Number(p.reorder || 0);
    if (status === 'out') return s <= 0;
    if (status === 'low') return s > 0 && s <= r;
    if (status === 'in')  return s > r;
    return true;
  });
  _drawProducts(list);
}

/* ══════════════════════════════════════════════════
   PRODUCT FORM  (Add / Edit)
══════════════════════════════════════════════════ */
async function productForm(id) {
  let p = { name: '', category: 'Ingredients', brand: '', model: '', price: 0, cost: 0, stock: 0, reorder: 5, unit: 'pcs', description: '' };
  if (id) {
    showLoading('Loading product…');
    p = await fbGetOne(COL.PRODUCTS, id) || p;
    hideLoading();
  }

  openModal(id ? 'Edit Product' : 'Add New Product', `
    <form id="pForm">
      <div class="form-grid">
        <div class="form-group full">
          <label>Product Name <span class="req">*</span></label>
          <input class="form-control" name="name" value="${esc(p.name)}"
            placeholder="e.g. Pepperoni Pizza, Mozzarella Cheese…" required maxlength="100" autofocus>
        </div>
        <div class="form-group">
          <label>Category <span class="req">*</span></label>
          <select class="form-control select-box" name="category">
            ${CATEGORIES.map(c => `<option${c === p.category ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Brand / Supplier</label>
          <input class="form-control" name="brand" value="${esc(p.brand)}" placeholder="e.g. Bianos, Supplier A">
        </div>
        <div class="form-group">
          <label>Size / Model / Variant</label>
          <input class="form-control" name="model" value="${esc(p.model)}" placeholder="e.g. Large, 12in, 1kg">
        </div>
        <div class="form-group">
          <label>Unit of Measure</label>
          <input class="form-control" name="unit" value="${esc(p.unit || 'pcs')}" placeholder="pcs / kg / bottle / slice">
        </div>
        <div class="form-group">
          <label>Cost Price (₱) <span class="req">*</span></label>
          <input class="form-control" type="number" step="0.01" min="0" name="cost" value="${p.cost}" required>
        </div>
        <div class="form-group">
          <label>Selling Price (₱) <span class="req">*</span></label>
          <input class="form-control" type="number" step="0.01" min="0" name="price" value="${p.price}" required>
        </div>
        <div class="form-group">
          <label>Current Stock <span class="req">*</span></label>
          <input class="form-control" type="number" min="0" name="stock" value="${p.stock}" required>
        </div>
        <div class="form-group">
          <label>Reorder Level <span class="req">*</span></label>
          <input class="form-control" type="number" min="0" name="reorder" value="${p.reorder}" required>
        </div>
        <div class="form-group full">
          <label>Description / Notes</label>
          <textarea class="form-control" name="description" rows="2"
            placeholder="Optional notes about this product">${esc(p.description || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" type="submit" id="pSaveBtn">
          ${id ? '💾 Update Product' : '＋ Add Product'}
        </button>
      </div>
    </form>`);

  document.getElementById('pForm').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('pSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-dark"></span> Saving…';

    const f   = new FormData(e.target);
    const obj = {
      name:        f.get('name').trim(),
      category:    f.get('category'),
      brand:       f.get('brand').trim(),
      model:       f.get('model').trim(),
      unit:        f.get('unit').trim() || 'pcs',
      cost:        +f.get('cost'),
      price:       +f.get('price'),
      stock:       +f.get('stock'),
      reorder:     +f.get('reorder'),
      description: f.get('description').trim()
    };
    if (!obj.name) {
      toast('Product name is required.', 'error');
      btn.disabled = false;
      btn.textContent = id ? '💾 Update Product' : '＋ Add Product';
      return;
    }

    try {
      if (id) {
        await fbSet(COL.PRODUCTS, id, obj);
        toast('Product updated successfully.', 'success');
      } else {
        obj.createdAt = new Date().toISOString();
        await fbAdd(COL.PRODUCTS, obj);
        toast('Product added successfully.', 'success');
      }
      closeModal();
      renderProducts();
    } catch (err) {
      toast('Error saving product: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = id ? '💾 Update Product' : '＋ Add Product';
    }
  };
}

/* ══════════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════════ */
async function deleteProduct(id) {
  const p  = (window._allProducts || []).find(x => x.id === id);
  const ok = await confirmAction(`Delete "${p?.name || id}"? This action cannot be undone.`);
  if (!ok) return;
  showLoading('Deleting product…');
  await fbDelete(COL.PRODUCTS, id);
  hideLoading();
  toast('Product deleted.', 'info');
  renderProducts();
}
