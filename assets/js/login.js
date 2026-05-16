/* =========================================================
   Login page logic — robust
   ========================================================= */
(async function () {
  try {
    const U = window.MBG && window.MBG.util;
    const A = window.MBG && window.MBG.auth;
    if (!U || !A) {
      throw new Error('Modul auth/utils belum siap.');
    }

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Tampilkan info bila app baru saja factory-reset (versi baru)
    if (window.__mbgJustReset) {
      U.toast('Sistem diperbarui ke versi ' + U.APP_VERSION + ' — data lama dibersihkan. Login ulang dengan admin/admin123.', 'info', 6000);
    }

    const users = await A.ensureDefaultUser();
    const def = users.find(u => u.username === 'admin' && u.mustChangePassword);
    const hint = document.getElementById('firstHint');
    if (hint) {
      if (def) {
        hint.innerHTML = 'Login pertama? Gunakan <b>admin</b> / <b>admin123</b>. Anda akan diminta mengganti password setelah masuk.';
      } else {
        hint.innerHTML = 'Lupa password? Klik <a href="#" id="lnkReset" style="color:var(--c-accent);font-weight:600">Reset Aplikasi</a> untuk kembali ke kondisi default.';
        const lr = document.getElementById('lnkReset');
        if (lr) lr.addEventListener('click', (e) => {
          e.preventDefault();
          if (!confirm('Reset aplikasi akan menghapus SEMUA data lokal (akun admin, data harian, pengaturan). Lanjutkan?')) return;
          const n = U.factoryResetManual();
          U.toast('Aplikasi di-reset (' + n + ' data dihapus). Memuat ulang…', 'success', 2200);
          setTimeout(() => location.reload(), 1500);
        });
      }
    }

    // Jika sudah login & valid, langsung ke app
    const session = A.getSession();
    if (session && !session.mustChangePassword) {
      location.replace('./app.html');
      return;
    }
    if (session && session.mustChangePassword) {
      showChangeCard(session.user.id);
    }

    // toggle password
    const pw = document.getElementById('password');
    const tg = document.getElementById('togglePw');
    if (tg && pw) tg.addEventListener('click', () => {
      pw.type = pw.type === 'password' ? 'text' : 'password';
    });

    const alertEl = document.getElementById('alert');
    function showAlert(msg, type) {
      if (!alertEl) return;
      alertEl.className = 'alert show alert-' + (type || 'error');
      alertEl.textContent = msg;
    }
    function clearAlert() { if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; } }

    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearAlert();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember').checked;
      if (!username || !password) {
        showAlert('Mohon isi username dan password.');
        return;
      }
      try {
        const res = await A.login(username, password);
        if (!res.ok) { showAlert(res.message); return; }
        A.startSession(res.user, remember);
        if (res.user.mustChangePassword) {
          showChangeCard(res.user.id);
        } else {
          U.toast('Login berhasil', 'success');
          setTimeout(() => location.replace('./app.html'), 200);
        }
      } catch (err) {
        showAlert('Gagal login: ' + err.message);
      }
    });

    function showChangeCard(userId) {
      const lc = document.getElementById('loginCard');
      const cc = document.getElementById('changeCard');
      if (lc) lc.classList.add('hidden');
      if (cc) cc.classList.remove('hidden');
      const a2 = document.getElementById('alert2');
      const cf = document.getElementById('changeForm');
      if (cf) cf.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (a2) a2.className = 'alert';
        const p1 = document.getElementById('newPw').value;
        const p2 = document.getElementById('newPw2').value;
        if (p1.length < 8) { setAlert(a2, 'Password minimal 8 karakter.'); return; }
        if (p1 !== p2)     { setAlert(a2, 'Konfirmasi password tidak cocok.'); return; }
        if (p1 === 'admin123') { setAlert(a2, 'Jangan gunakan password default.'); return; }
        try {
          const r = await A.changePassword(userId, p1);
          if (!r.ok) { setAlert(a2, r.message || 'Gagal menyimpan'); return; }
          U.toast('Password berhasil diperbarui', 'success');
          setTimeout(() => location.replace('./app.html'), 250);
        } catch (err) {
          setAlert(a2, 'Error: ' + err.message);
        }
      }, { once: true });
    }
    function setAlert(el, msg) { if (!el) return; el.className = 'alert show alert-error'; el.textContent = msg; }

  } catch (err) {
    console.error('[login.js fatal]', err);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(10,10,30,.95);color:#fff;padding:24px;font-family:system-ui';
    overlay.innerHTML =
      '<div style="max-width:480px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:28px">' +
      '<h2 style="margin:0 0 8px 0">Login gagal dimuat</h2>' +
      '<p style="color:#cbd5e1;font-size:13px">' + (err.message || err) + '</p>' +
      '<button onclick="location.reload()" style="margin-top:14px;padding:10px 18px;border:0;border-radius:10px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:600;cursor:pointer">Muat Ulang</button>' +
      '<button onclick="(function(){for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(\'mbg.\'))localStorage.removeItem(k);}location.reload();})()" style="margin-top:14px;margin-left:8px;padding:10px 18px;border:1px solid rgba(239,68,68,.5);border-radius:10px;background:rgba(239,68,68,.1);color:#fca5a5;font-weight:600;cursor:pointer">Reset Aplikasi</button>' +
      '</div>';
    document.body.appendChild(overlay);
  }
})();
