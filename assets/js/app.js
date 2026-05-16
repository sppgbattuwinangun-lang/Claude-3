/* =========================================================
   App orchestrator — bulletproof edition
   ========================================================= */
(function () {
  'use strict';

  // ---------- Global error capture ----------
  // Tampilkan error overlay yang bisa di-copy & memberi tombol "Reset Aplikasi".
  // Ini menjamin layar tidak pernah benar-benar putih.
  function showFatalError(err, where) {
    try {
      // Hapus overlay lama bila ada
      document.querySelectorAll('.mbg-fatal').forEach(el => el.remove());

      const wrap = document.createElement('div');
      wrap.className = 'mbg-fatal';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(10,10,30,.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif;color:#fff;';

      const card = document.createElement('div');
      card.style.cssText = 'max-width:560px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:28px 30px;box-shadow:0 20px 60px rgba(0,0,0,.5);';
      card.innerHTML =
        '<div style="font-size:42px">⚠️</div>' +
        '<h2 style="margin:8px 0 4px 0;font-size:20px;font-weight:700">Aplikasi gagal dimuat</h2>' +
        '<p style="color:#cbd5e1;font-size:13.5px;line-height:1.55;margin:0 0 14px 0">Terjadi kesalahan saat membuka aplikasi. Pesan error tertera di bawah. Coba klik <b>Reset Aplikasi</b> untuk membersihkan data lokal lalu mulai dari nol.</p>' +
        '<div style="background:rgba(0,0,0,.4);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px 14px;font-family:monospace;font-size:12px;color:#fca5a5;max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word">' +
          escapeHtml((where ? '[' + where + '] ' : '') + (err && (err.stack || err.message) || String(err))) +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">' +
          '<button id="mbgFatalReload" style="flex:1;min-width:140px;padding:11px 16px;border-radius:12px;border:0;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:600;cursor:pointer">Muat Ulang</button>' +
          '<button id="mbgFatalReset" style="flex:1;min-width:140px;padding:11px 16px;border-radius:12px;border:1px solid rgba(239,68,68,.5);background:rgba(239,68,68,.1);color:#fca5a5;font-weight:600;cursor:pointer">Reset Aplikasi</button>' +
          '<button id="mbgFatalLogin" style="flex:1;min-width:140px;padding:11px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#cbd5e1;font-weight:600;cursor:pointer">Ke Login</button>' +
        '</div>';

      wrap.appendChild(card);
      document.body.appendChild(wrap);

      document.getElementById('mbgFatalReload').onclick = function () { location.reload(); };
      document.getElementById('mbgFatalLogin').onclick = function () { location.replace('./login.html'); };
      document.getElementById('mbgFatalReset').onclick = function () {
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('mbg.')) localStorage.removeItem(k);
          }
        } catch (e) {}
        location.replace('./login.html');
      };
    } catch (ex) {
      // Last-resort: alert
      alert('Error fatal: ' + (err && err.message || err));
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window.addEventListener('error', function (e) {
    console.error('[MBG window.error]', e.error || e.message);
    // Hanya tampilkan overlay untuk error yang BUKAN dari resource (img, script, dll)
    if (e.error || (e.message && !/Script error/i.test(e.message))) {
      // Tampilkan overlay non-fatal sederhana sebagai toast (tanpa block UI) bila app sudah mount
      const appMounted = document.querySelector('.app, .login-shell');
      if (appMounted && document.querySelector('.toast-area')) {
        try {
          const t = document.createElement('div');
          t.className = 'toast t-error';
          t.style.cssText = 'border-left-color:#f87171';
          t.textContent = 'Error: ' + (e.message || 'Unknown');
          document.querySelector('.toast-area').appendChild(t);
          setTimeout(() => t.remove(), 5000);
        } catch (ex) {}
      } else {
        // Sebelum mount — fatal overlay
        showFatalError(e.error || e.message, e.filename + ':' + e.lineno);
      }
    }
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[MBG unhandledrejection]', e.reason);
  });

  // ---------- Begin app ----------
  try {
    runApp();
  } catch (err) {
    showFatalError(err, 'app.runApp');
  }

  function runApp() {
    const NS = window.MBG;
    if (!NS) throw new Error('MBG namespace tidak ditemukan — script utils.js gagal dimuat?');
    const U = NS.util, A = NS.auth, S = NS.store;
    if (!U || !A || !S) throw new Error('Modul inti tidak lengkap (utils/auth/store)');

    const App = (NS.app = NS.app || {});

    // Auth guard
    const session = A.requireAuth();
    if (!session) return;
    if (session.mustChangePassword) {
      location.replace('./login.html');
      return;
    }

    // Set who-am-I
    safeSet('whoName', session.user.username);
    safeSet('whoRole', session.user.role || 'admin');
    const av = document.getElementById('avatar');
    if (av) av.textContent = (session.user.username[0] || 'A').toUpperCase();

    // Auto-seed 1 hari dummy bila kosong (fresh install)
    safe(() => {
      if (S.autoSeedIfEmpty()) {
        setTimeout(() => U.toast('Data contoh 1 hari otomatis dimuat. Silakan ubah/tambah sesuai kebutuhan.', 'success', 4500), 800);
      }
    }, 'autoSeed');

    // Theme button
    onClick('btnTheme', () => {
      U.toggleTheme();
      safe(() => NS.dashboard && NS.dashboard.render(), 'theme:dashboard');
      if (document.getElementById('page-grafik') && document.getElementById('page-grafik').classList.contains('active')) {
        safe(() => NS.charts && NS.charts.render(), 'theme:charts');
      }
      if (document.getElementById('page-laporan') && document.getElementById('page-laporan').classList.contains('active')) {
        safe(() => NS.pdf && NS.pdf.renderPreview(), 'theme:pdf');
      }
    });

    // Logout
    onClick('btnLogout', () => {
      if (!confirm('Keluar dari aplikasi?')) return;
      A.logout();
      location.replace('./login.html');
    });

    // Mobile sidebar toggle
    const sidebar = document.getElementById('sidebar');
    const mask = document.getElementById('sidebarMask');
    onClick('menuToggle', () => {
      sidebar && sidebar.classList.add('open');
      mask && mask.classList.add('show');
    });
    if (mask) mask.addEventListener('click', () => {
      sidebar && sidebar.classList.remove('open');
      mask.classList.remove('show');
    });

    // Navigation
    const PAGES = ['dashboard','input','grafik','laporan','panduan','settings'];
    const PAGE_TITLES = {
      dashboard: 'Dashboard',
      input: 'Input Harian',
      grafik: 'Grafik Per Item',
      laporan: 'Laporan PDF',
      panduan: 'Panduan',
      settings: 'Pengaturan'
    };

    App.go = function (page) {
      if (!PAGES.includes(page)) page = 'dashboard';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
      PAGES.forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.toggle('active', p === page);
      });
      const pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = PAGE_TITLES[page];
      try { location.hash = '#' + page; } catch (e) {}
      sidebar && sidebar.classList.remove('open');
      mask && mask.classList.remove('show');

      if (page === 'dashboard') safe(() => NS.dashboard.render(), 'go:dashboard');
      if (page === 'input')     safe(() => NS.input.render(),     'go:input');
      if (page === 'grafik')    safe(() => NS.charts.render(),    'go:charts');
      if (page === 'laporan')   safe(() => NS.pdf && NS.pdf.renderPreview(), 'go:pdf');
      if (page === 'settings')  safe(() => NS.settings.renderUsers(), 'go:settings');
    };

    document.querySelectorAll('.nav-item').forEach(n => {
      n.addEventListener('click', () => App.go(n.dataset.page));
    });
    document.querySelectorAll('[data-go]').forEach(b => {
      b.addEventListener('click', () => App.go(b.dataset.go));
    });

    // FAB
    onClick('fab', () => {
      App.go('input');
      setTimeout(() => {
        const btn = document.getElementById('btnAdd');
        if (btn) btn.click();
      }, 80);
    });

    // ---------- Init modules with isolation ----------
    safe(() => NS.dashboard.init(), 'init:dashboard');
    safe(() => NS.input.init(),     'init:input');
    safe(() => NS.charts.init(),    'init:charts');
    safe(() => NS.pdf && NS.pdf.init && NS.pdf.init(), 'init:pdf');
    safe(() => NS.settings.init(),  'init:settings');

    // Initial page
    const hash = (location.hash || '').replace('#', '');
    App.go(PAGES.includes(hash) ? hash : 'dashboard');

    // Sembunyikan splash kalau ada
    const splash = document.getElementById('appSplash');
    if (splash) splash.style.display = 'none';

    // ---------- Real-time sync ----------
    let flashTimeout = null;
    const flashLive = () => {
      const liveEl = document.querySelector('.topbar .pulse');
      if (!liveEl) return;
      liveEl.style.transition = 'transform .3s';
      liveEl.style.transform = 'scale(1.08)';
      clearTimeout(flashTimeout);
      flashTimeout = setTimeout(() => { liveEl.style.transform = ''; }, 600);
    };
    const reRender = (payload, msg) => {
      safe(() => NS.dashboard.render(),  'render:dashboard');
      safe(() => NS.input.render(),      'render:input');
      safe(() => NS.charts.render(),     'render:charts');
      safe(() => NS.pdf && NS.pdf.renderPreview(), 'render:pdf');
      flashLive();
      if (msg && msg.payload && msg.payload.source === 'storage') {
        U.toast('Data diperbarui dari tab/perangkat lain', 'info');
      }
    };
    U.bus.on('data:changed', reRender);
    U.bus.on('settings:changed', reRender);

    // ---------- Keyboard shortcuts ----------
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        App.go('input');
        const btn = document.getElementById('btnAdd');
        if (btn) btn.click();
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask.show').forEach(m => m.classList.remove('show'));
      }
    });

    // ---------- Live status clock ----------
    setInterval(() => {
      const liveEl = document.getElementById('liveStatus');
      if (!liveEl) return;
      try {
        liveEl.textContent = 'Live · ' + new Date().toLocaleTimeString('id-ID');
      } catch (e) {}
    }, 1000);

    // ---------- Helpers ----------
    function safe(fn, label) {
      try { return fn(); }
      catch (err) {
        console.error('[' + (label || 'safe') + ']', err);
        // Tampilkan toast tapi jangan crash
        try { U.toast('Modul "' + (label || '?') + '" error: ' + err.message, 'error'); } catch (e) {}
      }
    }
    function onClick(id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }
    function safeSet(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
  } // end runApp
})();
