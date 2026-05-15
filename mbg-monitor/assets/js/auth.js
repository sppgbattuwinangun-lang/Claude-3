/* =========================================================
   Auth — user store + session
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util;
  const A = (NS.auth = {});

  const DEFAULT_USERNAME = 'admin';
  const DEFAULT_PASSWORD = 'admin123'; // wajib diganti pada login pertama

  // Inisialisasi user default kalau belum ada
  A.ensureDefaultUser = async function () {
    const users = U.read(U.K.USERS, null);
    if (!users || !users.length) {
      const { salt, hash } = await U.hashPassword(DEFAULT_PASSWORD);
      const u = {
        id: U.uuid(),
        username: DEFAULT_USERNAME,
        role: 'admin',
        salt, hash,
        mustChangePassword: true,
        createdAt: Date.now()
      };
      U.write(U.K.USERS, [u]);
      return [u];
    }
    return users;
  };

  A.findUser = function (username) {
    const users = U.read(U.K.USERS, []);
    return users.find(u => u.username.toLowerCase() === String(username || '').toLowerCase()) || null;
  };

  A.login = async function (username, password) {
    await A.ensureDefaultUser();
    const user = A.findUser(username);
    if (!user) return { ok: false, message: 'Username atau password salah' };
    const ok = await U.verifyPassword(password, user.salt, user.hash);
    if (!ok) return { ok: false, message: 'Username atau password salah' };
    return { ok: true, user };
  };

  A.startSession = function (user, remember) {
    const ttl = remember ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000; // 7 hari atau 8 jam
    const session = {
      user: { id: user.id, username: user.username, role: user.role },
      expires: Date.now() + ttl,
      mustChangePassword: !!user.mustChangePassword
    };
    U.write(U.K.SESSION, session);
    return session;
  };

  A.getSession = function () {
    const s = U.read(U.K.SESSION, null);
    if (!s) return null;
    if (s.expires && s.expires < Date.now()) {
      U.remove(U.K.SESSION);
      return null;
    }
    return s;
  };

  A.logout = function () {
    U.remove(U.K.SESSION);
  };

  A.requireAuth = function () {
    const s = A.getSession();
    if (!s) {
      location.replace('./login.html');
      return null;
    }
    return s;
  };

  A.changePassword = async function (userId, newPassword) {
    const users = U.read(U.K.USERS, []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) return { ok: false, message: 'User tidak ditemukan' };
    const { salt, hash } = await U.hashPassword(newPassword);
    users[idx].salt = salt;
    users[idx].hash = hash;
    users[idx].mustChangePassword = false;
    users[idx].passwordUpdatedAt = Date.now();
    U.write(U.K.USERS, users);
    // refresh session
    const s = A.getSession();
    if (s && s.user && s.user.id === userId) {
      s.mustChangePassword = false;
      U.write(U.K.SESSION, s);
    }
    return { ok: true };
  };

  A.addUser = async function (username, password, role) {
    const users = U.read(U.K.USERS, []);
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, message: 'Username sudah ada' };
    }
    const { salt, hash } = await U.hashPassword(password);
    const u = {
      id: U.uuid(),
      username, role: role || 'admin',
      salt, hash, mustChangePassword: false, createdAt: Date.now()
    };
    users.push(u);
    U.write(U.K.USERS, users);
    return { ok: true, user: u };
  };

  A.deleteUser = function (userId, currentUserId) {
    const users = U.read(U.K.USERS, []);
    if (userId === currentUserId) return { ok: false, message: 'Tidak bisa menghapus diri sendiri' };
    const next = users.filter(u => u.id !== userId);
    if (next.length === 0) return { ok: false, message: 'Minimal harus ada satu admin' };
    U.write(U.K.USERS, next);
    return { ok: true };
  };

  A.listUsers = function () {
    return U.read(U.K.USERS, []).map(u => ({
      id: u.id, username: u.username, role: u.role,
      mustChangePassword: !!u.mustChangePassword,
      createdAt: u.createdAt, passwordUpdatedAt: u.passwordUpdatedAt
    }));
  };
})();
