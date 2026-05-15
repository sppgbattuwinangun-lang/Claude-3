/* =========================================================
   App orchestrator
   ========================================================= */
(function () {
  // Global error handler — tampilkan pesan ke user, jangan biarkan layar putih
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

  // Jika belum ganti password default, redirect ke login
  if (session.mustChangePassword) {
    location.replace('./login.html');
    return;
  }

  // Set who-am-I
  document.getElementById('whoName').textContent = session.user.username;
  document.getElementById('whoRole').textContent = session.user.role || 'admin';
  document.getElementById('avatar').textContent = (session.user.username[0] || 'A').toUpperCase();

  // Bersihkan auto-seed flag dari versi lama (sekali jalan) agar user yang
  // sudah pernah login dengan data contoh bisa hapus & mulai dari kosong tanpa konflik.
  if (localStorage.getItem('mbg.autoSeeded.v1')) {
    localStorage.removeItem('mbg.autoSeeded.v1');
  }

  // Theme button
  document.getElementById('btnTheme').addEventListener('click', () => {
    U.toggleTheme();
    // re-render charts to pick up colors that depend on theme
    if (NS.dashboard) NS.dashboard.render();
    if (NS.charts && document.getElementById('page-grafik').classList.contains('active')) NS.charts.render();
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
  const PAGES = ['dashboard','input','grafik','data','panduan','settings'];
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    input: 'Input Harian',
    grafik: 'Grafik Per Item',
    data: 'Data & Excel',
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

    // re-render on nav (charts need to be visible to size correctly)
    if (page === 'dashboard') NS.dashboard.render();
    if (page === 'input')     NS.input.render();
    if (page === 'grafik')    NS.charts.render();
    if (page === 'settings')  NS.settings.renderUsers();
  };

  document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', () => App.go(n.dataset.page));
  });

  // Floating Action Button — buka modal tambah dari halaman manapun
  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      App.go('input');
      setTimeout(() => document.getElementById('btnAdd').click(), 50);
    });
  }

  // Init modules
  NS.dashboard.init();
  NS.input.init();
  NS.charts.init();
  NS.settings.init();

  // Initial page
  const hash = (location.hash || '').replace('#', '');
  App.go(PAGES.includes(hash) ? hash : 'dashboard');

  // Real-time: listen to data/settings changes (from this tab or others)
  let flashTimeout = null;
  const flashLive = () => {
    const liveEl = document.querySelector('.topbar .pulse');
    if (!liveEl) return;
    liveEl.style.transition = 'background .3s, color .3s';
    liveEl.style.background = 'linear-gradient(135deg, #16a34a, #0d9488)';
    liveEl.style.color = 'white';
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      liveEl.style.background = '';
      liveEl.style.color = '';
    }, 800);
  };
  const reRender = (payload, msg) => {
    try { NS.dashboard.render(); } catch (e) { console.error('[dashboard.render]', e); }
    try { NS.input.render(); }     catch (e) { console.error('[input.render]', e); }
    try { NS.charts.render(); }    catch (e) { console.error('[charts.render]', e); }
    flashLive();
    // Toast khusus untuk update dari tab lain
    if (msg && msg.payload && msg.payload.source === 'storage') {
      U.toast('Data diperbarui dari tab/perangkat lain', 'info');
    }
  };
  U.bus.on('data:changed', reRender);
  U.bus.on('settings:changed', reRender);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N for add new
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      App.go('input');
      document.getElementById('btnAdd').click();
    }
    // ESC closes modals
    if (e.key === 'Escape') {
      document.getElementById('modalMask').classList.remove('show');
      document.getElementById('userMask').classList.remove('show');
    }
  });

  // Live status pulse
  setInterval(() => {
    const liveEl = document.getElementById('liveStatus');
    const t = new Date().toLocaleTimeString('id-ID');
    liveEl.textContent = 'Live · ' + t;
  }, 1000);
})();
