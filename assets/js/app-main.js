// ===== SPPG MAIN APPLICATION =====
// Core application logic

// Check authentication
const session = JSON.parse(localStorage.getItem('sppg_session') || 'null');
if (!session) {
    window.location.href = 'index.html';
}

// ===== GLOBAL STATE =====
let currentPage = 'dashboard';
let editingPenerimaId = null;
let editingNotaId = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initNavigation();
    initDashboard();
    initMasterData();
    initNotaPesanan();
    initLaporan();
    initSettings();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function initApp() {
    // Set user info
    document.getElementById('currentUser').textContent = session.name || session.username;
    document.getElementById('settingsUsername').value = session.username;
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Yakin ingin keluar?')) {
            localStorage.removeItem('sppg_session');
            window.location.href = 'index.html';
        }
    });
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('currentDateTime').textContent = now.toLocaleDateString('id-ID', options);
}



// ===== NAVIGATION =====
function initNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
        overlay.classList.toggle('active');
    });
}

function navigateTo(page) {
    currentPage = page;
    // Update menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    // Update pages
    document.querySelectorAll('.page-content').forEach(section => {
        section.classList.toggle('active', section.id === `page-${page}`);
    });
    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'master-data': 'Master Data Penerima',
        'nota-pesanan': 'Nota Pesanan',
        'laporan': 'Laporan',
        'settings': 'Pengaturan'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    
    // Refresh data
    if (page === 'dashboard') refreshDashboard();
    if (page === 'master-data') refreshMasterData();
    if (page === 'nota-pesanan') refreshNota();
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('active');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}



// ===== DASHBOARD =====
function initDashboard() {
    refreshDashboard();
}

