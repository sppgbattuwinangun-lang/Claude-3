// ===== SPPG Nota Pemesanan Bahan Makanan =====
// Cloud-synced via JSONBin.io - data sama di semua device
'use strict';

// === AUTH ===
const SESSION = JSON.parse(localStorage.getItem('sppg_session') || 'null');
if (!SESSION) location.href = 'index.html';

// === CLOUD SYNC ENGINE (JSONBin.io) ===
// JSONBin.io free tier: unlimited reads, 10k requests/month
// Data disimpan di cloud, otomatis sync antar device
const CLOUD = {
  // JSONBin config - bin dibuat otomatis saat pertama kali
  API: 'https://api.jsonbin.io/v3',
  // Master key untuk akses (free account)
  KEY: '$2a$10$QL8bHdMCmYDCnOgRaVFBb.dD2lRnWxfSfKjGkXqGv4v8l5PmWsVHe',
  binId: null,

  async init() {
    // Check if bin ID exists in localStorage
    this.binId = localStorage.getItem('sppg_cloud_bin');
    if (this.binId) {
      await this.pull();
    } else {
      // Create new bin with seed data
      await this.createBin();
    }
    this.updateSyncStatus('online');
  },

  async createBin() {
    try {
      const data = { master: DB.get('master'), nota: DB.get('nota'), kategori: DB.get('kategori'), _updated: new Date().toISOString() };
      const res = await fetch(this.API + '/b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': this.KEY, 'X-Bin-Name': 'sppg-' + SESSION.username },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        this.binId = json.metadata.id;
        localStorage.setItem('sppg_cloud_bin', this.binId);
        toast('Cloud sync aktif! Bin ID: ' + this.binId);
      }
    } catch (e) {
      console.warn('Cloud create failed:', e);
      this.updateSyncStatus('offline');
    }
  },

  async push() {
    if (!this.binId) return;
    try {
      const data = { master: DB.get('master'), nota: DB.get('nota'), kategori: DB.get('kategori'), _updated: new Date().toISOString(), _by: SESSION.username };
      await fetch(this.API + '/b/' + this.binId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': this.KEY },
        body: JSON.stringify(data)
      });
      this.updateSyncStatus('online');
      localStorage.setItem('sppg_last_sync', new Date().toISOString());
    } catch (e) {
      console.warn('Cloud push failed:', e);
      this.updateSyncStatus('offline');
    }
  },

  async pull() {
    if (!this.binId) return;
    try {
      const res = await fetch(this.API + '/b/' + this.binId + '/latest', {
        headers: { 'X-Master-Key': this.KEY }
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.record;
        if (data.master) DB.set('master', data.master);
        if (data.nota) DB.set('nota', data.nota);
        if (data.kategori) DB.set('kategori', data.kategori);
        this.updateSyncStatus('online');
        localStorage.setItem('sppg_last_sync', new Date().toISOString());
      }
    } catch (e) {
      console.warn('Cloud pull failed:', e);
      this.updateSyncStatus('offline');
    }
  },

  updateSyncStatus(status) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    if (status === 'online') {
      el.innerHTML = '<i class="fas fa-cloud-check"></i> Tersinkronisasi';
      el.className = 'sync-status sync-online';
    } else {
      el.innerHTML = '<i class="fas fa-cloud-slash"></i> Offline (Lokal)';
      el.className = 'sync-status sync-offline';
    }
  },

  // Debounced push - push after 2s of no changes
  _timer: null,
  schedPush() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(), 2000);
  }
};

