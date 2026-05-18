// ===== SPPG Nota Pemesanan - Complete App =====
'use strict';

// === AUTH ===
const SESSION = JSON.parse(localStorage.getItem('sppg_session') || 'null');
if (!SESSION) location.href = 'index.html';

// === DATABASE (localStorage) ===
const DB = {
  _k: 'sppg_',
  get(c) { return JSON.parse(localStorage.getItem(this._k + c) || '[]'); },
  set(c, d) { localStorage.setItem(this._k + c, JSON.stringify(d)); },
  add(c, item) { const d = this.get(c); item.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6); item._ts = new Date().toISOString(); d.push(item); this.set(c, d); return item; },
  update(c, id, data) { const d = this.get(c); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...data }; this.set(c, d); return d[i]; } return null; },
  del(c, id) { this.set(c, this.get(c).filter(x => x.id !== id)); },
  find(c, id) { return this.get(c).find(x => x.id === id) || null; },
  exportAll() { return JSON.stringify({ master: this.get('master'), nota: this.get('nota'), _exported: new Date().toISOString(), _user: SESSION.username }); },
  importAll(json) { try { const d = JSON.parse(json); if (d.master) this.set('master', d.master); if (d.nota) this.set('nota', d.nota); return true; } catch (e) { return false; } }
};

// === MASTER DATA SEED from Excel ===
const KATEGORI_LIST = ['Karbohidrat', 'Protein Hewani', 'Protein Nabati', 'Sayur', 'Buah', 'Bumbu Masak Sayur', 'Bumbu Masak Sembako', 'Isi Ulang', 'Packaging'];

