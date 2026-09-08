/* ═══════════════════════════════════════════════════
   users.js  –  Pizza Bianos  |  Firestore + Firebase Auth
   ═══════════════════════════════════════════════════ */

const ROLES = ['Admin', 'Manager', 'Cashier', 'Staff'];

async function renderUsers() {
  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div><h2>Users / Settings</h2><p>Manage user accounts, 2FA, and system configuration.</p></div>
      <button class="btn btn-primary" onclick="userForm()">＋ Add User</button>
    </div>

    <div class="warn-box">
      <b>🔐 Two-Factor Authentication (2FA)</b> —
      When enabled for a user, they will be sent a 6-digit OTP to their Gmail on every login.
      Requires an Apps Script URL to be configured in Settings below.
    </div>

    <div class="panel mb-20">
      <div class="panel-header">
        <h3>System Users</h3>
        <span id="userCount" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div id="userTableWrap">
        <div class="empty-state"><div class="loading-spinner" style="margin:0 auto 12px"></div><p>Loading users…</p></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><h3>⚙ System Settings</h3></div>
      <div class="panel-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 24px">
          <div class="form-group">
            <label>Apps Script URL (Gmail OTP)</label>
            <input id="settingsApiUrl" class="form-control"
              placeholder="https://script.google.com/macros/s/…/exec"
              value="${esc(getApiUrl())}">
            <p style="font-size:11.5px;color:var(--muted);margin-top:5px">
              Required for 2FA OTP delivery via Gmail. All data is stored in Firebase.
            </p>
          </div>
          <div class="form-group">
            <label>Current Session</label>
            <div style="padding:12px 14px;background:var(--surface);border-radius:8px;border:1.5px solid var(--border)">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);border:1.5px solid rgba(192,57,43,.15);display:grid;place-items:center;font-weight:700;color:var(--primary);font-size:14px">
                  ${esc(initials(currentUser()?.fullname || '?'))}
                </div>
                <div>
                  <div style="font-weight:700;font-size:13.5px">${esc(currentUser()?.fullname || '—')}</div>
                  <div style="font-size:12px;color:var(--muted)">${esc(currentUser()?.role || '—')} · @${esc(currentUser()?.username || '—')}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Data Backup</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="exportAllData()">⬇ Export JSON Backup</button>
            </div>
            <p style="font-size:11.5px;color:var(--muted);margin-top:5px">Downloads all products, sales, stock-in, and stock-out records.</p>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:6px;padding-top:14px;border-top:1px solid var(--border)">
          <button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button>
        </div>
      </div>
    </div>`;

  showLoading('Loading users…');
  const us = await fbGetAll(COL.USERS, 'fullname', 'asc');
  hideLoading();
  window._allUsers = us;

  const countEl = document.getElementById('userCount');
  if (countEl) countEl.textContent = us.length + ' user(s)';
  _drawUsers(us);
}

function _drawUsers(us) {
  const cu = currentUser();

  if (!us.length) {
    document.getElementById('userTableWrap').innerHTML =
      `<div class="empty-state"><div class="es-icon">👥</div><h4>No Users</h4><p>Add the first user to get started.</p></div>`;
    return;
  }

  const rows = us.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-light);border:1.5px solid rgba(192,57,43,.12);display:grid;place-items:center;font-weight:700;color:var(--primary);font-size:13px;flex-shrink:0">
            ${esc(initials(u.fullname))}
          </div>
          <div>
            <div style="font-weight:700;font-size:13.5px">
              ${esc(u.fullname)}
              ${u.id === cu?.id ? '<span class="badge badge-blue" style="font-size:10px;margin-left:5px">You</span>' : ''}
            </div>
            <div style="font-size:11.5px;color:var(--muted)">${esc(u.email || '—')}</div>
          </div>
        </div>
      </td>
      <td><code style="font-size:12px;background:#f3f4f6;padding:2px 7px;border-radius:4px">@${esc(u.username)}</code></td>
      <td><span class="badge badge-gray">${esc(u.role)}</span></td>
      <td>
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle-input" id="2fa-${u.id}"
            ${u.twofa ? 'checked' : ''}
            ${!u.email ? 'disabled title="Add email first to enable 2FA"' : ''}
            onchange="toggle2FA('${u.id}', this.checked)">
          <label class="toggle-label" for="2fa-${u.id}"></label>
          <span style="font-size:12px;color:var(--muted)">${u.twofa && u.email ? 'Enabled' : 'Disabled'}</span>
        </div>
      </td>
      <td>
        <span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-red'}">
          ${u.status === 'Active' ? '● Active' : '○ Inactive'}
        </span>
      </td>
      <td class="actions">
        <button class="btn btn-secondary btn-xs" onclick="userForm('${u.id}')">✏ Edit</button>
        ${u.id !== cu?.id
          ? `<button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">🗑</button>`
          : '<span style="font-size:11px;color:var(--muted)">—</span>'}
      </td>
    </tr>`).join('');

  document.getElementById('userTableWrap').innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Full Name</th><th>Username</th><th>Role</th>
            <th>2FA</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="table-meta">${us.length} user(s)</div>`;
}