// === LOCAL DATABASE ===
const DB = {
  _k: 'sppg_',
  get(c) { return JSON.parse(localStorage.getItem(this._k + c) || '[]'); },
  set(c, d) { localStorage.setItem(this._k + c, JSON.stringify(d)); },
  add(c, item) { const d = this.get(c); item.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6); item._ts = new Date().toISOString(); d.push(item); this.set(c, d); CLOUD.schedPush(); return item; },
  update(c, id, data) { const d = this.get(c); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...data }; this.set(c, d); CLOUD.schedPush(); return d[i]; } return null; },
  del(c, id) { this.set(c, this.get(c).filter(x => x.id !== id)); CLOUD.schedPush(); },
  find(c, id) { return this.get(c).find(x => x.id === id) || null; },
  exportAll() { return JSON.stringify({ master: this.get('master'), nota: this.get('nota'), kategori: this.get('kategori'), _exported: new Date().toISOString() }); },
  importAll(json) { try { const d = JSON.parse(json); if (d.master) this.set('master', d.master); if (d.nota) this.set('nota', d.nota); if (d.kategori) this.set('kategori', d.kategori); CLOUD.schedPush(); return true; } catch (e) { return false; } }
};

// === DEFAULT KATEGORI (editable) ===
const DEFAULT_KATEGORI = ['Karbohidrat', 'Protein Hewani', 'Protein Nabati', 'Sayur', 'Buah', 'Bumbu Masak Sayur', 'Bumbu Masak Sembako', 'Isi Ulang', 'Packaging'];

// Seed kategori if empty
if (DB.get('kategori').length === 0) {
  DEFAULT_KATEGORI.forEach(k => DB.add('kategori', { nama: k }));
}

function getKategoriList() {
  return DB.get('kategori').map(k => k.nama);
}



