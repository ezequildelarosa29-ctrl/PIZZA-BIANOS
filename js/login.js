/* ═══════════════════════════════════════════════════
   login.js  –  Pizza Bianos Inventory System
   Firebase Auth login + Firestore user lookup
   + 2FA OTP flow via Apps Script Gmail
   ═══════════════════════════════════════════════════ */

/* ── OTP state ──────────────────────────────────── */
let _otpPending   = null;   // { hash, expires }
let _otpUser      = null;   // Firestore user doc
let _otpTimer     = null;
let _otpCountdown = 0;
const OTP_TTL_SEC = 300;

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
function _hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}
function _genOtp() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, '0');
}
function _maskEmail(email) {
  if (!email?.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

/* ══════════════════════════════════════════════════
   DOM HELPERS
══════════════════════════════════════════════════ */
function setLoginBusy(busy) {
  const btn = document.getElementById('loginBtn');
  if (btn) btn.disabled = busy;
  const txt = document.getElementById('loginBtnText');
  if (txt) txt.textContent = busy ? 'Verifying…' : 'Sign In';
  document.getElementById('loginSpinner')?.classList.toggle('hidden', !busy);
}
function setVerifyBusy(busy) {
  const btn = document.getElementById('verifyBtn');
  if (btn) btn.disabled = busy;
  document.getElementById('verifySpinner')?.classList.toggle('hidden', !busy);
}
function setLoginMsg(msg, type = 'error') {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? 'var(--red)' : 'var(--green)';
}
function setOtpMsg(msg, type = 'error') {
  const el = document.getElementById('otpMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? 'var(--red)' : 'var(--green)';
}

/* ══════════════════════════════════════════════════
   STEP SWITCHING
══════════════════════════════════════════════════ */
function showStep2(maskedEmail) {
  document.getElementById('step1').classList.add('hidden');
  document.getElementById('step2').classList.remove('hidden');
  const info = document.getElementById('otpInfoText');
  if (info) info.textContent = `A 6-digit OTP has been sent to ${maskedEmail}. Check your Gmail inbox.`;
  document.getElementById('otpInput').value = '';
  document.getElementById('otpInput').focus();
  startOtpTimer();
}
function backToStep1() {
  clearOtpTimer();
  _otpPending = null;
  _otpUser    = null;
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
  document.getElementById('otpInput').value = '';
  setOtpMsg('');
}

/* ══════════════════════════════════════════════════
   OTP TIMER
══════════════════════════════════════════════════ */
function startOtpTimer() {
  clearOtpTimer();
  _otpCountdown = OTP_TTL_SEC;
  document.getElementById('resendBtn').style.display = 'none';
  _tick();
  _otpTimer = setInterval(_tick, 1000);
}
function _tick() {
  const el = document.getElementById('otpTimer');
  if (!el) { clearOtpTimer(); return; }
  if (_otpCountdown <= 0) {
    clearOtpTimer();
    el.textContent = '00:00';
    document.getElementById('resendBtn').style.display = 'inline';
    setOtpMsg('OTP has expired. Please request a new one.');
    return;
  }
  const m = String(Math.floor(_otpCountdown / 60)).padStart(2, '0');
  const s = String(_otpCountdown % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
  _otpCountdown--;
}
function clearOtpTimer() {
  if (_otpTimer) { clearInterval(_otpTimer); _otpTimer = null; }
}

/* ══════════════════════════════════════════════════
   SEND OTP
══════════════════════════════════════════════════ */
async function sendOtpEmail(userDoc) {
  const otp = _genOtp();
  _otpPending = { hash: _hashStr(otp), expires: Date.now() + OTP_TTL_SEC * 1000 };

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendOtp', email: userDoc.email, otp, name: userDoc.fullname })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Send failed');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } else {
    /* Demo fallback */
    console.info(`[DEMO OTP] ${userDoc.username}: ${otp}`);
    alert(`[DEMO – No OTP API URL configured]\n\nYour OTP is: ${otp}\n\n(In production this is emailed to ${userDoc.email})`);
    return { ok: true };
  }
}

async function resendOtp() {
  if (!_otpUser) { backToStep1(); return; }
  setOtpMsg('');
  document.getElementById('resendBtn').style.display = 'none';
  setVerifyBusy(true);
  const result = await sendOtpEmail(_otpUser);
  setVerifyBusy(false);
  if (result.ok) {
    setOtpMsg('A new OTP has been sent.', 'success');
    startOtpTimer();
  } else {
    setOtpMsg('Failed to resend: ' + result.error);
  }
}

/* ══════════════════════════════════════════════════
   STEP 1 – LOGIN FORM
══════════════════════════════════════════════════ */
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  setLoginMsg('');
  setLoginBusy(true);

  const usernameVal = document.getElementById('username').value.trim().toLowerCase();
  const password    = document.getElementById('password').value;

  try {
    /* Lookup user by username */
    const snap = await db.collection(COL.USERS)
      .where('username', '==', usernameVal)
      .where('status',   '==', 'Active')
      .limit(1)
      .get();

    if (snap.empty) {
      setLoginMsg('Invalid username or password, or account is inactive.');
      setLoginBusy(false);
      _shakeCard();
      return;
    }

    const userDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };

    /* Firebase Auth sign-in */
    await auth.signInWithEmailAndPassword(userDoc.email, password);

    /* Remember me */
    if (document.getElementById('rememberMe').checked) {
      localStorage.setItem('pb_remember_username', usernameVal);
    } else {
      localStorage.removeItem('pb_remember_username');
    }

    setLoginBusy(false);

    /* 2FA check */
    if (userDoc.twofa && userDoc.email) {
      _otpUser = userDoc;
      setLoginBusy(true);
      const result = await sendOtpEmail(userDoc);
      setLoginBusy(false);
      if (result.ok) {
        showStep2(_maskEmail(userDoc.email));
      } else {
        setLoginMsg('Could not send OTP: ' + result.error);
      }
    } else {
      completeLogin(userDoc);
    }
  } catch (err) {
    setLoginBusy(false);
    const msg =
      err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
        ? 'Invalid username or password.'
        : err.code === 'auth/too-many-requests'
        ? 'Too many failed attempts. Please try again later.'
        : 'Login error: ' + err.message;
    setLoginMsg(msg);
    _shakeCard();
  }
});