const SEED_MASTER = [
  { kategori: 'Karbohidrat', bahan: 'Beras', satuan: 'Kg' },
  { kategori: 'Karbohidrat', bahan: 'Mie', satuan: 'Bungkus' },
  { kategori: 'Karbohidrat', bahan: 'Kentang', satuan: 'Kg' },
  { kategori: 'Karbohidrat', bahan: 'Jagung', satuan: 'Kg' },
  { kategori: 'Karbohidrat', bahan: 'Roti', satuan: 'Pack' },
  { kategori: 'Karbohidrat', bahan: 'Singkong', satuan: 'Kg' },
  { kategori: 'Karbohidrat', bahan: 'Ubi', satuan: 'Kg' },
  { kategori: 'Karbohidrat', bahan: 'Makaroni', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Daging Ayam Fillet', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Daging Ayam Tulang (Potong)', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Ikan Patin Fillet', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Ikan Mujair Fillet', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Telur', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Ikan giling', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Ayam Giling', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Daging Sapi', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Udang', satuan: 'Kg' },
  { kategori: 'Protein Hewani', bahan: 'Susu UHT', satuan: 'Dus' },
  { kategori: 'Protein Nabati', bahan: 'Tempe', satuan: 'Kg' },
  { kategori: 'Protein Nabati', bahan: 'Tahu', satuan: 'Pcs' },
  { kategori: 'Protein Nabati', bahan: 'Kacang Hijau', satuan: 'Kg' },
  { kategori: 'Protein Nabati', bahan: 'Kacang Tanah', satuan: 'Kg' },
  { kategori: 'Protein Nabati', bahan: 'Kedelai', satuan: 'Kg' },
  { kategori: 'Protein Nabati', bahan: 'Oncom', satuan: 'Pcs' },
  { kategori: 'Sayur', bahan: 'Wortel', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Kacang Panjang', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Tauge', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Kubis', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Buncis', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Kembang Kol', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Sawi Putih', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Caisin', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Timun', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Daun Bawang', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Labu Siam', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Tomat', satuan: 'Kg' },
  { kategori: 'Sayur', bahan: 'Kemangi', satuan: 'Ikat' },
  { kategori: 'Sayur', bahan: 'Jagung ', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Melon', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Semangka', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Jeruk', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Pisang', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Buah Naga', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Salak', satuan: 'Kg' },
  { kategori: 'Buah', bahan: 'Apel', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Bawang Merah', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Bawang Putih', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Laos', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Serai', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Cabe Merah', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Cabe Ijo', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Bawang Bombay', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Ketumbar', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Kencur', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Kunyit', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Jahe', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sayur', bahan: 'Kelapa Parut', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Tepung Terigu', satuan: 'Dus' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Tepung Tapioka', satuan: 'Dus' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Tepung Beras', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Tepung Panir', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Maizena', satuan: 'Pack' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Sajiku', satuan: 'Pack' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Lada', satuan: 'Pack' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Minyak Goreng', satuan: 'Dus' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Saori', satuan: 'Pcs' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Garam Kasar', satuan: 'Pak' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Garam Halus', satuan: 'Pak' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Gula Putih', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Gula Merah', satuan: 'Kg' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Kecap', satuan: 'Pcs' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Keju', satuan: 'Pcs' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Bumbu Marinasi', satuan: 'Pack' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Saos Tomat', satuan: 'Pcs' },
  { kategori: 'Bumbu Masak Sembako', bahan: 'Asem Jawa', satuan: 'Pack' },
  { kategori: 'Isi Ulang', bahan: 'Galon', satuan: 'Pcs' },
  { kategori: 'Isi Ulang', bahan: 'Gas', satuan: 'Tabung' },
  { kategori: 'Packaging', bahan: 'Plastik', satuan: 'Pack' },
  { kategori: 'Packaging', bahan: 'Cup 100 ml', satuan: 'Pack' },
  { kategori: 'Packaging', bahan: 'Thinwall 200 ml', satuan: 'Pack' }
];

// Seed master if empty
if (DB.get('master').length === 0) {
  SEED_MASTER.forEach(m => DB.add('master', m));
}



// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initNav();
  initDashboard();
  initInput();
  initMaster();
  initLaporan();
  initSettings();
  updateClock();
});

function updateClock() {
  const el = document.getElementById('topDate');
  if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// === UI INIT ===
function initUI() {
  document.getElementById('dispName').textContent = SESSION.name;
  document.getElementById('dispRole').textContent = SESSION.role === 'admin' ? 'Administrator' : 'Operator';
  document.getElementById('userAvatar').textContent = SESSION.name[0].toUpperCase();
  document.getElementById('btnLogout').onclick = () => { if (confirm('Keluar dari sistem?')) { localStorage.removeItem('sppg_session'); location.href = 'index.html'; } };
  document.getElementById('btnToggle').onclick = () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('active'); };
  document.getElementById('sidebarOverlay').onclick = closeSidebar;
}
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

// === NAVIGATION ===
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

// === TOAST ===
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
  document.getElementById('stKategori').textContent = KATEGORI_LIST.length;
  document.getElementById('stBahan').textContent = master.length;

  // Recent items
  const recent = nota.sort((a, b) => (b._ts || '').localeCompare(a._ts || '')).slice(0, 8);
  const tb = document.getElementById('tbRecent');
  tb.innerHTML = recent.length ? recent.map(n => `<tr><td>${fmtDate(n.tanggal)}</td><td><strong>${n.bahan}</strong></td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td>${n.jumlah}</td><td>${n.satuan}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Belum ada data nota</td></tr>';

  // Kategori distribution
  const dist = {};
  KATEGORI_LIST.forEach(k => dist[k] = 0);
  nota.forEach(n => { if (dist[n.kategori] !== undefined) dist[n.kategori]++; });
  document.getElementById('kategoriDist').innerHTML = KATEGORI_LIST.map(k => `<div class="kat-row"><span class="kat-name"><span class="badge-cat cat-${slugKat(k)}">${k}</span></span><span class="kat-count">${dist[k]} item</span></div>`).join('');
}

// === INPUT NOTA ===
function initInput() {
  const selKat = document.getElementById('inKategori');
  const selBahan = document.getElementById('inBahan');
  const inSatuan = document.getElementById('inSatuan');
  const inTanggal = document.getElementById('inTanggal');

  // Populate kategori
  KATEGORI_LIST.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; selKat.appendChild(o); });

  // On kategori change
  selKat.onchange = () => {
    const master = DB.get('master').filter(m => m.kategori === selKat.value);
    selBahan.innerHTML = '<option value="">Pilih Bahan</option>' + master.map(m => `<option value="${m.bahan}" data-satuan="${m.satuan}">${m.bahan}</option>`).join('');
    inSatuan.value = '';
  };

  // On bahan change
  selBahan.onchange = () => { const opt = selBahan.options[selBahan.selectedIndex]; inSatuan.value = opt.dataset.satuan || ''; };

  // Set default date
  inTanggal.value = new Date().toISOString().split('T')[0];
  inTanggal.onchange = () => loadNotaForDate(inTanggal.value);

  // Form submit
  document.getElementById('formNota').onsubmit = (e) => {
    e.preventDefault();
    const data = { tanggal: inTanggal.value, kategori: selKat.value, bahan: selBahan.value, satuan: inSatuan.value, jumlah: parseFloat(document.getElementById('inJumlah').value) };
    if (!data.tanggal || !data.kategori || !data.bahan || !data.jumlah) return toast('Lengkapi semua field!');
    DB.add('nota', data);
    toast('Item berhasil ditambahkan!');
    document.getElementById('inJumlah').value = '';
    loadNotaForDate(inTanggal.value);
    refreshDashboard();
  };

  // PDF & Excel buttons
  document.getElementById('btnPdfNota').onclick = () => { const d = inTanggal.value; if (d) generatePDF(d); else toast('Pilih tanggal dulu!'); };
  document.getElementById('btnExcelNota').onclick = () => { const d = inTanggal.value; if (d) exportNotaExcel(d); else toast('Pilih tanggal dulu!'); };

  loadNotaForDate(inTanggal.value);
}

function loadNotaForDate(date) {
  document.getElementById('notaDateLabel').textContent = fmtDate(date);
  const items = DB.get('nota').filter(n => n.tanggal === date);
  const tb = document.getElementById('tbNota');
  if (!items.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-td">Belum ada item untuk tanggal ini</td></tr>'; return; }
  // Sort by kategori order
  const order = {};
  KATEGORI_LIST.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));
  tb.innerHTML = items.map((n, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td><strong>${n.bahan}</strong></td><td>${n.satuan}</td><td>${n.jumlah}</td><td><button class="btn btn-icon btn-outline-danger btn-sm" onclick="deleteNota('${n.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}
window.deleteNota = function(id) { if (confirm('Hapus item ini?')) { DB.del('nota', id); loadNotaForDate(document.getElementById('inTanggal').value); refreshDashboard(); toast('Dihapus'); } };

// === MASTER DATA ===
let editMasterId = null;
function initMaster() {
  document.getElementById('btnAddMaster').onclick = () => openMasterModal();
  document.getElementById('btnSaveMaster').onclick = saveMaster;
  document.getElementById('searchMaster').oninput = (e) => refreshMaster(e.target.value);
  document.getElementById('btnImportMaster').onclick = () => new bootstrap.Modal(document.getElementById('modalImport')).show();
  document.getElementById('btnExportMaster').onclick = exportMasterExcel;

  // Import handlers
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
  const order = {};
  KATEGORI_LIST.forEach((k, i) => order[k] = i);
  data.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99) || a.bahan.localeCompare(b.bahan));
  const tb = document.getElementById('tbMaster');
  tb.innerHTML = data.length ? data.map((m, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(m.kategori)}">${m.kategori}</span></td><td><strong>${m.bahan}</strong></td><td>${m.satuan}</td><td><button class="btn btn-icon btn-outline-primary btn-sm me-1" onclick="editMaster('${m.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-icon btn-outline-danger btn-sm" onclick="delMaster('${m.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Tidak ada data</td></tr>';
}

function openMasterModal(id = null) {
  editMasterId = id;
  const sel = document.getElementById('mKategori');
  sel.innerHTML = '<option value="">Pilih</option>' + KATEGORI_LIST.map(k => `<option value="${k}">${k}</option>`).join('');
  if (id) {
    const m = DB.find('master', id);
    document.getElementById('modalMasterTitle').textContent = 'Edit Bahan';
    sel.value = m.kategori; document.getElementById('mBahan').value = m.bahan; document.getElementById('mSatuan').value = m.satuan;
  } else {
    document.getElementById('modalMasterTitle').textContent = 'Tambah Bahan';
    document.getElementById('formMaster').reset();
  }
  new bootstrap.Modal(document.getElementById('modalMaster')).show();
}

function saveMaster() {
  const data = { kategori: document.getElementById('mKategori').value, bahan: document.getElementById('mBahan').value.trim(), satuan: document.getElementById('mSatuan').value.trim() };
  if (!data.kategori || !data.bahan || !data.satuan) return toast('Lengkapi semua field!');
  if (editMasterId) { DB.update('master', editMasterId, data); toast('Berhasil diupdate!'); }
  else { DB.add('master', data); toast('Bahan baru ditambahkan!'); }
  bootstrap.Modal.getInstance(document.getElementById('modalMaster')).hide();
  refreshMaster(); editMasterId = null;
}
window.editMaster = (id) => openMasterModal(id);
window.delMaster = (id) => { if (confirm('Hapus bahan ini?')) { DB.del('master', id); refreshMaster(); toast('Dihapus!'); } };

// === IMPORT EXCEL ===
let importRows = [];
function handleImportFile(file) {
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]]; // Last sheet = Master Data
      const json = XLSX.utils.sheet_to_json(ws);
      if (!json.length) return toast('Sheet kosong!');
      importRows = json;
      const keys = Object.keys(json[0]);
      document.getElementById('impHead').innerHTML = '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>';
      document.getElementById('impBody').innerHTML = json.slice(0, 5).map(r => '<tr>' + keys.map(k => `<td>${r[k] || ''}</td>`).join('') + '</tr>').join('');
      document.getElementById('importPreview').classList.remove('d-none');
      document.getElementById('btnDoImport').classList.remove('d-none');
    } catch (er) { toast('Gagal baca file: ' + er.message); }
  };
  r.readAsArrayBuffer(file);
}

function doImport() {
  let count = 0;
  importRows.forEach(row => {
    const kategori = String(row['Kategori'] || row['kategori'] || '').trim();
    const bahan = String(row['Bahan Makanan'] || row['bahan'] || '').trim();
    const satuan = String(row['Satuan'] || row['satuan'] || '').trim();
    if (kategori && bahan && satuan) {
      const exists = DB.get('master').find(m => m.bahan.toLowerCase() === bahan.toLowerCase() && m.kategori === kategori);
      if (!exists) { DB.add('master', { kategori, bahan, satuan }); count++; }
    }
  });
  bootstrap.Modal.getInstance(document.getElementById('modalImport')).hide();
  refreshMaster(); toast(`${count} bahan berhasil diimport!`); importRows = [];
}

function exportMasterExcel() {
  const data = DB.get('master');
  const ws = XLSX.utils.json_to_sheet(data.map(m => ({ 'Kategori': m.kategori, 'Bahan Makanan': m.bahan, 'Satuan': m.satuan })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
  XLSX.writeFile(wb, 'Master_Data_SPPG.xlsx'); toast('Master data diexport!');
}

function exportNotaExcel(date) {
  const items = DB.get('nota').filter(n => n.tanggal === date);
  if (!items.length) return toast('Tidak ada data!');
  const ws = XLSX.utils.json_to_sheet(items.map(n => ({ 'Tanggal': fmtDate(n.tanggal), 'Kategori': n.kategori, 'Bahan Makanan': n.bahan, 'Satuan': n.satuan, 'Jumlah': n.jumlah })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Nota ' + date);
  XLSX.writeFile(wb, `Nota_Pemesanan_${date}.xlsx`); toast('Nota diexport ke Excel!');
}



// === LAPORAN ===
function initLaporan() {
  document.getElementById('lapTanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('btnLoadLap').onclick = loadLaporan;
  document.getElementById('btnDlPdf').onclick = () => { const d = document.getElementById('lapTanggal').value; if (d) generatePDF(d); else toast('Pilih tanggal!'); };
}

function loadLaporan() {
  const date = document.getElementById('lapTanggal').value;
  if (!date) return toast('Pilih tanggal!');
  const items = DB.get('nota').filter(n => n.tanggal === date);
  const order = {}; KATEGORI_LIST.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));

  // Summary
  const totalItems = items.length;
  const totalJumlah = items.reduce((s, n) => s + (parseFloat(n.jumlah) || 0), 0);
  const totalKat = [...new Set(items.map(n => n.kategori))].length;
  document.getElementById('lapSummary').innerHTML = `<div class="ls-card"><span class="ls-val">${totalItems}</span><span class="ls-lbl">Total Item</span></div><div class="ls-card"><span class="ls-val">${totalJumlah}</span><span class="ls-lbl">Total Jumlah</span></div><div class="ls-card"><span class="ls-val">${totalKat}</span><span class="ls-lbl">Kategori</span></div>`;

  const tb = document.getElementById('tbLaporan');
  tb.innerHTML = items.length ? items.map((n, i) => `<tr><td>${i + 1}</td><td><span class="badge-cat cat-${slugKat(n.kategori)}">${n.kategori}</span></td><td><strong>${n.bahan}</strong></td><td>${n.satuan}</td><td>${n.jumlah}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-td">Tidak ada data untuk tanggal ini</td></tr>';
}

// === PDF GENERATION ===
function generatePDF(date) {
  const items = DB.get('nota').filter(n => n.tanggal === date);
  if (!items.length) return toast('Tidak ada data untuk tanggal ini!');
  const order = {}; KATEGORI_LIST.forEach((k, i) => order[k] = i);
  items.sort((a, b) => (order[a.kategori] || 99) - (order[b.kategori] || 99));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const m = 15;
  let y = m;

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)', pw / 2, y, { align: 'center' });
  y += 5;
  doc.text('BATTU WINANGUN', pw / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(11);
  doc.text('NOTA PEMESANAN BAHAN MAKANAN', pw / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(m, y, pw - m, y);
  y += 8;

  // Date info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Tanggal: ' + fmtDate(date), m, y);
  doc.text('Total Item: ' + items.length, pw - m, y, { align: 'right' });
  y += 8;

  // Table
  doc.autoTable({
    startY: y,
    head: [['No', 'Kategori Makanan', 'Bahan Makanan', 'Satuan', 'Jumlah']],
    body: items.map((n, i) => [i + 1, n.kategori, n.bahan, n.satuan, n.jumlah]),
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 40 }, 2: { cellWidth: 50 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 } },
    margin: { left: m, right: m },
    styles: { cellPadding: 3 }
  });

  y = doc.lastAutoTable.finalY + 12;

  // Tanda Tangan
  y = Math.max(y, 210);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', pw / 2, y, { align: 'center' });
  y += 8;

  const signW = (pw - 2 * m) / 3;
  const signs = [
    { title: 'Ahli Gizi', name: "Neti Is'ad Anggraini" },
    { title: 'KaSPPG', name: 'Alfiansah Prastyo' },
    { title: 'Owner', name: 'Endang Resminingsih' }
  ];

  signs.forEach((s, i) => {
    const x = m + signW * i;
    doc.setFont('helvetica', 'normal');
    doc.text(s.title, x + signW / 2, y, { align: 'center' });
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(x + 8, y + 22, x + signW - 8, y + 22);
    doc.setFont('helvetica', 'bold');
    doc.text(s.name, x + signW / 2, y + 27, { align: 'center' });
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128);
  doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), m, footerY);
  doc.text('SPPG Battu Winangun - Nota Pemesanan Bahan Makanan', pw - m, footerY, { align: 'right' });

  doc.save(`Nota_Pemesanan_${date}.pdf`);
  toast('PDF berhasil didownload!');
}

