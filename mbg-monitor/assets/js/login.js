/* Login page logic */
(async function () {
  const U = MBG.util, A = MBG.auth;
  document.getElementById('year').textContent = new Date().getFullYear();

  // Pastikan user default ada, dan beri info kredensial awal
  const users = await A.ensureDefaultUser();
  const def = users.find(u => u.username === 'admin' && u.mustChangePassword);
  const hint = document.getElementById('firstHint');
  if (def) {
    hint.innerHTML = 'Login pertama? Gunakan <b>admin</b> / <b>admin123</b>. Anda akan diminta mengganti password setelah masuk.';
  } else {
    hint.textContent = '';
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
  document.getElementById('togglePw').addEventListener('click', () => {
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });

  const alertEl = document.getElementById('alert');
  function showAlert(msg, type) {
    alertEl.className = 'alert show alert-' + (type || 'error');
    alertEl.textContent = msg;
  }
  function clearAlert() { alertEl.className = 'alert'; alertEl.textContent = ''; }

  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAlert();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    if (!username || !password) {
      showAlert('Mohon isi username dan password.');
      return;
    }
    const res = await A.login(username, password);
    if (!res.ok) { showAlert(res.message); return; }
    A.startSession(res.user, remember);
    if (res.user.mustChangePassword) {
      showChangeCard(res.user.id);
    } else {
      U.toast('Login berhasil', 'success');
      setTimeout(() => location.replace('./app.html'), 200);
    }
  });

  function showChangeCard(userId) {
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('changeCard').classList.remove('hidden');
    const a2 = document.getElementById('alert2');
    document.getElementById('changeForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      a2.className = 'alert';
      const p1 = document.getElementById('newPw').value;
      const p2 = document.getElementById('newPw2').value;
      if (p1.length < 8) { a2.className = 'alert show alert-error'; a2.textContent = 'Password minimal 8 karakter.'; return; }
      if (p1 !== p2)     { a2.className = 'alert show alert-error'; a2.textContent = 'Konfirmasi password tidak cocok.'; return; }
      if (p1 === 'admin123') { a2.className = 'alert show alert-error'; a2.textContent = 'Jangan gunakan password default.'; return; }
      const r = await A.changePassword(userId, p1);
      if (!r.ok) { a2.className = 'alert show alert-error'; a2.textContent = r.message || 'Gagal menyimpan'; return; }
      U.toast('Password berhasil diperbarui', 'success');
      setTimeout(() => location.replace('./app.html'), 250);
    }, { once: true });
  }
})();
