/* =========================================================
   App orchestrator
   ========================================================= */
(function () {
  // Global error handler — tampilkan pesan ke user
  window.addEventListener('error', function (e) {
    console.error('[MBG ERROR]', e.error || e.message, e);
    try {
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:9999;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;padding:12px 16px;border-radius:10px;max-width:520px;font:13px/1.4 -apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.15)';
      t.innerHTML = '<b>Terjadi error:</b> ' + (e.message || String(e.error)) + '<br><small>Refresh halaman dengan Ctrl+Shift+R. Bila masih, kabari error ini.</small>';
      document.body && document.body.appendChild(t);
      setTimeout(() => t.remove(), 8000);
    } catch (ex) {}
  });

  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, A = NS.auth, S = NS.store;
  const App = (NS.app = {});

  // Auth guard
  const session = A.requireAuth();
  if (!session) return;
  if (session.mustChangePassword) {
    location.replace('./login.html');
    return;
  }

  // Set who-am-I
  document.getElementById('whoName').textContent = session.user.username;
  document.getElementById('whoRole').textContent = session.user.role || 'admin';
  document.getElementById('avatar').textContent = (session.user.username[0] || 'A').toUpperCase();

  // Theme button
  document.getElementById('btnTheme').addEventListener('click', () => {
    U.toggleTheme();
    if (NS.dashboard) NS.dashboard.render();
    if (NS.charts && document.getElementById('page-grafik').classList.contains('active')) NS.charts.render();
    if (NS.pdf && document.getElementById('page-laporan').classList.contains('active')) NS.pdf.renderPreview();
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    if (!confirm('Keluar dari aplikasi?')) return;
    A.logout();
    location.replace('./login.html');
  });

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const mask = document.getElementById('sidebarMask');
  document.getElementById('menuToggle').addEventListener('click', () => {
    sidebar.classList.add('open'); mask.classList.add('show');
  });
  mask.addEventListener('click', () => {
    sidebar.classList.remove('open'); mask.classList.remove('show');
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
    document.getElementById('pageTitle').textContent = PAGE_TITLES[page];
    location.hash = '#' + page;
    sidebar.classList.remove('open'); mask.classList.remove('show');

    // re-render on nav (charts perlu visible untuk size correctly)
    if (page === 'dashboard') NS.dashboard.render();
    if (page === 'input')     NS.input.render();
    if (page === 'grafik')    NS.charts.render();
    if (page === 'laporan')   NS.pdf.renderPreview();
    if (page === 'settings')  NS.settings.renderUsers();
  };

  document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', () => App.go(n.dataset.page));
  });

  // Tombol dengan data-go (mis. Buat Laporan PDF dari dashboard)
  document.querySelectorAll('[data-go]').forEach(b => {
    b.addEventListener('click', () => App.go(b.dataset.go));
  });

  // Floating Action Button
  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      App.go('input');
      setTimeout(() => document.getElementById('btnAdd').click(), 80);
    });
  }

  // Init modules
  NS.dashboard.init();
  NS.input.init();
  NS.charts.init();
  if (NS.pdf && NS.pdf.init) NS.pdf.init();
  NS.settings.init();

  // Initial page (dari hash)
  const hash = (location.hash || '').replace('#', '');
  App.go(PAGES.includes(hash) ? hash : 'dashboard');

  // Real-time: re-render saat data/setting berubah
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
    try { NS.dashboard.render(); } catch (e) { console.error('[dashboard.render]', e); }
    try { NS.input.render(); }     catch (e) { console.error('[input.render]', e); }
    try { NS.charts.render(); }    catch (e) { console.error('[charts.render]', e); }
    try { NS.pdf.renderPreview(); } catch (e) { console.error('[pdf.renderPreview]', e); }
    flashLive();
    if (msg && msg.payload && msg.payload.source === 'storage') {
      U.toast('Data diperbarui dari tab/perangkat lain', 'info');
    }
  };
  U.bus.on('data:changed', reRender);
  U.bus.on('settings:changed', reRender);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N = tambah data
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      App.go('input');
      const btn = document.getElementById('btnAdd');
      if (btn) btn.click();
    }
    // Ctrl/Cmd + P = laporan
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      App.go('laporan');
    }
    // ESC tutup modal
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-mask.show').forEach(m => m.classList.remove('show'));
    }
  });

  // Live status pulse — clock
  setInterval(() => {
    const liveEl = document.getElementById('liveStatus');
    if (!liveEl) return;
    const t = new Date().toLocaleTimeString('id-ID');
    liveEl.textContent = 'Live · ' + t;
  }, 1000);
})();
