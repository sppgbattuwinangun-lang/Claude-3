/* =========================================================
   App orchestrator
   ========================================================= */
(function () {
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

  // Init modules
  NS.dashboard.init();
  NS.input.init();
  NS.charts.init();
  NS.settings.init();

  // Initial page
  const hash = (location.hash || '').replace('#', '');
  App.go(PAGES.includes(hash) ? hash : 'dashboard');

  // Real-time: listen to data/settings changes (from this tab or others)
  const reRender = () => {
    NS.dashboard.render();
    NS.input.render();
    NS.charts.render();
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