// === SEED MASTER DATA from Excel ===
const SEED_MASTER = [
  {kategori:'Karbohidrat',bahan:'Beras',satuan:'Kg'},{kategori:'Karbohidrat',bahan:'Mie',satuan:'Bungkus'},{kategori:'Karbohidrat',bahan:'Kentang',satuan:'Kg'},{kategori:'Karbohidrat',bahan:'Jagung',satuan:'Kg'},{kategori:'Karbohidrat',bahan:'Roti',satuan:'Pack'},{kategori:'Karbohidrat',bahan:'Singkong',satuan:'Kg'},{kategori:'Karbohidrat',bahan:'Ubi',satuan:'Kg'},{kategori:'Karbohidrat',bahan:'Makaroni',satuan:'Kg'},
  {kategori:'Protein Hewani',bahan:'Daging Ayam Fillet',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Daging Ayam Tulang (Potong)',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Ikan Patin Fillet',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Ikan Mujair Fillet',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Telur',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Ikan giling',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Ayam Giling',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Daging Sapi',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Udang',satuan:'Kg'},{kategori:'Protein Hewani',bahan:'Susu UHT',satuan:'Dus'},
  {kategori:'Protein Nabati',bahan:'Tempe',satuan:'Kg'},{kategori:'Protein Nabati',bahan:'Tahu',satuan:'Pcs'},{kategori:'Protein Nabati',bahan:'Kacang Hijau',satuan:'Kg'},{kategori:'Protein Nabati',bahan:'Kacang Tanah',satuan:'Kg'},{kategori:'Protein Nabati',bahan:'Kedelai',satuan:'Kg'},{kategori:'Protein Nabati',bahan:'Oncom',satuan:'Pcs'},
  {kategori:'Sayur',bahan:'Wortel',satuan:'Kg'},{kategori:'Sayur',bahan:'Kacang Panjang',satuan:'Kg'},{kategori:'Sayur',bahan:'Tauge',satuan:'Kg'},{kategori:'Sayur',bahan:'Kubis',satuan:'Kg'},{kategori:'Sayur',bahan:'Buncis',satuan:'Kg'},{kategori:'Sayur',bahan:'Kembang Kol',satuan:'Kg'},{kategori:'Sayur',bahan:'Sawi Putih',satuan:'Kg'},{kategori:'Sayur',bahan:'Caisin',satuan:'Kg'},{kategori:'Sayur',bahan:'Timun',satuan:'Kg'},{kategori:'Sayur',bahan:'Daun Bawang',satuan:'Kg'},{kategori:'Sayur',bahan:'Labu Siam',satuan:'Kg'},{kategori:'Sayur',bahan:'Tomat',satuan:'Kg'},{kategori:'Sayur',bahan:'Kemangi',satuan:'Ikat'},{kategori:'Sayur',bahan:'Jagung',satuan:'Kg'},
  {kategori:'Buah',bahan:'Melon',satuan:'Kg'},{kategori:'Buah',bahan:'Semangka',satuan:'Kg'},{kategori:'Buah',bahan:'Jeruk',satuan:'Kg'},{kategori:'Buah',bahan:'Pisang',satuan:'Kg'},{kategori:'Buah',bahan:'Buah Naga',satuan:'Kg'},{kategori:'Buah',bahan:'Salak',satuan:'Kg'},{kategori:'Buah',bahan:'Apel',satuan:'Kg'},
  {kategori:'Bumbu Masak Sayur',bahan:'Bawang Merah',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Bawang Putih',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Laos',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Serai',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Cabe Merah',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Cabe Ijo',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Bawang Bombay',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Ketumbar',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Kencur',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Kunyit',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Jahe',satuan:'Kg'},{kategori:'Bumbu Masak Sayur',bahan:'Kelapa Parut',satuan:'Kg'},
  {kategori:'Bumbu Masak Sembako',bahan:'Tepung Terigu',satuan:'Dus'},{kategori:'Bumbu Masak Sembako',bahan:'Tepung Tapioka',satuan:'Dus'},{kategori:'Bumbu Masak Sembako',bahan:'Tepung Beras',satuan:'Kg'},{kategori:'Bumbu Masak Sembako',bahan:'Tepung Panir',satuan:'Kg'},{kategori:'Bumbu Masak Sembako',bahan:'Maizena',satuan:'Pack'},{kategori:'Bumbu Masak Sembako',bahan:'Sajiku',satuan:'Pack'},{kategori:'Bumbu Masak Sembako',bahan:'Lada',satuan:'Pack'},{kategori:'Bumbu Masak Sembako',bahan:'Minyak Goreng',satuan:'Dus'},{kategori:'Bumbu Masak Sembako',bahan:'Saori',satuan:'Pcs'},{kategori:'Bumbu Masak Sembako',bahan:'Garam Kasar',satuan:'Pak'},{kategori:'Bumbu Masak Sembako',bahan:'Garam Halus',satuan:'Pak'},{kategori:'Bumbu Masak Sembako',bahan:'Gula Putih',satuan:'Kg'},{kategori:'Bumbu Masak Sembako',bahan:'Gula Merah',satuan:'Kg'},{kategori:'Bumbu Masak Sembako',bahan:'Kecap',satuan:'Pcs'},{kategori:'Bumbu Masak Sembako',bahan:'Keju',satuan:'Pcs'},{kategori:'Bumbu Masak Sembako',bahan:'Bumbu Marinasi',satuan:'Pack'},{kategori:'Bumbu Masak Sembako',bahan:'Saos Tomat',satuan:'Pcs'},{kategori:'Bumbu Masak Sembako',bahan:'Asem Jawa',satuan:'Pack'},
  {kategori:'Isi Ulang',bahan:'Galon',satuan:'Pcs'},{kategori:'Isi Ulang',bahan:'Gas',satuan:'Tabung'},
  {kategori:'Packaging',bahan:'Plastik',satuan:'Pack'},{kategori:'Packaging',bahan:'Cup 100 ml',satuan:'Pack'},{kategori:'Packaging',bahan:'Thinwall 200 ml',satuan:'Pack'}
];

if (DB.get('master').length === 0) { SEED_MASTER.forEach(m => DB.add('master', m)); }

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  initUI();
  initNav();
  initDashboard();
  initInput();
  initMaster();
  initLaporan();
  initSettings();
  updateClock();
  // Cloud sync - pull latest data
  await CLOUD.init();
  // Refresh after sync
  refreshDashboard();
  refreshMaster();
});

