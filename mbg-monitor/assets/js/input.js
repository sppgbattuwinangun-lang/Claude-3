/* =========================================================
   Input Harian — tabel CRUD + filter/search/sort + modal
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store, X = NS.excel;
  const I = (NS.input = {});

  const COLS = [
    { key: 'no',           label: 'No',                  num: false },
    { key: 'tanggal',      label: 'Tanggal',             num: false, format: v => U.fmtDate(v) },
    { key: 'hari',         label: 'Hari',                num: false },
    { key: 'menu_nasi',    label: 'Menu Nasi',           num: false },
    { key: 'menu_hewani',  label: 'Menu Protein Hewani', num: false },
    { key: 'menu_sayur',   label: 'Menu Sayur',          num: false },
    { key: 'menu_nabati',  label: 'Menu Protein Nabati', num: false },
    { key: 'menu_buah',    label: 'Menu Buah',           num: false },
    { key: 'porsi',        label: 'Jumlah Porsi',        num: true,  format: v => U.fmt(v,{maximumFractionDigits:0}) },
    { key: 'nasi_p',       label: 'Pemakaian Nasi (kg)', num: true,  format: v => U.fmt(v) },
    { key: 'nasi_s',       label: 'Sampah Nasi (kg)',    num: true,  format: v => U.fmt(v) },
    { key: 'nasi_pct_sampah',  label: '% Sampah Nasi',   num: true,  format: v => U.pct(v) },
    { key: 'nasi_pct_serapan', label: '% Serapan Nasi',  num: true,  format: v => U.pct(v) },
    { key: 'nasi_status',   label: 'Status Nasi',        num: false, badge: true },
    { key: 'hewani_p',      label: 'Pemakaian Hewani',   num: true,  format: v => U.fmt(v) },
    { key: 'hewani_s',      label: 'Sampah Hewani',      num: true,  format: v => U.fmt(v) },
    { key: 'hewani_pct_sampah',  label: '% Sampah Hewani',  num: true, format: v => U.pct(v) },
    { key: 'hewani_pct_serapan', label: '% Serapan Hewani', num: true, format: v => U.pct(v) },
    { key: 'hewani_status', label: 'Status Hewani',      num: false, badge: true },
    { key: 'sayur_p',       label: 'Pemakaian Sayur',    num: true,  format: v => U.fmt(v) },
    { key: 'sayur_s',       label: 'Sampah Sayur',       num: true,  format: v => U.fmt(v) },
    { key: 'sayur_pct_sampah',  label: '% Sampah Sayur',  num: true, format: v => U.pct(v) },
    { key: 'sayur_pct_serapan', label: '% Serapan Sayur', num: true, format: v => U.pct(v) },
    { key: 'sayur_status',  label: 'Status Sayur',       num: false, badge: true },
    { key: 'nabati_p',      label: 'Pemakaian Nabati',   num: true,  format: v => U.fmt(v) },
    { key: 'nabati_s',      label: 'Sampah Nabati',      num: true,  format: v => U.fmt(v) },
    { key: 'nabati_pct_sampah',  label: '% Sampah Nabati',  num: true, format: v => U.pct(v) },
    { key: 'nabati_pct_serapan', label: '% Serapan Nabati', num: true, format: v => U.pct(v) },
    { key: 'nabati_status', label: 'Status Nabati',      num: false, badge: true },
    { key: 'buah_p',        label: 'Pemakaian Buah',     num: true,  format: v => U.fmt(v) },
    { key: 'buah_s',        label: 'Sampah Buah',        num: true,  format: v => U.fmt(v) },
    { key: 'buah_pct_sampah',  label: '% Sampah Buah',    num: true, format: v => U.pct(v) },
    { key: 'buah_pct_serapan', label: '% Serapan Buah',   num: true, format: v => U.pct(v) },
    { key: 'buah_status',   label: 'Status Buah',        num: false, badge: true },
    { key: 'total_p',       label: 'Total Pemakaian',    num: true,  format: v => U.fmt(v) },
    { key: 'total_s',       label: 'Total Sampah',       num: true,  format: v => U.fmt(v) },
    { key: 'total_pct_sampah',  label: '% Sampah Total',  num: true, format: v => U.pct(v) },
    { key: 'total_pct_serapan', label: '% Serapan Total', num: true, format: v => U.pct(v) },
    { key: 'total_status',  label: 'Status Total',       num: false, badge: true },
    { key: '_actions',      label: 'Aksi',               num: false, sticky: true }
  ];

  let sortBy = 'tanggal', sortDir = 'desc';
  let page = 1, pageSize = 25;
  let filterText = '', filterStatus = '__all__', filterMonth = '';

  I.init = function () {
    renderHead();
    bindToolbar();
    bindModal();
    I.render();
  };

  function renderHead() {
    const head = document.getElementById('dataHead');
    const tr = document.createElement('tr');
    COLS.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.label;
      if (c.num) th.classList.add('col-num');
      th.dataset.key = c.key;
      if (c.key !== '_actions') {
        th.addEventListener('click', () => {
          if (sortBy === c.key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortBy = c.key; sortDir = 'asc'; }
          I.render();
        });
        const sp = document.createElement('span');
        sp.className = 'sort';
        sp.textContent = ' ↕';
        th.appendChild(sp);
      }
      tr.appendChild(th);
    });
    head.innerHTML = '';
    head.appendChild(tr);
  }

  function bindToolbar() {
    document.getElementById('tableSearch').addEventListener('input', (e) => {
      filterText = e.target.value.toLowerCase(); page = 1; I.render();
    });
    document.getElementById('filterStatus').addEventListener('change', (e) => {
      filterStatus = e.target.value; page = 1; I.render();
    });
    document.getElementById('filterMonth').addEventListener('change', (e) => {
      filterMonth = e.target.value; page = 1; I.render();
    });
    const psEl = document.getElementById('pageSize');
    if (psEl) psEl.addEventListener('change', (e) => { pageSize = parseInt(e.target.value, 10) || 25; page = 1; I.render(); });

    document.getElementById('btnAdd').addEventListener('click', () => openModal(null));
    document.getElementById('btnQuickAdd').addEventListener('click', () => {
      NS.app.go('input'); openModal(null);
    });

    document.getElementById('btnExport').addEventListener('click', () => exportCurrent());
    document.getElementById('btnExport2').addEventListener('click', () => exportCurrent());
    document.getElementById('btnExportCsv').addEventListener('click', () => X.exportCsv(S.getAll(), S.getSettings()));
    document.getElementById('btnExportJson').addEventListener('click', () => X.exportJson(S.getAll()));

    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
    document.getElementById('btnImport2').addEventListener('click', () => document.getElementById('fileImport2').click());
    document.getElementById('fileImport').addEventListener('change', handleImport);
    document.getElementById('fileImport2').addEventListener('change', handleImport);

    document.getElementById('btnLoadSample').addEventListener('click', () => {
      if (S.getAll().length && !confirm('Ini akan menambahkan data contoh ke catatan saat ini. Lanjut?')) return;
      S.loadSample();
      U.toast('Data contoh dimuat', 'success');
    });
    document.getElementById('btnReset').addEventListener('click', () => {
      if (!confirm('Hapus SEMUA data? Tindakan ini tidak dapat dibatalkan.')) return;
      S.removeAll();
      U.toast('Semua data dihapus', 'warn');
    });
    document.getElementById('btnExportPdf').addEventListener('click', () => window.print());
  }

  function exportCurrent() {
    const rows = S.getAll();
    if (!rows.length) { U.toast('Belum ada data untuk diekspor', 'warn'); return; }
    X.exportXlsx(rows, S.getSettings());
    U.toast('Excel berhasil diunduh', 'success');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    U.toast('Memproses file…', 'info');
    X.importFile(file).then(res => {
      const rows = S.getAll().concat(res.rows);
      S.saveAll(rows);
      U.toast(`Berhasil import ${res.count} baris dari sheet "${res.sheetName}"`, 'success');
    }).catch(err => {
      console.error(err);
      U.toast('Gagal import: ' + err.message, 'error');
    });
  }

  I.render = function () {
    const settings = S.getSettings();
    let rows = S.getAll().map(r => S.compute(r, settings));

    // search
    if (filterText) {
      rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(filterText)));
    }
    // status filter (total status)
    if (filterStatus && filterStatus !== '__all__') {
      if (filterStatus === '__empty__') rows = rows.filter(r => !r.total_status);
      else rows = rows.filter(r => r.total_status === filterStatus);
    }
    // month filter
    if (filterMonth) rows = rows.filter(r => String(r.tanggal || '').startsWith(filterMonth));

    // sort
    rows.sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      if (va === undefined || va === null || va === '') return 1;
      if (vb === undefined || vb === null || vb === '') return -1;
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    document.getElementById('rowCount').textContent = rows.length + ' baris';

    // pagination
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);

    const body = document.getElementById('dataBody');
    body.innerHTML = '';
    slice.forEach((r, idx) => {
      const tr = document.createElement('tr');
      COLS.forEach(c => {
        const td = document.createElement('td');
        if (c.num) td.classList.add('col-num');
        if (c.key === 'no') {
          td.textContent = start + idx + 1;
        } else if (c.key === '_actions') {
          td.innerHTML = `
            <div class="tbl-actions">
              <button class="btn btn-sm btn-ghost" data-act="edit" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
              <button class="btn btn-sm btn-ghost" data-act="del" title="Hapus" style="color:var(--c-danger)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>`;
          td.querySelector('[data-act="edit"]').addEventListener('click', () => openModal(r.id));
          td.querySelector('[data-act="del"]').addEventListener('click', () => {
            if (confirm('Hapus baris ini?')) { S.remove(r.id); U.toast('Baris dihapus', 'warn'); }
          });
        } else if (c.badge) {
          td.innerHTML = renderBadge(r[c.key]);
        } else {
          const v = r[c.key];
          td.textContent = (v === null || v === undefined || v === '') ? '—' : (c.format ? c.format(v) : v);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // pagination control
    renderPagination(totalPages);
  };

  function renderBadge(v) {
    if (!v) return '<span class="badge">—</span>';
    if (v === 'Terserap') return '<span class="badge b-ok">Terserap</span>';
    return '<span class="badge b-warn">' + v + '</span>';
  }

  function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
    el.innerHTML = '';
    if (totalPages <= 1) return;
    const mk = (label, p, dis, active) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (active ? ' active' : '');
      b.textContent = label;
      b.disabled = !!dis;
      b.addEventListener('click', () => { page = p; I.render(); });
      return b;
    };
    el.appendChild(mk('«', 1, page === 1));
    el.appendChild(mk('‹', page - 1, page === 1));
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let p = start; p <= end; p++) el.appendChild(mk(String(p), p, false, p === page));
    el.appendChild(mk('›', page + 1, page === totalPages));
    el.appendChild(mk('»', totalPages, page === totalPages));
  }

  // ---------- Modal ----------
  let modalEditingId = null;

  function bindModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('btnCancel').addEventListener('click', closeModal);
    document.getElementById('modalMask').addEventListener('click', (e) => {
      if (e.target.id === 'modalMask') closeModal();
    });
    document.getElementById('btnSave').addEventListener('click', () => saveModal(false));
    document.getElementById('btnSaveAdd').addEventListener('click', () => saveModal(true));
    document.getElementById('btnDelete').addEventListener('click', () => {
      if (modalEditingId && confirm('Hapus baris ini?')) {
        S.remove(modalEditingId);
        U.toast('Baris dihapus', 'warn');
        closeModal();
      }
    });
    // tanggal -> hari otomatis + live preview
    document.getElementById('fTanggal').addEventListener('change', () => {
      document.getElementById('fHari').value = U.dayName(document.getElementById('fTanggal').value);
      updateLivePreview();
    });
    ['fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS','fPorsi'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateLivePreview);
    });
  }

  function openModal(id) {
    modalEditingId = id || null;
    const f = (sel) => document.getElementById(sel);
    const settings = S.getSettings();
    if (id) {
      const r = S.getById(id);
      if (!r) return;
      f('modalTitle').textContent = 'Edit Data — ' + U.fmtDate(r.tanggal);
      f('btnDelete').classList.remove('hidden');
      f('fId').value = r.id;
      f('fTanggal').value = r.tanggal || '';
      f('fHari').value = r.hari || U.dayName(r.tanggal);
      f('fPorsi').value = r.porsi ?? '';
      f('fMenuNasi').value = r.menu_nasi || '';
      f('fMenuHewani').value = r.menu_hewani || '';
      f('fMenuSayur').value = r.menu_sayur || '';
      f('fMenuNabati').value = r.menu_nabati || '';
      f('fMenuBuah').value = r.menu_buah || '';
      f('fNasiP').value   = r.nasi_p   ?? ''; f('fNasiS').value   = r.nasi_s   ?? '';
      f('fHewaniP').value = r.hewani_p ?? ''; f('fHewaniS').value = r.hewani_s ?? '';
      f('fSayurP').value  = r.sayur_p  ?? ''; f('fSayurS').value  = r.sayur_s  ?? '';
      f('fNabatiP').value = r.nabati_p ?? ''; f('fNabatiS').value = r.nabati_s ?? '';
      f('fBuahP').value   = r.buah_p   ?? ''; f('fBuahS').value   = r.buah_s   ?? '';
    } else {
      f('modalTitle').textContent = 'Tambah Data';
      f('btnDelete').classList.add('hidden');
      f('fId').value = '';
      f('fTanggal').value = U.todayISO();
      f('fHari').value = U.dayName(U.todayISO());
      ['fPorsi','fMenuNasi','fMenuHewani','fMenuSayur','fMenuNabati','fMenuBuah',
       'fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS'
      ].forEach(id => f(id).value = '');
    }
    updateLivePreview();
    document.getElementById('modalMask').classList.add('show');
  }

  function closeModal() {
    document.getElementById('modalMask').classList.remove('show');
    modalEditingId = null;
  }

  function readForm() {
    const f = (sel) => document.getElementById(sel);
    const num = (id) => {
      const v = f(id).value;
      return v === '' ? null : Number(v);
    };
    return {
      id: f('fId').value || undefined,
      tanggal: f('fTanggal').value,
      hari: f('fHari').value || U.dayName(f('fTanggal').value),
      porsi: num('fPorsi'),
      menu_nasi: f('fMenuNasi').value.trim(),
      menu_hewani: f('fMenuHewani').value.trim(),
      menu_sayur: f('fMenuSayur').value.trim(),
      menu_nabati: f('fMenuNabati').value.trim(),
      menu_buah: f('fMenuBuah').value.trim(),
      nasi_p: num('fNasiP'),     nasi_s: num('fNasiS'),
      hewani_p: num('fHewaniP'), hewani_s: num('fHewaniS'),
      sayur_p: num('fSayurP'),   sayur_s: num('fSayurS'),
      nabati_p: num('fNabatiP'), nabati_s: num('fNabatiS'),
      buah_p: num('fBuahP'),     buah_s: num('fBuahS')
    };
  }

  function updateLivePreview() {
    const rec = readForm();
    const c = S.compute(rec);
    document.getElementById('lpTotalP').textContent = (c.total_p ?? 0) ? U.fmt(c.total_p) + ' kg' : '0 kg';
    document.getElementById('lpTotalS').textContent = (c.total_s ?? 0) ? U.fmt(c.total_s) + ' kg' : '0 kg';
    document.getElementById('lpStatus').innerHTML = renderBadge(c.total_status);
  }

  function saveModal(addAnother) {
    const rec = readForm();
    if (!rec.tanggal) { U.toast('Tanggal wajib diisi', 'error'); return; }
    if (rec.porsi === null || rec.porsi < 0) { U.toast('Jumlah porsi wajib diisi', 'error'); return; }
    const isEdit = !!modalEditingId;
    S.upsert(rec);
    U.toast(isEdit ? 'Data diperbarui' : 'Data tersimpan', 'success');
    if (addAnother && !isEdit) {
      // Auto-fill: tanggal +1 hari, menu di-keep, angka direset
      const next = new Date(rec.tanggal);
      next.setDate(next.getDate() + 1);
      const f = (sel) => document.getElementById(sel);
      const nextISO = next.toISOString().slice(0,10);
      // Reset form tapi keep menu names + tanggal jadi besok
      modalEditingId = null;
      f('modalTitle').textContent = 'Tambah Data — ' + U.fmtDate(nextISO);
      f('btnDelete').classList.add('hidden');
      f('fId').value = '';
      f('fTanggal').value = nextISO;
      f('fHari').value = U.dayName(nextISO);
      // Menu names di-keep agar input cepat
      // Reset porsi & semua angka
      ['fPorsi','fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS'].forEach(id => f(id).value = '');
      updateLivePreview();
      f('fPorsi').focus();
    } else {
      closeModal();
    }
  }
})();