function refreshDashboard() {
    const stats = window.db.getStats();
    document.getElementById('totalPenerima').textContent = stats.totalPenerima;
    document.getElementById('totalNota').textContent = stats.totalNotaToday;
    document.getElementById('pendingNota').textContent = stats.pendingNota;
    document.getElementById('completedNota').textContent = stats.completedThisMonth;

    // Recent nota
    const nota = window.db.getCollection('nota');
    const recent = nota.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const tbody = document.getElementById('recentNotaBody');
    
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Belum ada nota pesanan</td></tr>';
    } else {
        tbody.innerHTML = recent.map(n => `
            <tr>
                <td><strong>${n.noNota}</strong></td>
                <td>${formatDate(n.tanggal)}</td>
                <td>${n.namaPenerima || '-'}</td>
                <td><span class="badge-status badge-${n.status}">${getStatusLabel(n.status)}</span></td>
                <td>
                    <button class="btn btn-action btn-outline-primary" onclick="viewNota('${n.id}')" title="Lihat">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Activity feed
    const activities = window.db.getCollection('activities');
    const feed = document.getElementById('activityFeed');
    if (activities.length === 0) {
        feed.innerHTML = '<div class="text-center text-muted py-4">Belum ada aktivitas</div>';
    } else {
        feed.innerHTML = activities.slice(0, 10).map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.action}">
                    <i class="fas fa-${a.action === 'add' ? 'plus' : a.action === 'edit' ? 'pen' : 'trash'}"></i>
                </div>
                <div>
                    <div class="activity-text">${getActivityText(a)}</div>
                    <div class="activity-time">${timeAgo(a.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }
}



// ===== MASTER DATA =====
function initMasterData() {
    document.getElementById('btnAddPenerima').addEventListener('click', () => openPenerimaModal());
    document.getElementById('btnSavePenerima').addEventListener('click', savePenerima);
    document.getElementById('btnImportExcel').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('modalImport')).show();
    });
    document.getElementById('btnExportData').addEventListener('click', exportMasterData);
    document.getElementById('searchPenerima').addEventListener('input', (e) => {
        refreshMasterData(e.target.value);
    });

    // Import Excel handlers
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    
    document.getElementById('btnSelectFile').addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleExcelFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleExcelFile(e.target.files[0]);
    });
    document.getElementById('btnConfirmImport').addEventListener('click', confirmImport);

    refreshMasterData();
}

function refreshMasterData(searchTerm = '') {
    let data = window.db.getCollection('penerima');
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(p => 
            p.nama.toLowerCase().includes(term) || 
            p.nik.includes(term) ||
            (p.namaOrtu && p.namaOrtu.toLowerCase().includes(term))
        );
    }
    
    const tbody = document.getElementById('masterDataBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Tidak ada data ditemukan</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><code>${p.nik}</code></td>
            <td><strong>${p.nama}</strong></td>
            <td>${formatDate(p.tanggalLahir)}</td>
            <td>${p.jenisKelamin === 'L' ? 'Laki-laki' : p.jenisKelamin === 'P' ? 'Perempuan' : '-'}</td>
            <td>${p.namaOrtu || '-'}</td>
            <td>
                <span class="badge-status ${p.statusAktif ? 'badge-completed' : 'badge-pending'}">
                    ${p.statusAktif ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            <td>
                <button class="btn btn-action btn-outline-primary me-1" onclick="editPenerima('${p.id}')" title="Edit">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-action btn-outline-danger" onclick="deletePenerima('${p.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPenerimaModal(id = null) {
    editingPenerimaId = id;
    const modal = new bootstrap.Modal(document.getElementById('modalPenerima'));
    
    if (id) {
        const p = window.db.getById('penerima', id);
        document.getElementById('modalPenerimaTitle').textContent = 'Edit Penerima';
        document.getElementById('inputNIK').value = p.nik;
        document.getElementById('inputNama').value = p.nama;
        document.getElementById('inputTglLahir').value = p.tanggalLahir || '';
        document.getElementById('inputJenisKelamin').value = p.jenisKelamin || '';
        document.getElementById('inputOrtu').value = p.namaOrtu || '';
        document.getElementById('inputPosisi').value = p.posisi || '';
        document.getElementById('inputStatusAktif').checked = p.statusAktif;
    } else {
        document.getElementById('modalPenerimaTitle').textContent = 'Tambah Penerima Baru';
        document.getElementById('formPenerima').reset();
        document.getElementById('inputStatusAktif').checked = true;
    }
    modal.show();
}

function savePenerima() {
    const data = {
        nik: document.getElementById('inputNIK').value.trim(),
        nama: document.getElementById('inputNama').value.trim(),
        tanggalLahir: document.getElementById('inputTglLahir').value,
        jenisKelamin: document.getElementById('inputJenisKelamin').value,
        namaOrtu: document.getElementById('inputOrtu').value.trim(),
        posisi: document.getElementById('inputPosisi').value.trim(),
        statusAktif: document.getElementById('inputStatusAktif').checked
    };

    if (!data.nik || !data.nama) {
        showToast('Error', 'NIK dan Nama wajib diisi!', 'danger');
        return;
    }

    if (editingPenerimaId) {
        window.db.update('penerima', editingPenerimaId, data);
        showToast('Berhasil', 'Data penerima berhasil diperbarui');
    } else {
        window.db.add('penerima', data);
        showToast('Berhasil', 'Penerima baru berhasil ditambahkan');
    }

    bootstrap.Modal.getInstance(document.getElementById('modalPenerima')).hide();
    refreshMasterData();
    refreshDashboard();
}

window.editPenerima = function(id) { openPenerimaModal(id); };
window.deletePenerima = function(id) {
    const p = window.db.getById('penerima', id);
    if (confirm(`Yakin ingin menghapus data "${p.nama}"?`)) {
        window.db.delete('penerima', id);
        refreshMasterData();
        refreshDashboard();
        showToast('Berhasil', 'Data berhasil dihapus');
    }
};



// ===== EXCEL IMPORT =====
let importData = [];

function handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                showToast('Error', 'File Excel kosong!', 'danger');
                return;
            }

            importData = jsonData;
            showImportPreview(jsonData);
        } catch (err) {
            showToast('Error', 'Gagal membaca file: ' + err.message, 'danger');
        }
    };
    reader.readAsArrayBuffer(file);
}

function showImportPreview(data) {
    const preview = document.getElementById('importPreview');
    const head = document.getElementById('importPreviewHead');
    const body = document.getElementById('importPreviewBody');
    const confirmBtn = document.getElementById('btnConfirmImport');

    const headers = Object.keys(data[0]);
    head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    body.innerHTML = data.slice(0, 10).map(row => 
        `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`
    ).join('');

    preview.classList.remove('d-none');
    confirmBtn.classList.remove('d-none');
}

function confirmImport() {
    if (importData.length === 0) return;

    let imported = 0;
    importData.forEach(row => {
        const nik = String(row['NISN/NIK'] || row['NIK'] || row['nik'] || '').trim();
        const nama = String(row['Nama Penerima'] || row['Nama'] || row['nama'] || '').trim();
        
        if (nik && nama) {
            // Check if already exists
            const existing = window.db.getCollection('penerima').find(p => p.nik === nik);
            if (!existing) {
                window.db.add('penerima', {
                    nik: nik,
                    nama: nama,
                    tanggalLahir: parseExcelDate(row['Tanggal Lahir'] || ''),
                    jenisKelamin: mapJenisKelamin(row['Jenis Kelamin ID']),
                    namaOrtu: String(row['Nama Orang Tua'] || '-'),
                    posisi: String(row['Posisi'] || ''),
                    statusAktif: row['Status Menerima'] === 'true' || row['Status Menerima'] === true
                });
                imported++;
            }
        }
    });

    bootstrap.Modal.getInstance(document.getElementById('modalImport')).hide();
    showToast('Berhasil', `${imported} data berhasil diimport!`);
    refreshMasterData();
    refreshDashboard();
    importData = [];
}

function exportMasterData() {
    const data = window.db.getCollection('penerima');
    const ws = XLSX.utils.json_to_sheet(data.map(p => ({
        'NISN/NIK': p.nik,
        'Nama Penerima': p.nama,
        'Tanggal Lahir': p.tanggalLahir,
        'Jenis Kelamin': p.jenisKelamin === 'L' ? 'Laki-laki' : p.jenisKelamin === 'P' ? 'Perempuan' : '-',
        'Nama Orang Tua': p.namaOrtu,
        'Posisi': p.posisi,
        'Status': p.statusAktif ? 'Aktif' : 'Nonaktif'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penerima Manfaat');
    XLSX.writeFile(wb, `Master_Data_Penerima_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Berhasil', 'Data berhasil diexport ke Excel');
}



// ===== NOTA PESANAN =====
function initNotaPesanan() {
    document.getElementById('btnAddNota').addEventListener('click', () => openNotaModal());
    document.getElementById('btnSaveNota').addEventListener('click', saveNota);
    document.getElementById('btnAddItem').addEventListener('click', addNotaItemRow);
    document.getElementById('btnFilterNota').addEventListener('click', () => {
        document.getElementById('filterPanel').classList.toggle('d-none');
    });
    document.getElementById('btnApplyFilter').addEventListener('click', applyNotaFilter);
    document.getElementById('btnDownloadPDF').addEventListener('click', () => downloadSelectedPDF());
    document.getElementById('searchNota').addEventListener('input', (e) => {
        refreshNota(e.target.value);
    });
    refreshNota();
}

function refreshNota(searchTerm = '', filters = {}) {
    let data = window.db.getCollection('nota');
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(n => 
            n.noNota.toLowerCase().includes(term) || 
            (n.namaPenerima && n.namaPenerima.toLowerCase().includes(term))
        );
    }

    if (filters.dateStart) data = data.filter(n => n.tanggal >= filters.dateStart);
    if (filters.dateEnd) data = data.filter(n => n.tanggal <= filters.dateEnd);
    if (filters.status) data = data.filter(n => n.status === filters.status);

    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById('notaBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Belum ada nota pesanan</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(n => `
        <tr>
            <td><strong>${n.noNota}</strong></td>
            <td>${formatDate(n.tanggal)}</td>
            <td>${n.namaPenerima || '-'}</td>
            <td>${n.items ? n.items.length + ' item' : '-'}</td>
            <td>${n.items ? n.items.reduce((sum, i) => sum + (i.qty || 0), 0) + ' porsi' : '-'}</td>
            <td><span class="badge-status badge-${n.status}">${getStatusLabel(n.status)}</span></td>
            <td>
                <button class="btn btn-action btn-outline-primary me-1" onclick="viewNota('${n.id}')" title="Lihat">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-action btn-outline-success me-1" onclick="updateNotaStatus('${n.id}')" title="Update Status">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-action btn-outline-danger me-1" onclick="downloadNotaPDF('${n.id}')" title="PDF">
                    <i class="fas fa-file-pdf"></i>
                </button>
                <button class="btn btn-action btn-outline-secondary" onclick="deleteNota('${n.id}')" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openNotaModal(id = null) {
    editingNotaId = id;
    const modal = new bootstrap.Modal(document.getElementById('modalNota'));
    
    // Populate penerima dropdown
    const penerima = window.db.getCollection('penerima').filter(p => p.statusAktif);
    const select = document.getElementById('inputPenerimaNota');
    select.innerHTML = '<option value="">Pilih Penerima</option>' + 
        penerima.map(p => `<option value="${p.id}" data-nama="${p.nama}">${p.nama} (${p.nik})</option>`).join('');

    if (id) {
        const n = window.db.getById('nota', id);
        document.getElementById('modalNotaTitle').textContent = 'Edit Nota Pesanan';
        document.getElementById('inputNoNota').value = n.noNota;
        document.getElementById('inputTglNota').value = n.tanggal;
        document.getElementById('inputPenerimaNota').value = n.penerimaId;
        document.getElementById('inputCatatanNota').value = n.catatan || '';
        // Load items
        const container = document.getElementById('notaItemsContainer');
        container.innerHTML = '';
        if (n.items) {
            n.items.forEach((item, idx) => addNotaItemRow(null, item));
        }
    } else {
        document.getElementById('modalNotaTitle').textContent = 'Buat Nota Pesanan Baru';
        document.getElementById('formNota').reset();
        document.getElementById('inputNoNota').value = generateNotaNumber();
        document.getElementById('inputTglNota').value = new Date().toISOString().split('T')[0];
        document.getElementById('notaItemsContainer').innerHTML = '';
        addNotaItemRow();
    }
    modal.show();
}

function addNotaItemRow(e, itemData = null) {
    const container = document.getElementById('notaItemsContainer');
    const index = container.children.length;
    const row = document.createElement('div');
    row.className = 'nota-item-row';
    row.dataset.index = index;
    row.innerHTML = `
        <div class="row g-2">
            <div class="col-md-4">
                <input type="text" class="form-control" placeholder="Nama Item" name="itemName[]" 
                    value="${itemData ? itemData.name : ''}" required>
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" placeholder="Jumlah" name="itemQty[]" 
                    min="1" value="${itemData ? itemData.qty : '1'}" required>
            </div>
            <div class="col-md-2">
                <input type="text" class="form-control" placeholder="Satuan" name="itemUnit[]" 
                    value="${itemData ? itemData.unit : 'porsi'}">
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control" placeholder="Keterangan" name="itemNote[]"
                    value="${itemData ? (itemData.note || '') : ''}">
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-outline-danger btn-sm btn-remove-item w-100" onclick="this.closest('.nota-item-row').remove()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(row);
}

function saveNota() {
    const noNota = document.getElementById('inputNoNota').value;
    const tanggal = document.getElementById('inputTglNota').value;
    const penerimaId = document.getElementById('inputPenerimaNota').value;
    const catatan = document.getElementById('inputCatatanNota').value;
    const select = document.getElementById('inputPenerimaNota');
    const namaPenerima = select.options[select.selectedIndex]?.dataset?.nama || '';

    if (!tanggal || !penerimaId) {
        showToast('Error', 'Tanggal dan Penerima wajib diisi!', 'danger');
        return;
    }

    // Collect items
    const items = [];
    document.querySelectorAll('.nota-item-row').forEach(row => {
        const name = row.querySelector('[name="itemName[]"]').value.trim();
        const qty = parseInt(row.querySelector('[name="itemQty[]"]').value) || 0;
        const unit = row.querySelector('[name="itemUnit[]"]').value.trim();
        const note = row.querySelector('[name="itemNote[]"]').value.trim();
        if (name && qty > 0) {
            items.push({ name, qty, unit, note });
        }
    });

    if (items.length === 0) {
        showToast('Error', 'Minimal 1 item pesanan harus diisi!', 'danger');
        return;
    }

    const notaData = {
        noNota, tanggal, penerimaId, namaPenerima, items, catatan,
        status: 'pending'
    };

    if (editingNotaId) {
        window.db.update('nota', editingNotaId, notaData);
        showToast('Berhasil', 'Nota pesanan berhasil diperbarui');
    } else {
        window.db.add('nota', notaData);
        showToast('Berhasil', 'Nota pesanan baru berhasil dibuat');
    }

    bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
    refreshNota();
    refreshDashboard();
}

function applyNotaFilter() {
    const filters = {
        dateStart: document.getElementById('filterDateStart').value,
        dateEnd: document.getElementById('filterDateEnd').value,
        status: document.getElementById('filterStatus').value
    };
    refreshNota('', filters);
}

window.viewNota = function(id) { openNotaModal(id); };
window.updateNotaStatus = function(id) {
    const n = window.db.getById('nota', id);
    const nextStatus = { pending: 'process', process: 'completed', completed: 'pending' };
    window.db.update('nota', id, { status: nextStatus[n.status] || 'pending' });
    refreshNota();
    refreshDashboard();
    showToast('Berhasil', `Status nota diubah ke "${getStatusLabel(nextStatus[n.status])}"`);
};
window.deleteNota = function(id) {
    if (confirm('Yakin ingin menghapus nota ini?')) {
        window.db.delete('nota', id);
        refreshNota();
        refreshDashboard();
        showToast('Berhasil', 'Nota berhasil dihapus');
    }
};



// ===== PDF GENERATION =====
window.downloadNotaPDF = function(id) {
    const nota = window.db.getById('nota', id);
    if (!nota) return;
    generatePDF([nota], `Nota_${nota.noNota}`);
};

function downloadSelectedPDF() {
    const nota = window.db.getCollection('nota');
    const today = new Date().toISOString().split('T')[0];
    const todayNota = nota.filter(n => n.tanggal === today);
    if (todayNota.length === 0) {
        showToast('Info', 'Tidak ada nota untuk hari ini', 'warning');
        return;
    }
    generatePDF(todayNota, `Nota_Harian_${today}`);
}

function generatePDF(notaList, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    notaList.forEach((nota, idx) => {
        if (idx > 0) doc.addPage();

        let y = margin;

        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTA PESANAN MAKANAN GIZI', pageWidth / 2, y, { align: 'center' });
        y += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('SPPG Battu Winangun', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // Info nota
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('No. Nota', margin, y);
        doc.text(':', margin + 30, y);
        doc.setFont('helvetica', 'normal');
        doc.text(nota.noNota, margin + 33, y);

        doc.setFont('helvetica', 'bold');
        doc.text('Tanggal', pageWidth / 2, y);
        doc.text(':', pageWidth / 2 + 25, y);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(nota.tanggal), pageWidth / 2 + 28, y);
        y += 6;

        doc.setFont('helvetica', 'bold');
        doc.text('Penerima', margin, y);
        doc.text(':', margin + 30, y);
        doc.setFont('helvetica', 'normal');
        doc.text(nota.namaPenerima || '-', margin + 33, y);

        doc.setFont('helvetica', 'bold');
        doc.text('Status', pageWidth / 2, y);
        doc.text(':', pageWidth / 2 + 25, y);
        doc.setFont('helvetica', 'normal');
        doc.text(getStatusLabel(nota.status), pageWidth / 2 + 28, y);
        y += 10;

        // Table items
        if (nota.items && nota.items.length > 0) {
            doc.autoTable({
                startY: y,
                head: [['No', 'Nama Item', 'Jumlah', 'Satuan', 'Keterangan']],
                body: nota.items.map((item, i) => [
                    i + 1, item.name, item.qty, item.unit || 'porsi', item.note || '-'
                ]),
                theme: 'grid',
                headStyles: { 
                    fillColor: [37, 99, 235], 
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9
                },
                bodyStyles: { fontSize: 9 },
                margin: { left: margin, right: margin },
                styles: { cellPadding: 3 }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        // Catatan
        if (nota.catatan) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(`Catatan: ${nota.catatan}`, margin, y);
            y += 10;
        }

        // Tanda Tangan Section
        y = Math.max(y + 10, 200);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const signWidth = (pageWidth - 2 * margin) / 3;
        const signPositions = [
            { x: margin + signWidth * 0, title: 'Ahli Gizi', name: 'Neti Is\'ad Anggraini' },
            { x: margin + signWidth * 1, title: 'KaSPPG', name: 'Alfiansah Prastyo' },
            { x: margin + signWidth * 2, title: 'Owner', name: 'Endang Resminingsih' }
        ];

        signPositions.forEach(pos => {
            doc.setFont('helvetica', 'normal');
            doc.text(pos.title, pos.x + signWidth / 2, y, { align: 'center' });
            
            // Signature line
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.line(pos.x + 5, y + 25, pos.x + signWidth - 5, y + 25);
            
            doc.setFont('helvetica', 'bold');
            doc.text(pos.name, pos.x + signWidth / 2, y + 30, { align: 'center' });
        });

        // Footer
        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, margin, footerY);
        doc.text(`Halaman ${idx + 1} dari ${notaList.length}`, pageWidth - margin, footerY, { align: 'right' });
        doc.setTextColor(0);
    });

    doc.save(`${filename}.pdf`);
    showToast('Berhasil', 'PDF berhasil didownload');
}



// ===== LAPORAN =====
function initLaporan() {
    document.getElementById('laporanDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('btnLaporanHarian').addEventListener('click', () => loadLaporan('harian'));
    document.getElementById('btnLaporanBulanan').addEventListener('click', () => loadLaporan('bulanan'));
    document.getElementById('btnDownloadLaporan').addEventListener('click', downloadLaporanPDF);
}

function loadLaporan(type = 'harian') {
    const dateInput = document.getElementById('laporanDate').value;
    if (!dateInput) {
        showToast('Info', 'Pilih tanggal terlebih dahulu', 'warning');
        return;
    }

    let nota = window.db.getCollection('nota');
    
    if (type === 'harian') {
        nota = nota.filter(n => n.tanggal === dateInput);
    } else {
        const month = dateInput.substring(0, 7);
        nota = nota.filter(n => n.tanggal && n.tanggal.startsWith(month));
    }

    // Update summary
    document.getElementById('laporanTotalNota').textContent = nota.length;
    const uniquePenerima = [...new Set(nota.map(n => n.penerimaId))];
    document.getElementById('laporanTotalPenerima').textContent = uniquePenerima.length;
    const totalItems = nota.reduce((sum, n) => sum + (n.items ? n.items.reduce((s, i) => s + i.qty, 0) : 0), 0);
    document.getElementById('laporanTotalItem').textContent = totalItems;

    // Fill table
    const tbody = document.getElementById('laporanBody');
    if (nota.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data untuk tanggal ini</td></tr>';
        return;
    }

    let rowNum = 0;
    const rows = [];
    nota.forEach(n => {
        if (n.items) {
            n.items.forEach(item => {
                rowNum++;
                rows.push(`
                    <tr>
                        <td>${rowNum}</td>
                        <td>${n.noNota}</td>
                        <td>${n.namaPenerima}</td>
                        <td>${item.name}</td>
                        <td>${item.qty} ${item.unit || 'porsi'}</td>
                        <td>${item.note || '-'}</td>
                    </tr>
                `);
            });
        }
    });
    tbody.innerHTML = rows.join('');
}

function downloadLaporanPDF() {
    const dateInput = document.getElementById('laporanDate').value;
    if (!dateInput) {
        showToast('Info', 'Pilih tanggal terlebih dahulu', 'warning');
        return;
    }

    const nota = window.db.getCollection('nota').filter(n => n.tanggal === dateInput);
    if (nota.length === 0) {
        showToast('Info', 'Tidak ada data untuk tanggal ini', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN HARIAN PESANAN MAKANAN GIZI', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(11);
    doc.text('SPPG Battu Winangun', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal: ${formatDate(dateInput)}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Nota: ${nota.length}`, margin, y);
    const totalItems = nota.reduce((sum, n) => sum + (n.items ? n.items.reduce((s, i) => s + i.qty, 0) : 0), 0);
    doc.text(`Total Item: ${totalItems} porsi`, pageWidth / 2, y);
    y += 8;

    // Table
    const tableData = [];
    let rowNum = 0;
    nota.forEach(n => {
        if (n.items) {
            n.items.forEach(item => {
                rowNum++;
                tableData.push([rowNum, n.noNota, n.namaPenerima, item.name, `${item.qty} ${item.unit || 'porsi'}`, item.note || '-']);
            });
        }
    });

    doc.autoTable({
        startY: y,
        head: [['No', 'No. Nota', 'Penerima', 'Item', 'Jumlah', 'Keterangan']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
        styles: { cellPadding: 2.5 }
    });

    y = doc.lastAutoTable.finalY + 15;

    // Tanda Tangan
    y = Math.max(y, 200);
    doc.setFontSize(9);
    const signWidth = (pageWidth - 2 * margin) / 3;
    const signPositions = [
        { x: margin, title: 'Ahli Gizi', name: 'Neti Is\'ad Anggraini' },
        { x: margin + signWidth, title: 'KaSPPG', name: 'Alfiansah Prastyo' },
        { x: margin + signWidth * 2, title: 'Owner', name: 'Endang Resminingsih' }
    ];

    signPositions.forEach(pos => {
        doc.setFont('helvetica', 'normal');
        doc.text(pos.title, pos.x + signWidth / 2, y, { align: 'center' });
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(pos.x + 5, y + 25, pos.x + signWidth - 5, y + 25);
        doc.setFont('helvetica', 'bold');
        doc.text(pos.name, pos.x + signWidth / 2, y + 30, { align: 'center' });
    });

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, margin, footerY);
    doc.setTextColor(0);

    doc.save(`Laporan_Harian_${dateInput}.pdf`);
    showToast('Berhasil', 'Laporan PDF berhasil didownload');
}



// ===== SETTINGS =====
function initSettings() {
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const newPass = document.getElementById('settingsNewPassword').value;
        if (newPass) {
            // Update password in local (in production use Firebase Auth)
            const users = window.ADMIN_USERS;
            const user = users.find(u => u.username === session.username);
            if (user) {
                user.password = newPass;
                showToast('Berhasil', 'Password berhasil diubah');
                document.getElementById('settingsNewPassword').value = '';
            }
        }
    });

    document.getElementById('btnForceSync').addEventListener('click', () => {
        // Export data for sync
        const data = window.db.exportAll();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sppg_sync_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('lastSyncTime').textContent = new Date().toLocaleString('id-ID');
        showToast('Berhasil', 'Data berhasil diexport untuk sinkronisasi');
    });

    // Update stats
    const penerima = window.db.getCollection('penerima');
    const nota = window.db.getCollection('nota');
    document.getElementById('totalStoredData').textContent = `${penerima.length + nota.length} records`;
    document.getElementById('lastSyncTime').textContent = new Date().toLocaleString('id-ID');
}