function updateClock() {
  const el = document.getElementById('topDate');
  if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// === UI ===
function initUI() {
  document.getElementById('dispName').textContent = SESSION.name;
  document.getElementById('dispRole').textContent = SESSION.role === 'admin' ? 'Administrator' : 'Operator';
  document.getElementById('userAvatar').textContent = SESSION.name[0].toUpperCase();
  document.getElementById('btnLogout').onclick = () => { if (confirm('Keluar dari sistem?')) { localStorage.removeItem('sppg_session'); location.href = 'index.html'; } };
  document.getElementById('btnToggle').onclick = () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('active'); };
  document.getElementById('sidebarOverlay').onclick = closeSidebar;
}
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

// === NAV ===
function initNav() { document.querySelectorAll('.nav-item').forEach(a => { a.onclick = () => goTo(a.dataset.page); }); }
function goTo(page) {
  document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'pg-' + page));
  const titles = { dashboard: 'Dashboard', input: 'Input Nota', master: 'Master Data', laporan: 'Laporan & PDF', settings: 'Pengaturan' };
  document.getElementById('pageTitle').textContent = titles[page] || '';
  closeSidebar();
  if (page === 'dashboard') refreshDashboard();
  if (page === 'master') refreshMaster();
}

function toast(msg) { document.getElementById('toastMsg').textContent = msg; new bootstrap.Toast(document.getElementById('appToast'), { delay: 3000 }).show(); }

