/* =========================================================
   Utility helpers
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = (NS.util = {});

  // Storage namespacing
  U.K = {
    USERS:   'mbg.users.v1',
    DATA:    'mbg.data.v1',
    SETTING: 'mbg.settings.v1',
    SESSION: 'mbg.session',
    THEME:   'mbg.theme'
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
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; }
  };
  U.write = function (k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  };
  U.remove = function (k) { localStorage.removeItem(k); };

  // Number formatting (id-ID)
  U.fmt = function (n, opts) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('id-ID', Object.assign({ maximumFractionDigits: 2 }, opts || {}));
  };
  U.pct = function (n, digits) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return (Number(n) * 100).toLocaleString('id-ID', { minimumFractionDigits: digits ?? 1, maximumFractionDigits: digits ?? 1 }) + '%';
  };

  // Excel serial date <-> JS date
  U.excelToDate = function (serial) {
    if (typeof serial !== 'number') return null;
    // 25569 = days between 1899-12-30 and 1970-01-01
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    return new Date(ms);
  };
  U.dateToExcel = function (d) {
    return Math.floor(d.getTime() / 86400000) + 25569;
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

  // Toast notifications
  U.toast = function (msg, type) {
    type = type || 'info';
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
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  };

  // PBKDF2 hash (SHA-256, 200k iters)
  U.hashPassword = async function (password, saltHex) {
    const enc = new TextEncoder();
    const salt = saltHex
      ? hexToBytes(saltHex)
      : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return {
      salt: bytesToHex(salt),
      hash: bytesToHex(new Uint8Array(bits))
    };
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

  // Theme
  U.applyTheme = function (theme) {
    const t = theme || localStorage.getItem(U.K.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(U.K.THEME, t);
  };
  U.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    U.applyTheme(cur);
    return cur;
  };

  // Cross-tab event bus
  U.bus = (function () {
    const channelName = 'mbg-bus';
    let bc = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(channelName);
    }
    const listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); }
    function emit(evt, payload) {
      const msg = { evt, payload, ts: Date.now() };
      if (bc) bc.postMessage(msg);
      // localStorage echo for browsers without BroadcastChannel
      try {
        localStorage.setItem('mbg.bus.last', JSON.stringify(msg));
      } catch (e) {}
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
      // Also react to direct data store changes
      if (e.key === U.K.DATA) {
        dispatchLocal({ evt: 'data:changed', payload: { source: 'storage' } });
      }
    });
    return { on, off, emit };
  })();

  // Apply theme immediately on load
  U.applyTheme();
})();
