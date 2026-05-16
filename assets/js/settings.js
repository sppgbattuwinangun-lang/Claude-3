/* =========================================================
   Pengaturan: ambang, password, manajemen user, factory reset
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store, A = NS.auth;
  const T = (NS.settings = {});

  T.init = function () {
    const setEl = document.getElementById('setAmbang');
    if (setEl) setEl.value = Math.round(S.getSettings().ambangSerapan * 100);

    on('btnSaveSetting', () => {
      const v = parseInt(document.getElementById('setAmbang').value, 10);
      if (!v || v < 1 || v > 100) { U.toast('Persentase 1–100', 'error'); return; }
      S.saveSettings({ ambangSerapan: v / 100 });
      U.toast('Pengaturan disimpan', 'success');
      updateAmbangLabels(v);
    });

    on('btnChangePw', changePw);
    on('btnAddUser', () => openUserModal());
    on('userClose', closeUserModal);
    on('userCancel', closeUserModal);
    const um = document.getElementById('userMask');
    if (um) um.addEventListener('click', (e) => { if (e.target.id === 'userMask') closeUserModal(); });
    on('userSave', saveUser);

    // Factory reset
    on('btnFactoryReset', () => {
      if (!confirm('Reset Aplikasi akan menghapus SEMUA data lokal (akun admin, data harian, pengaturan).\n\nSetelah reset, Anda harus login ulang dengan admin/admin123.\n\nLanjutkan?')) return;
      const n = U.factoryResetManual();
      U.toast('Aplikasi di-reset (' + n + ' data dihapus)', 'warn', 2200);
      setTimeout(() => location.replace('./login.html'), 1500);
    });

    // App version label
    const av = document.getElementById('appVersion');
    if (av) av.textContent = U.APP_VERSION;

    T.renderUsers();
    updateAmbangLabels(Math.round(S.getSettings().ambangSerapan * 100));
  };

  function on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  function updateAmbangLabels(v) {
    const a = document.getElementById('pAmbang');
    const b = document.getElementById('pAmbang2');
    if (a) a.textContent = v + '%';
    if (b) b.textContent = (100 - v) + '%';
  }

  async function changePw() {
    const session = A.getSession();
    if (!session) return;
    const oldPw = document.getElementById('oldPw').value;
    const np1 = document.getElementById('newPwSet').value;
    const np2 = document.getElementById('newPwSet2').value;
    if (!oldPw || !np1) { U.toast('Lengkapi password lama & baru', 'error'); return; }
    if (np1.length < 8) { U.toast('Password minimal 8 karakter', 'error'); return; }
    if (np1 !== np2)   { U.toast('Konfirmasi tidak cocok', 'error'); return; }
    const r = await A.login(session.user.username, oldPw);
    if (!r.ok) { U.toast('Password lama salah', 'error'); return; }
    await A.changePassword(session.user.id, np1);
    document.getElementById('oldPw').value = '';
    document.getElementById('newPwSet').value = '';
    document.getElementById('newPwSet2').value = '';
    U.toast('Password berhasil diperbarui', 'success');
  }

  T.renderUsers = function () {
    const session = A.getSession();
    const tbody = document.getElementById('userTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    A.listUsers().forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>${u.username}</b></td>
        <td><span class="badge b-info">${u.role}</span></td>
        <td>${u.createdAt ? new Date(u.createdAt).toLocaleString('id-ID') : '—'}</td>
        <td>${u.mustChangePassword ? '<span class="badge b-warn">Wajib ganti pw</span>' : '<span class="badge b-ok">Aktif</span>'}</td>
        <td>
          <button class="btn btn-sm btn-danger" data-del>Hapus</button>
        </td>`;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        if (!confirm('Hapus admin "' + u.username + '"?')) return;
        const r = A.deleteUser(u.id, session.user.id);
        if (!r.ok) { U.toast(r.message, 'error'); return; }
        U.toast('Admin dihapus', 'warn');
        T.renderUsers();
      });
      tbody.appendChild(tr);
    });
  };

  function openUserModal() {
    const m = document.getElementById('userMask');
    if (!m) return;
    m.classList.add('show');
    ['newUsername','newUserPw','newUserPw2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }
  function closeUserModal() {
    const m = document.getElementById('userMask');
    if (m) m.classList.remove('show');
  }
  async function saveUser() {
    const u = document.getElementById('newUsername').value.trim();
    const p = document.getElementById('newUserPw').value;
    const p2 = document.getElementById('newUserPw2').value;
    if (!u || !p) { U.toast('Lengkapi semua field', 'error'); return; }
    if (p.length < 8) { U.toast('Password minimal 8 karakter', 'error'); return; }
    if (p !== p2) { U.toast('Konfirmasi tidak cocok', 'error'); return; }
    const r = await A.addUser(u, p, 'admin');
    if (!r.ok) { U.toast(r.message, 'error'); return; }
    U.toast('Admin baru ditambahkan', 'success');
    closeUserModal();
    T.renderUsers();
  }
})();