// === DASHBOARD ===
function initDashboard() { refreshDashboard(); }
function refreshDashboard() {
  const master = DB.get('master');
  const nota = DB.get('nota');
  const today = new Date().toISOString().split('T')[0];
  const todayNota = nota.filter(n => n.tanggal === today);
  document.getElementById('stNotaToday').textContent = todayNota.length;
  document.getElementById('stTotalItems').textContent = todayNota.reduce((s, n) => s + (parseFloat(n.jumlah) || 0), 0);
  document.getElementById('stKategori').textContent = getKategoriList().length;
  document.getElementById('stBahan').textContent = master.length;
  // Recent
  const recent = nota.sort((a, b) => (b._ts || '').localeCompare(a._ts || '')).slice(0, 8);
  const tb = document.getElementById('tbRecent');
  tb.innerHTML = recent.length ? recent.map(n => `<tr><td>${fmtDate(n.tanggal)}</td><td><strong>${n.bahan}</strong></td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td>${n.jumlah}</td><td>${n.satuan}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Belum ada data nota</td></tr>';
  // Kategori dist
  const katList = getKategoriList();
  const dist = {}; katList.forEach(k => dist[k] = 0);
  nota.forEach(n => { if (dist[n.kategori] !== undefined) dist[n.kategori]++; });
  document.getElementById('kategoriDist').innerHTML = katList.map(k => `<div class="kat-row"><span class="kat-name"><span class="badge-cat cat-${slugKat(k)}">${k}</span></span><span class="kat-count">${dist[k]} item</span></div>`).join('');
}

// === INPUT NOTA ===
function initInput() {
  populateKategoriSelect('inKategori');
  const selKat = document.getElementById('inKategori');
  const selBahan = document.getElementById('inBahan');
  const inSatuan = document.getElementById('inSatuan');
  const inTanggal = document.getElementById('inTanggal');
  selKat.onchange = () => {
    const master = DB.get('master').filter(m => m.kategori === selKat.value);
    selBahan.innerHTML = '<option value="">Pilih Bahan</option>' + master.map(m => `<option value="${m.bahan}" data-satuan="${m.satuan}">${m.bahan}</option>`).join('');
    inSatuan.value = '';
  };
  selBahan.onchange = () => { inSatuan.value = selBahan.options[selBahan.selectedIndex]?.dataset?.satuan || ''; };
  inTanggal.value = new Date().toISOString().split('T')[0];
  inTanggal.onchange = () => loadNotaForDate(inTanggal.value);
  document.getElementById('formNota').onsubmit = (e) => {
    e.preventDefault();
    const data = { tanggal: inTanggal.value, kategori: selKat.value, bahan: selBahan.value, satuan: inSatuan.value, jumlah: parseFloat(document.getElementById('inJumlah').value) };
    if (!data.tanggal || !data.kategori || !data.bahan || !data.jumlah) return toast('Lengkapi semua field!');
    DB.add('nota', data);
    toast('Item ditambahkan!');
    document.getElementById('inJumlah').value = '';
    loadNotaForDate(inTanggal.value);
    refreshDashboard();
  };
  document.getElementById('btnPdfNota').onclick = () => { const d = inTanggal.value; if (d) generatePDF(d); else toast('Pilih tanggal!'); };
  document.getElementById('btnExcelNota').onclick = () => { const d = inTanggal.value; if (d) exportNotaExcel(d); else toast('Pilih tanggal!'); };
  loadNotaForDate(inTanggal.value);
}

function populateKategoriSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const val = sel.value;
  const katList = getKategoriList();
  sel.innerHTML = '<option value="">Pilih Kategori</option>' + katList.map(k => `<option value="${k}">${k}</option>`).join('');
  if (val && katList.includes(val)) sel.value = val;
}

function loadNotaForDate(date) {
  document.getElementById('notaDateLabel').textContent = fmtDate(date);
  const items = DB.get('nota').filter(n => n.tanggal === date);
  const tb = document.getElementById('tbNota');
  if (!items.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-td">Belum ada item untuk tanggal ini</td></tr>'; return; }
  const katList = getKategoriList();
  const order = {}; katList.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));
  tb.innerHTML = items.map((n, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td><strong>${n.bahan}</strong></td><td>${n.satuan}</td><td>${n.jumlah}</td><td><button class="btn btn-icon btn-outline-danger btn-sm" onclick="deleteNota('${n.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}
window.deleteNota = function(id) { if (confirm('Hapus?')) { DB.del('nota', id); loadNotaForDate(document.getElementById('inTanggal').value); refreshDashboard(); toast('Dihapus'); } };



// === MASTER DATA (Kategori + Bahan - Full CRUD) ===
let editMasterId = null;
function initMaster() {
  document.getElementById('btnAddMaster').onclick = () => openMasterModal();
  document.getElementById('btnAddKategori').onclick = () => openKategoriModal();
  document.getElementById('btnSaveMaster').onclick = saveMaster;
  document.getElementById('btnSaveKategori').onclick = saveKategori;
  document.getElementById('searchMaster').oninput = (e) => refreshMaster(e.target.value);
  document.getElementById('btnImportMaster').onclick = () => new bootstrap.Modal(document.getElementById('modalImport')).show();
  document.getElementById('btnExportMaster').onclick = exportMasterExcel;
  const area = document.getElementById('uploadArea');
  const fileIn = document.getElementById('importFile');
  area.onclick = () => fileIn.click();
  fileIn.onchange = (e) => { if (e.target.files[0]) handleImportFile(e.target.files[0]); };
  document.getElementById('btnDoImport').onclick = doImport;
  refreshMaster();
}

function refreshMaster(q = '') {
  let data = DB.get('master');
  if (q) { const t = q.toLowerCase(); data = data.filter(m => m.bahan.toLowerCase().includes(t) || m.kategori.toLowerCase().includes(t)); }
  const katList = getKategoriList();
  const order = {}; katList.forEach((k, i) => order[k] = i);
  data.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99) || a.bahan.localeCompare(b.bahan));
  const tb = document.getElementById('tbMaster');
  tb.innerHTML = data.length ? data.map((m, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(m.kategori)}">${m.kategori}</span></td><td><strong>${m.bahan}</strong></td><td>${m.satuan}</td><td><button class="btn btn-icon btn-outline-primary btn-sm me-1" onclick="editMaster('${m.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-icon btn-outline-danger btn-sm" onclick="delMaster('${m.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Tidak ada data</td></tr>';
  // Refresh kategori list in Master page
  refreshKategoriList();
}

function refreshKategoriList() {
  const katData = DB.get('kategori');
  const el = document.getElementById('kategoriListManage');
  if (!el) return;
  el.innerHTML = katData.map(k => `<div class="kat-manage-row"><span>${k.nama}</span><div><button class="btn btn-icon btn-outline-primary btn-sm me-1" onclick="editKategori('${k.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-icon btn-outline-danger btn-sm" onclick="delKategori('${k.id}')"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

// Kategori CRUD
let editKatId = null;
function openKategoriModal(id = null) {
  editKatId = id;
  if (id) {
    const k = DB.find('kategori', id);
    document.getElementById('modalKategoriTitle').textContent = 'Edit Kategori';
    document.getElementById('inpKatNama').value = k.nama;
  } else {
    document.getElementById('modalKategoriTitle').textContent = 'Tambah Kategori Baru';
    document.getElementById('inpKatNama').value = '';
  }
  new bootstrap.Modal(document.getElementById('modalKategori')).show();
}
function saveKategori() {
  const nama = document.getElementById('inpKatNama').value.trim();
  if (!nama) return toast('Nama kategori wajib diisi!');
  if (editKatId) { DB.update('kategori', editKatId, { nama }); toast('Kategori diupdate!'); }
  else { DB.add('kategori', { nama }); toast('Kategori baru ditambahkan!'); }
  bootstrap.Modal.getInstance(document.getElementById('modalKategori')).hide();
  refreshMaster();
  populateKategoriSelect('inKategori');
  refreshDashboard();
  editKatId = null;
}
window.editKategori = (id) => openKategoriModal(id);
window.delKategori = (id) => {
  const k = DB.find('kategori', id);
  if (confirm(`Hapus kategori "${k.nama}"? Bahan makanan dalam kategori ini TIDAK akan dihapus.`)) {
    DB.del('kategori', id);
    refreshMaster();
    populateKategoriSelect('inKategori');
    refreshDashboard();
    toast('Kategori dihapus!');
  }
};

// Master Bahan CRUD
function openMasterModal(id = null) {
  editMasterId = id;
  const sel = document.getElementById('mKategori');
  const katList = getKategoriList();
  sel.innerHTML = '<option value="">Pilih</option>' + katList.map(k => `<option value="${k}">${k}</option>`).join('');
  if (id) {
    const m = DB.find('master', id);
    document.getElementById('modalMasterTitle').textContent = 'Edit Bahan Makanan';
    sel.value = m.kategori;
    document.getElementById('mBahan').value = m.bahan;
    document.getElementById('mSatuan').value = m.satuan;
  } else {
    document.getElementById('modalMasterTitle').textContent = 'Tambah Bahan Makanan';
    document.getElementById('formMaster').reset();
  }
  new bootstrap.Modal(document.getElementById('modalMaster')).show();
}
function saveMaster() {
  const data = { kategori: document.getElementById('mKategori').value, bahan: document.getElementById('mBahan').value.trim(), satuan: document.getElementById('mSatuan').value.trim() };
  if (!data.kategori || !data.bahan || !data.satuan) return toast('Lengkapi semua field!');
  if (editMasterId) { DB.update('master', editMasterId, data); toast('Bahan diupdate!'); }
  else { DB.add('master', data); toast('Bahan baru ditambahkan!'); }
  bootstrap.Modal.getInstance(document.getElementById('modalMaster')).hide();
  refreshMaster(); refreshDashboard(); editMasterId = null;
}
window.editMaster = (id) => openMasterModal(id);
window.delMaster = (id) => { if (confirm('Hapus bahan ini?')) { DB.del('master', id); refreshMaster(); refreshDashboard(); toast('Dihapus!'); } };

// Import/Export Excel
let importRows = [];
function handleImportFile(file) {
  const r = new FileReader();
  r.onload = (e) => { try { const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]]; const json = XLSX.utils.sheet_to_json(ws); if (!json.length) return toast('Sheet kosong!'); importRows = json; const keys = Object.keys(json[0]); document.getElementById('impHead').innerHTML = '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>'; document.getElementById('impBody').innerHTML = json.slice(0, 5).map(r => '<tr>' + keys.map(k => `<td>${r[k] || ''}</td>`).join('') + '</tr>').join(''); document.getElementById('importPreview').classList.remove('d-none'); document.getElementById('btnDoImport').classList.remove('d-none'); } catch (er) { toast('Gagal: ' + er.message); } };
  r.readAsArrayBuffer(file);
}
function doImport() {
  let c = 0;
  importRows.forEach(row => { const kategori = String(row['Kategori'] || '').trim(); const bahan = String(row['Bahan Makanan'] || '').trim(); const satuan = String(row['Satuan'] || '').trim(); if (kategori && bahan && satuan) { if (!DB.get('master').find(m => m.bahan.toLowerCase() === bahan.toLowerCase() && m.kategori === kategori)) { DB.add('master', { kategori, bahan, satuan }); c++; } } });
  bootstrap.Modal.getInstance(document.getElementById('modalImport')).hide();
  refreshMaster(); toast(c + ' bahan diimport!'); importRows = [];
}
function exportMasterExcel() {
  const data = DB.get('master');
  const ws = XLSX.utils.json_to_sheet(data.map(m => ({ 'Kategori': m.kategori, 'Bahan Makanan': m.bahan, 'Satuan': m.satuan })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
  XLSX.writeFile(wb, 'Master_Data_SPPG.xlsx'); toast('Exported!');
}
function exportNotaExcel(date) {
  const items = DB.get('nota').filter(n => n.tanggal === date);
  if (!items.length) return toast('Tidak ada data!');
  const ws = XLSX.utils.json_to_sheet(items.map(n => ({ 'Tanggal': fmtDate(n.tanggal), 'Kategori': n.kategori, 'Bahan Makanan': n.bahan, 'Satuan': n.satuan, 'Jumlah': n.jumlah })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Nota');
  XLSX.writeFile(wb, `Nota_${date}.xlsx`); toast('Excel didownload!');
}

// === LAPORAN & PDF ===
function initLaporan() {
  document.getElementById('lapTanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('btnLoadLap').onclick = loadLaporan;
  document.getElementById('btnDlPdf').onclick = () => { const d = document.getElementById('lapTanggal').value; if (d) generatePDF(d); else toast('Pilih tanggal!'); };
}
function loadLaporan() {
  const date = document.getElementById('lapTanggal').value;
  if (!date) return toast('Pilih tanggal!');
  const items = DB.get('nota').filter(n => n.tanggal === date);
  const katList = getKategoriList();
  const order = {}; katList.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));
  const totalItems = items.length;
  const totalJumlah = items.reduce((s, n) => s + (parseFloat(n.jumlah) || 0), 0);
  const totalKat = [...new Set(items.map(n => n.kategori))].length;
  document.getElementById('lapSummary').innerHTML = `<div class="ls-card"><span class="ls-val">${totalItems}</span><span class="ls-lbl">Total Item</span></div><div class="ls-card"><span class="ls-val">${totalJumlah}</span><span class="ls-lbl">Total Jumlah</span></div><div class="ls-card"><span class="ls-val">${totalKat}</span><span class="ls-lbl">Kategori</span></div>`;
  const tb = document.getElementById('tbLaporan');
  tb.innerHTML = items.length ? items.map((n, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td><strong>${n.bahan}</strong></td><td>${n.satuan}</td><td>${n.jumlah}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Tidak ada data</td></tr>';
}

function generatePDF(date) {
  const items = DB.get('nota').filter(n => n.tanggal === date);
  if (!items.length) return toast('Tidak ada data!');
  const katList = getKategoriList();
  const order = {}; katList.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const m = 15;
  let y = m;
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)', pw / 2, y, { align: 'center' }); y += 5;
  doc.text('BATTU WINANGUN', pw / 2, y, { align: 'center' }); y += 5;
  doc.setFontSize(11);
  doc.text('NOTA PEMESANAN BAHAN MAKANAN', pw / 2, y, { align: 'center' }); y += 4;
  doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.5); doc.line(m, y, pw - m, y); y += 8;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Tanggal: ' + fmtDate(date), m, y);
  doc.text('Total Item: ' + items.length, pw - m, y, { align: 'right' }); y += 8;
  doc.autoTable({ startY: y, head: [['No', 'Kategori Makanan', 'Bahan Makanan', 'Satuan', 'Jumlah']], body: items.map((n, i) => [i + 1, n.kategori, n.bahan, n.satuan, n.jumlah]), theme: 'grid', headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 }, bodyStyles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 40 }, 2: { cellWidth: 50 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 } }, margin: { left: m, right: m }, styles: { cellPadding: 3 } });
  y = doc.lastAutoTable.finalY + 12;
  y = Math.max(y, 210);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', pw / 2, y, { align: 'center' }); y += 8;
  const signW = (pw - 2 * m) / 3;
  [{ title: 'Ahli Gizi', name: "Neti Is'ad Anggraini" }, { title: 'KaSPPG', name: 'Alfiansah Prastyo' }, { title: 'Owner', name: 'Endang Resminingsih' }].forEach((s, i) => {
    const x = m + signW * i;
    doc.setFont('helvetica', 'normal'); doc.text(s.title, x + signW / 2, y, { align: 'center' });
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(x + 8, y + 22, x + signW - 8, y + 22);
    doc.setFont('helvetica', 'bold'); doc.text(s.name, x + signW / 2, y + 27, { align: 'center' });
  });
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(128);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), m, footerY);
  doc.text('SPPG Battu Winangun', pw - m, footerY, { align: 'right' });
  doc.save(`Nota_Pemesanan_${date}.pdf`);
  toast('PDF didownload!');
}