// === SETTINGS ===
function initSettings() {
  document.getElementById('infoUser').textContent = SESSION.username;
  document.getElementById('infoRole').textContent = SESSION.role === 'admin' ? 'Administrator' : 'Operator';
  document.getElementById('infoLogin').textContent = new Date(SESSION.loginTime).toLocaleString('id-ID');
  document.getElementById('infoNota').textContent = DB.get('nota').length + ' item';
  document.getElementById('infoMaster').textContent = DB.get('master').length + ' bahan';

  // Sync Export
  document.getElementById('btnSyncExport').onclick = () => {
    const blob = new Blob([DB.exportAll()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `SPPG_Backup_${SESSION.username}_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(a.href); toast('Data berhasil diexport!');
  };

  // Sync Import
  document.getElementById('btnSyncImport').onclick = () => document.getElementById('syncFile').click();
  document.getElementById('syncFile').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (DB.importAll(ev.target.result)) {
        toast('Data berhasil diimport! Halaman akan dimuat ulang.');
        setTimeout(() => location.reload(), 1000);
      } else { toast('Gagal import! File tidak valid.'); }
    };
    reader.readAsText(file);
  };
}

// === HELPERS ===
function fmtDate(d) { if (!d) return '-'; try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function slugKat(k) { return (k || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, ''); }
