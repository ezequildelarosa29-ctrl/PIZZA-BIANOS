/* ═══════════════════════════════════════════════════════════
   PIZZA BIANOS – INVENTORY MANAGEMENT SYSTEM
   app.js  |  Firebase Auth + Firestore engine
   ═══════════════════════════════════════════════════════════ */

import { auth, db } from './firebase-config.js';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection, doc,
  addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════ */
export const Auth = {

  async login(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      const profile = snap.exists() ? snap.data() : { role: 'Staff', name: email };
      sessionStorage.setItem('pb_session', JSON.stringify({
        uid:      cred.user.uid,
        email:    cred.user.email,
        name:     profile.name  || cred.user.email,
        role:     profile.role  || 'Staff',
        username: profile.username || cred.user.email,
      }));
      return { ok: true };
    } catch (err) {
      const msg = ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(err.code)
        ? 'Invalid email or password.'
        : err.message;
      return { ok: false, error: msg };
    }
  },

  async logout() {
    await signOut(auth);
    sessionStorage.removeItem('pb_session');
    window.location.href = 'index.html';
  },

  session() {
    try { return JSON.parse(sessionStorage.getItem('pb_session')); } catch { return null; }
  },

  isAdmin() {
    const s = Auth.session();
    return s && s.role === 'Administrator';
  },

  async syncSession() {
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    const snap    = await getDoc(doc(db, 'users', fbUser.uid));
    const profile = snap.exists() ? snap.data() : { role: 'Staff', name: fbUser.email };
    const s = {
      uid:      fbUser.uid,
      email:    fbUser.email,
      name:     profile.name     || fbUser.email,
      role:     profile.role     || 'Staff',
      username: profile.username || fbUser.email,
    };
    sessionStorage.setItem('pb_session', JSON.stringify(s));
    return s;
  },
};

/* ══════════════════════════════════════════════════════════
   DATABASE  (Firestore wrappers)
   ══════════════════════════════════════════════════════════ */