// === SETTINGS ===
function initSettings() {
  document.getElementById('infoUser').textContent = SESSION.username;
  document.getElementById('infoRole').textContent = SESSION.role === 'admin' ? 'Administrator' : 'Operator';
  document.getElementById('infoLogin').textContent = new Date(SESSION.loginTime).toLocaleString('id-ID');
  document.getElementById('infoNota').textContent = DB.get('nota').length + ' item';
  document.getElementById('infoMaster').textContent = DB.get('master').length + ' bahan';
  // Cloud sync info
  const binId = localStorage.getItem('sppg_cloud_bin');
  const lastSync = localStorage.getItem('sppg_last_sync');
  document.getElementById('infoCloudId').textContent = binId ? binId.substring(0, 12) + '...' : 'Belum terhubung';
  document.getElementById('infoLastSync').textContent = lastSync ? new Date(lastSync).toLocaleString('id-ID') : '-';

  // Manual sync buttons
  document.getElementById('btnCloudPush').onclick = async () => { toast('Mengupload...'); await CLOUD.push(); toast('Data berhasil diupload ke cloud!'); };
  document.getElementById('btnCloudPull').onclick = async () => { toast('Mengunduh...'); await CLOUD.pull(); refreshDashboard(); refreshMaster(); toast('Data berhasil didownload dari cloud!'); };
  document.getElementById('btnResetBin').onclick = () => { if (confirm('Reset cloud sync? Ini akan membuat bin baru. Data lokal tetap aman.')) { localStorage.removeItem('sppg_cloud_bin'); CLOUD.binId = null; CLOUD.createBin().then(() => toast('Bin baru dibuat!')); } };

  // Local backup
  document.getElementById('btnSyncExport').onclick = () => { const blob = new Blob([DB.exportAll()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SPPG_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); toast('Backup diexport!'); };
  document.getElementById('btnSyncImport').onclick = () => document.getElementById('syncFile').click();
  document.getElementById('syncFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { if (DB.importAll(ev.target.result)) { toast('Data diimport! Memuat ulang...'); setTimeout(() => location.reload(), 1000); } else toast('File tidak valid!'); }; r.readAsText(f); };

  // Connect to existing bin
  document.getElementById('btnConnectBin').onclick = () => {
    const id = prompt('Masukkan Bin ID dari device lain (lihat di Pengaturan > Cloud Sync):');
    if (id && id.length > 10) {
      localStorage.setItem('sppg_cloud_bin', id.trim());
      CLOUD.binId = id.trim();
      CLOUD.pull().then(() => { toast('Terhubung & data didownload!'); location.reload(); });
    }
  };
}

// === HELPERS ===
function fmtDate(d) { if (!d) return '-'; try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function slugKat(k) { return (k || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, ''); }