/* ══════════════════════════════════════════════════
   STEP 2 – OTP VERIFY
══════════════════════════════════════════════════ */
document.getElementById('otpForm').addEventListener('submit', e => {
  e.preventDefault();
  setOtpMsg('');

  if (!_otpPending || !_otpUser) { backToStep1(); return; }
  if (Date.now() > _otpPending.expires) {
    setOtpMsg('OTP has expired. Please request a new one.'); return;
  }

  const entered = document.getElementById('otpInput').value.trim();
  if (!/^\d{6}$/.test(entered)) {
    setOtpMsg('Please enter the 6-digit OTP code.'); return;
  }
  if (_hashStr(entered) !== _otpPending.hash) {
    setOtpMsg('Incorrect OTP. Please try again.');
    document.getElementById('otpInput').value = '';
    document.getElementById('otpInput').focus();
    return;
  }

  clearOtpTimer();
  _otpPending = null;
  const user  = _otpUser;
  _otpUser    = null;
  completeLogin(user);
});

/* ══════════════════════════════════════════════════
   COMPLETE LOGIN
══════════════════════════════════════════════════ */
function completeLogin(userDoc) {
  const safe = { ...userDoc };
  delete safe.passwordHash;
  sessionStorage.setItem('pb_current_user', JSON.stringify(safe));

  /* Show app, hide login */
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');

  /* Populate topbar & sidebar user info */
  const name = userDoc.fullname;
  const abbr = initials(name);

  document.getElementById('adminName').textContent           = name;
  document.getElementById('sidebarUserName').textContent     = name;
  document.getElementById('sidebarUserRole').textContent     = userDoc.role;
  document.getElementById('sidebarUserAvatar').textContent   = abbr;
  document.getElementById('topbarAvatar').textContent        = abbr;

  setSyncStatus('online');

  const hash       = window.location.hash.replace('#', '').trim();
  const validPages = Object.keys(PAGE_INFO);
  navigate(validPages.includes(hash) ? hash : 'dashboard');
}

/* ══════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════ */
async function logout() {
  clearOtpTimer();
  try { await auth.signOut(); } catch (_) {}
  sessionStorage.removeItem('pb_current_user');
  document.getElementById('appPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step1').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  setLoginMsg('');
  setSyncStatus('offline');
}

/* ══════════════════════════════════════════════════
   MISC HELPERS
══════════════════════════════════════════════════ */
function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}
function showForgotPassword() {
  alert('Please contact your system administrator to reset your password.\n\nFirebase Console → Authentication → Users → Reset password link');
}
function _shakeCard() {
  const card = document.querySelector('.login-right-panel');
  if (!card) return;
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'shake .4s ease';
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
async function initLogin() {
  /* Inject shake keyframe */
  if (!document.getElementById('shakeStyle')) {
    const s = document.createElement('style');
    s.id = 'shakeStyle';
    s.textContent = `@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`;
    document.head.appendChild(s);
  }

  /* Restore remembered username */
  const remembered = localStorage.getItem('pb_remember_username');
  if (remembered) {
    const el = document.getElementById('username');
    if (el) { el.value = remembered; }
    const cb = document.getElementById('rememberMe');
    if (cb) cb.checked = true;
  }

  /* Restore API URL */
  const savedUrl = getApiUrl();
  const inp = document.getElementById('apiUrlInput');
  if (inp && savedUrl) inp.value = savedUrl;

  /* Seed default admin if Firestore is empty */
  await seedAdminIfNeeded();

  /* Auto-login if Firebase session still valid */
  auth.onAuthStateChanged(async firebaseUser => {
    if (firebaseUser && !currentUser()) {
      try {
        const doc = await db.collection(COL.USERS).doc(firebaseUser.uid).get();
        if (doc.exists && doc.data().status === 'Active') {
          completeLogin({ id: doc.id, ...doc.data() });
        }
      } catch (_) {}
    }
  });
}

document.addEventListener('DOMContentLoaded', initLogin);
