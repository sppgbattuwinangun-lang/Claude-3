/* =========================================================
   Utility helpers + Version migration + Robust error reporting
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = (NS.util = {});

  // ----------------------------------------------------------------
  // APP VERSION — bump to force factory-reset on existing browsers.
  // Tiap kali ada perubahan struktur localStorage / breaking change,
  // naikkan angka ini. Saat berubah, semua data lama (users, session,
  // data, settings) akan dihapus dan user kembali ke kondisi default.
  // ----------------------------------------------------------------
  U.APP_VERSION = '2.1.0';
  U.VERSION_KEY = 'mbg.app.version';

  // Storage namespacing
  U.K = {
    USERS:   'mbg.users.v1',
    DATA:    'mbg.data.v1',
    SETTING: 'mbg.settings.v1',
    SESSION: 'mbg.session',
    THEME:   'mbg.theme',
    SEED:    'mbg.autoSeeded.v3'
  };

  // ---------- Factory reset (run on EVERY page load) ----------
  // Hapus semua data MBG di localStorage bila versi berubah.
  // Ini menyelesaikan masalah:
  //  - Password lama yang sudah diganti masih tersimpan
  //  - Schema data lama tidak kompatibel dengan code baru
  //  - Session corrupt/stuck
  U.factoryResetIfNeeded = function () {
    let savedVersion;
    try {
      savedVersion = localStorage.getItem(U.VERSION_KEY);
    } catch (e) {
      savedVersion = null;
    }
    if (savedVersion === U.APP_VERSION) return false;

    // Versi berbeda → wipe semua key bernama mbg.*
    const toRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mbg.')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(U.VERSION_KEY, U.APP_VERSION);
    } catch (e) {
      console.error('[factoryReset] gagal:', e);
    }
    // Tandai bahwa baru saja di-reset (untuk tampilkan toast info)
    window.__mbgJustReset = true;
    console.info('[MBG] Factory reset: ' + (savedVersion || 'first-install') + ' → ' + U.APP_VERSION + ' · removed ' + toRemove.length + ' keys');
    return true;
  };

  // Manual reset — dipanggil dari login page bila user lupa password
  U.factoryResetManual = function () {
    const toRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mbg.')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(U.VERSION_KEY, U.APP_VERSION);
    } catch (e) {
      console.error('[manualReset] gagal:', e);
    }
    return toRemove.length;
  };

  U.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  U.read = function (k, def) {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null || raw === undefined) return def;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? def : parsed;
    } catch (e) {
      console.warn('[read] corrupt key', k, e);
      try { localStorage.removeItem(k); } catch (e2) {}
      return def;
    }
  };
  U.write = function (k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { console.error('[write] gagal:', k, e); }
  };
  U.remove = function (k) { try { localStorage.removeItem(k); } catch (e) {} };

  // Number formatting (id-ID)
  U.fmt = function (n, opts) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('id-ID', Object.assign({ maximumFractionDigits: 2 }, opts || {}));
  };
  U.pct = function (n, digits) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return (Number(n) * 100).toLocaleString('id-ID', { minimumFractionDigits: digits ?? 1, maximumFractionDigits: digits ?? 1 }) + '%';
  };

  U.todayISO = function () {
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  };
  U.dayName = function (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
  };
  U.fmtDate = function (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const z = (n) => String(n).padStart(2, '0');
    return z(d.getDate()) + '/' + z(d.getMonth()+1) + '/' + d.getFullYear();
  };
  U.fmtDateLong = function (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ---------- Toast notifications ----------
  U.toast = function (msg, type, duration) {
    type = type || 'info';
    duration = duration || 2800;
    let area = document.getElementById('toastArea');
    if (!area) {
      area = document.createElement('div');
      area.id = 'toastArea';
      area.className = 'toast-area';
      document.body.appendChild(area);
    }
    const t = document.createElement('div');
    t.className = 'toast t-' + type;
    t.textContent = msg;
    area.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, duration - 400);
    setTimeout(() => t.remove(), duration);
    return t;
  };

  // ---------- PBKDF2 hash ----------
  U.hashPassword = async function (password, saltHex) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('Crypto API tidak tersedia (butuh HTTPS atau localhost)');
    }
    const enc = new TextEncoder();
    const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
  };
  U.verifyPassword = async function (password, saltHex, expectedHashHex) {
    const { hash } = await U.hashPassword(password, saltHex);
    return constantTimeEqual(hash, expectedHashHex);
  };
  function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i*2, 2), 16);
    return arr;
  }
  function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  // ---------- Theme ----------
  U.applyTheme = function (theme) {
    const t = theme || (function () {
      try { return localStorage.getItem(U.K.THEME); } catch (e) { return null; }
    })() || 'dark'; // default dark untuk premium look
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(U.K.THEME, t); } catch (e) {}
  };
  U.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    U.applyTheme(cur);
    return cur;
  };

  // ---------- Cross-tab event bus ----------
  U.bus = (function () {
    const channelName = 'mbg-bus';
    let bc = null;
    if ('BroadcastChannel' in window) {
      try { bc = new BroadcastChannel(channelName); } catch (e) { bc = null; }
    }
    const listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); }
    function emit(evt, payload) {
      const msg = { evt, payload, ts: Date.now() };
      if (bc) { try { bc.postMessage(msg); } catch (e) {} }
      try { localStorage.setItem('mbg.bus.last', JSON.stringify(msg)); } catch (e) {}
      dispatchLocal(msg);
    }
    function dispatchLocal(msg) {
      (listeners[msg.evt] || []).forEach(fn => {
        try { fn(msg.payload, msg); } catch (e) { console.error(e); }
      });
    }
    if (bc) {
      bc.onmessage = (e) => dispatchLocal(e.data || {});
    }
    window.addEventListener('storage', (e) => {
      if (e.key === 'mbg.bus.last' && e.newValue) {
        try { dispatchLocal(JSON.parse(e.newValue)); } catch (err) {}
      }
      if (e.key === U.K.DATA) {
        dispatchLocal({ evt: 'data:changed', payload: { source: 'storage' } });
      }
    });
    return { on, off, emit };
  })();

  // ---------- Run factory reset + apply theme on load ----------
  U.factoryResetIfNeeded();
  U.applyTheme();
})();