/* ══════════════════════════════════════════════════
   2FA TOGGLE
══════════════════════════════════════════════════ */
async function toggle2FA(id, enabled) {
  const u = (window._allUsers || []).find(x => x.id === id);
  if (enabled && !u?.email) {
    toast('Add an email address for this user to enable 2FA.', 'error');
    setTimeout(() => renderUsers(), 100);
    return;
  }
  try {
    await fbUpdate(COL.USERS, id, { twofa: enabled });
    toast(`2FA ${enabled ? 'enabled' : 'disabled'} for ${u?.fullname}.`, enabled ? 'success' : 'info');
    if (u) u.twofa = enabled;
  } catch (err) {
    toast('Failed to update 2FA: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════
   USER FORM  (Add / Edit)
══════════════════════════════════════════════════ */
async function userForm(id) {
  let p = { fullname: '', username: '', email: '', role: 'Staff', status: 'Active', twofa: false };
  if (id) {
    showLoading('Loading user…');
    p = await fbGetOne(COL.USERS, id) || p;
    hideLoading();
  }

  openModal(id ? 'Edit User' : 'Add New User', `
    <form id="uForm">
      <div class="form-grid">
        <div class="form-group full">
          <label>Full Name <span class="req">*</span></label>
          <input class="form-control" name="fullname" value="${esc(p.fullname)}"
            placeholder="e.g. Juan dela Cruz" required maxlength="80" autofocus>
        </div>
        <div class="form-group">
          <label>Username <span class="req">*</span></label>
          <input class="form-control" name="username" value="${esc(p.username)}"
            placeholder="lowercase, no spaces" required maxlength="40" autocomplete="off">
        </div>
        <div class="form-group" style="position:relative">
          <label>${id ? 'New Password' : 'Password'} <span class="req">${id ? '' : '*'}</span>
            <small style="color:var(--muted);font-weight:400"> (min. 6 characters)</small>
          </label>
          <input class="form-control" type="password" name="password" id="uPwField"
            placeholder="${id ? 'Leave blank to keep current password' : 'Min. 6 characters'}"
            ${id ? '' : 'required minlength="6"'} autocomplete="new-password" style="padding-right:42px">
          <button type="button" class="pw-toggle" onclick="togglePw('uPwField',this)" tabindex="-1">👁</button>
        </div>
        <div class="form-group">
          <label>Gmail Address ${id ? '' : '<span class="req">*</span>'}</label>
          <input class="form-control" type="email" name="email" value="${esc(p.email || '')}"
            placeholder="user@gmail.com" ${id ? '' : 'required'}>
          <p style="font-size:11px;color:var(--muted);margin-top:4px">Used for Firebase Auth login and 2FA OTP email.</p>
        </div>
        <div class="form-group">
          <label>Role <span class="req">*</span></label>
          <select class="form-control select-box" name="role">
            ${ROLES.map(r => `<option${r === p.role ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status <span class="req">*</span></label>
          <select class="form-control select-box" name="status">
            <option${p.status === 'Active'   ? ' selected' : ''}>Active</option>
            <option${p.status === 'Inactive' ? ' selected' : ''}>Inactive</option>
          </select>
        </div>
        <div class="form-group full">
          <label>Two-Factor Authentication (2FA)</label>
          <div class="toggle-wrap">
            <input type="checkbox" class="toggle-input" id="uTwofa" name="twofa" ${p.twofa ? 'checked' : ''}>
            <label class="toggle-label" for="uTwofa"></label>
            <span style="font-size:13px;color:var(--muted)">Require 6-digit OTP on every login (Gmail required)</span>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" type="submit" id="uSaveBtn">
          ${id ? '💾 Update User' : '＋ Add User'}
        </button>
      </div>
    </form>`);

  document.getElementById('uForm').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('uSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-dark"></span> Saving…';

    const f        = new FormData(e.target);
    const username = f.get('username').trim().toLowerCase();
    const password = f.get('password');
    const email    = f.get('email').trim().toLowerCase();
    const twofa    = document.getElementById('uTwofa').checked;

    /* Duplicate username check */
    const all = window._allUsers || [];
    if (all.some(x => x.username === username && x.id !== id)) {
      toast('Username already taken. Choose a different one.', 'error');
      btn.disabled = false;
      btn.textContent = id ? '💾 Update User' : '＋ Add User';
      return;
    }
    if (twofa && !email) {
      toast('An email address is required to enable 2FA.', 'error');
      btn.disabled = false;
      btn.textContent = id ? '💾 Update User' : '＋ Add User';
      return;
    }

    try {
      if (id) {
        const updates = {
          fullname: f.get('fullname').trim(),
          username,
          email,
          role:     f.get('role'),
          status:   f.get('status'),
          twofa
        };
        await fbUpdate(COL.USERS, id, updates);

        /* Update Firebase Auth password if provided */
        if (password) {
          const fbUser = auth.currentUser;
          if (fbUser && fbUser.uid === id) {
            await fbUser.updatePassword(password);
          }
        }

        /* Refresh session data if editing self */
        const cu = currentUser();
        if (id === cu?.id) {
          const fresh = await fbGetOne(COL.USERS, id);
          if (fresh) {
            sessionStorage.setItem('pb_current_user', JSON.stringify(fresh));
            document.getElementById('adminName').textContent           = fresh.fullname;
            document.getElementById('sidebarUserName').textContent     = fresh.fullname;
            document.getElementById('sidebarUserRole').textContent     = fresh.role;
            document.getElementById('sidebarUserAvatar').textContent   = initials(fresh.fullname);
            document.getElementById('topbarAvatar').textContent        = initials(fresh.fullname);
          }
        }
        toast('User updated successfully.', 'success');

      } else {
        if (!password) {
          toast('Password is required to create a user.', 'error');
          btn.disabled = false; btn.textContent = '＋ Add User'; return;
        }
        if (!email) {
          toast('Email is required to create a user.', 'error');
          btn.disabled = false; btn.textContent = '＋ Add User'; return;
        }

        /* Create Firebase Auth account */
        const cred = await auth.createUserWithEmailAndPassword(email, password);

        /* Save Firestore profile */
        await db.collection(COL.USERS).doc(cred.user.uid).set({
          uid:       cred.user.uid,
          fullname:  f.get('fullname').trim(),
          username,
          email,
          role:      f.get('role'),
          status:    f.get('status'),
          twofa,
          createdAt: new Date().toISOString()
        });
        toast('User created successfully.', 'success');
      }

      closeModal();
      renderUsers();
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'That email is already registered in Firebase Auth.' :
        err.code === 'auth/weak-password'         ? 'Password must be at least 6 characters.' :
        'Error: ' + err.message;
      toast(msg, 'error');
      btn.disabled = false;
      btn.textContent = id ? '💾 Update User' : '＋ Add User';
    }
  };
}

/* ══════════════════════════════════════════════════
   DELETE USER
══════════════════════════════════════════════════ */
async function deleteUser(id) {
  const u  = (window._allUsers || []).find(x => x.id === id);
  const ok = await confirmAction(`Delete user "${u?.fullname || id}"? This will remove their profile from Firestore.`);
  if (!ok) return;
  showLoading('Deleting user…');
  await fbDelete(COL.USERS, id);
  hideLoading();
  toast('User deleted. Remove their account from Firebase Auth Console if needed.', 'info');
  renderUsers();
}

/* ══════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════ */
function saveSettings() {
  const url = (document.getElementById('settingsApiUrl')?.value || '').trim();
  localStorage.setItem('pb_api_url', url);
  const loginInput = document.getElementById('apiUrlInput');
  if (loginInput) loginInput.value = url;
  toast(url ? 'Settings saved. OTP API URL updated.' : 'Settings saved. OTP URL cleared.', 'success');
}

async function exportAllData() {
  showLoading('Preparing backup…');
  const [ps, ss, si, so] = await Promise.all([products(), sales(), stockIns(), stockOuts()]);
  hideLoading();

  const backup = {
    exported:  new Date().toISOString(),
    source:    'Pizza Bianos Inventory – Firebase Firestore',
    products:  ps,
    sales:     ss,
    stockins:  si,
    stockouts: so
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: 'bianos_backup_' + todayISO() + '.json'
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('JSON backup exported successfully.', 'success');
}