export const DB = {

  /* Products */
  async getProducts() {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addProduct(data) {
    const ref = await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },
  async updateProduct(id, data) {
    await updateDoc(doc(db, 'products', id), data);
  },
  async deleteProduct(id) {
    await deleteDoc(doc(db, 'products', id));
  },
  async getProduct(id) {
    const snap = await getDoc(doc(db, 'products', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  onProducts(cb) {
    return onSnapshot(query(collection(db, 'products'), orderBy('name')), snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  /* Stock In */
  async getStockIn() {
    const snap = await getDocs(query(collection(db, 'stockIn'), orderBy('date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addStockIn(data) {
    await updateDoc(doc(db, 'products', data.productId), { quantity: increment(Number(data.quantity)) });
    const ref = await addDoc(collection(db, 'stockIn'), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  /* Stock Out */
  async getStockOut() {
    const snap = await getDocs(query(collection(db, 'stockOut'), orderBy('date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addStockOut(data) {
    const prod = await DB.getProduct(data.productId);
    if (!prod) return { ok: false, error: 'Product not found.' };
    if (prod.quantity < Number(data.quantity))
      return { ok: false, error: `Insufficient stock. Available: ${prod.quantity} ${prod.unit}` };
    await updateDoc(doc(db, 'products', data.productId), { quantity: increment(-Number(data.quantity)) });
    const ref = await addDoc(collection(db, 'stockOut'), { ...data, createdAt: serverTimestamp() });
    return { ok: true, id: ref.id };
  },

  /* Sales */
  async getSales() {
    const snap = await getDocs(query(collection(db, 'sales'), orderBy('date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addSale(data) {
    const ref = await addDoc(collection(db, 'sales'), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  /* Users */
  async getUsers() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async updateUserProfile(uid, data) {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  },

  /* Settings */
  async getSettings() {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    return snap.exists() ? snap.data() : {
      storeName: 'Pizza Bianos',
      storeAddress: 'Cagayan de Oro, Misamis Oriental',
      contactNumber: '09123456789',
      lowStockThreshold: 5,
    };
  },
  async saveSettings(data) {
    await setDoc(doc(db, 'settings', 'general'), data);
  },
};

/* ══════════════════════════════════════════════════════════
   SEED DATA — runs once if Firestore products is empty
   ══════════════════════════════════════════════════════════ */
export async function seedIfEmpty() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    if (!snap.empty) return;
    const samples = [
      { name:'Dough',        category:'Ingredients', supplier:'Supplier A', quantity:50,  unit:'pcs',    reorderLevel:10 },
      { name:'Cheese',       category:'Ingredients', supplier:'Supplier B', quantity:30,  unit:'kg',     reorderLevel:5  },
      { name:'Pepperoni',    category:'Ingredients', supplier:'Supplier C', quantity:20,  unit:'kg',     reorderLevel:5  },
      { name:'Pizza Sauce',  category:'Ingredients', supplier:'Supplier A', quantity:15,  unit:'bottle', reorderLevel:3  },
      { name:'Mushroom',     category:'Vegetables',  supplier:'Supplier D', quantity:25,  unit:'kg',     reorderLevel:5  },
      { name:'Olives',       category:'Vegetables',  supplier:'Supplier D', quantity:4,   unit:'can',    reorderLevel:5  },
      { name:'Bell Pepper',  category:'Vegetables',  supplier:'Supplier D', quantity:12,  unit:'kg',     reorderLevel:3  },
      { name:'Tomato',       category:'Vegetables',  supplier:'Supplier D', quantity:18,  unit:'kg',     reorderLevel:4  },
      { name:'Olive Oil',    category:'Ingredients', supplier:'Supplier A', quantity:8,   unit:'bottle', reorderLevel:2  },
      { name:'Pizza Box',    category:'Packaging',   supplier:'Supplier E', quantity:100, unit:'pcs',    reorderLevel:20 },
      { name:'Tissue Paper', category:'Packaging',   supplier:'Supplier E', quantity:50,  unit:'pack',   reorderLevel:10 },
      { name:'Softdrinks',   category:'Beverages',   supplier:'Supplier F', quantity:24,  unit:'can',    reorderLevel:6  },
      { name:'Water Bottle', category:'Beverages',   supplier:'Supplier F', quantity:48,  unit:'pcs',    reorderLevel:12 },
    ];
    await Promise.all(samples.map(p => addDoc(collection(db, 'products'), { ...p, createdAt: serverTimestamp() })));
    console.log('✅ Sample products seeded.');
  } catch (e) {
    console.warn('Seed skipped:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════
   UI UTILITIES
   ══════════════════════════════════════════════════════════ */
export function showToast(msg, type = 'success', duration = 3200) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

export function formatPeso(n) {
  return '₱ ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

export function formatDate(d) {
  if (!d) return '—';
  if (d?.toDate) d = d.toDate();
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-PH', { month:'short', day:'2-digit', year:'numeric' });
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
export function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
export function confirmDelete(msg = 'Delete this record?') { return confirm(msg); }

export function paginate(data, page, size) {
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p     = Math.min(Math.max(1, page), pages);
  return { data: data.slice((p-1)*size, p*size), page:p, pages, total, from: total===0?0:(p-1)*size+1, to: Math.min(p*size,total) };
}

export function renderPagination(containerId, paged, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (paged.pages <= 1) { el.innerHTML = ''; return; }
  let html = `<div class="flex-center gap-6" style="padding:14px 16px;border-top:1px solid var(--border)">`;
  html += `<span class="table-meta" style="padding:0">Showing ${paged.from}–${paged.to} of ${paged.total}</span>`;
  html += `<div class="flex-center gap-6" style="margin-left:auto">`;
  html += `<button class="btn btn-ghost btn-sm" ${paged.page===1?'disabled':''} data-pg="${paged.page-1}">‹ Prev</button>`;
  for (let i=1; i<=paged.pages; i++)
    html += `<button class="btn btn-sm ${i===paged.page?'btn-primary':'btn-ghost'}" data-pg="${i}">${i}</button>`;
  html += `<button class="btn btn-ghost btn-sm" ${paged.page===paged.pages?'disabled':''} data-pg="${paged.page+1}">Next ›</button>`;
  html += `</div></div>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-pg]').forEach(btn => btn.addEventListener('click', () => onPage(+btn.dataset.pg)));
}

export function renderBarChart(canvasId, labels, values) {
  const wrap = document.getElementById(canvasId);
  if (!wrap) return;
  const max = Math.max(...values, 1);
  wrap.innerHTML = labels.map((lbl, i) => {
    const pct = Math.round((values[i]/max)*100);
    return `<div class="bar-col">
      <span class="bar-val">${values[i]}</span>
      <div class="bar" style="height:${pct}%"></div>
      <span class="bar-label">${lbl}</span>
    </div>`;
  }).join('');
}

export function getLowStockCount(products, threshold = 5) {
  return products.filter(p => (p.quantity||0) <= threshold).length;
}

export function initSidebar() {
  const menuBtn = document.getElementById('menuBtn');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay?.classList.toggle('hidden'); });
    overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.add('hidden'); });
  }
}

export function initTopbar(session) {
  if (!session) return;
  const initial = (session.name || session.email).charAt(0).toUpperCase();
  ['topbarUserName','sbUserName'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = session.name||session.email; });
  ['topbarAvatar','sbAvatar'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = initial; });
  const sbRole = document.getElementById('sbUserRole'); if(sbRole) sbRole.textContent = session.role;
  document.querySelectorAll('.logout-btn, .sb-logout-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (confirm('Logout?')) Auth.logout(); });
  });
}

export function markActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[data-page]').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
}

export function authGuard(cb) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) { window.location.href = 'index.html'; return; }
    let s = Auth.session();
    if (!s || s.uid !== fbUser.uid) s = await Auth.syncSession();
    initSidebar();
    initTopbar(s);
    markActiveNav();
    cb(s);
  });
}

/* Expose to global */
window.PB = {
  Auth, DB, auth, db, seedIfEmpty,
  showToast, formatPeso, formatDate, today,
  openModal, closeModal, confirmDelete,
  paginate, renderPagination, renderBarChart,
  getLowStockCount, authGuard, initSidebar, initTopbar, markActiveNav,
};