// ===== UTILITY FUNCTIONS =====
function generateNotaNumber() {
    const now = new Date();
    const prefix = 'NOTA';
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const seq = String(window.db.getCollection('nota').length + 1).padStart(4, '0');
    return `${prefix}-${date}-${seq}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function getStatusLabel(status) {
    const labels = { pending: 'Menunggu', process: 'Diproses', completed: 'Selesai' };
    return labels[status] || status;
}

function getActivityText(activity) {
    const actions = { add: 'menambahkan', edit: 'memperbarui', delete: 'menghapus' };
    const collections = { penerima: 'penerima', nota: 'nota pesanan' };
    return `${actions[activity.action] || activity.action} ${collections[activity.collection] || activity.collection}: ${activity.itemName || ''}`;
}

function timeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);
    
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
    return formatDate(timestamp);
}

function parseExcelDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr);
    // Handle DD-MM-YYYY format
    const parts = str.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return str;
}

function mapJenisKelamin(val) {
    if (val === 'L' || val === 'Laki-laki' || val === 1) return 'L';
    if (val === 'P' || val === 'Perempuan' || val === 2 || val === 64) return 'P';
    return '';
}

function showToast(title, message, type = 'success') {
    const toastEl = document.getElementById('toastNotif');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}

// Global navigation helper
window.navigateTo = navigateTo;
