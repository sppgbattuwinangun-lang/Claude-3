/* =========================================================
   Input Harian — tabel CRUD + filter/search/sort + modal (defensive)
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
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
    if (!document.getElementById('dataHead')) return;
    renderHead();
    bindToolbar();
    bindModal();
    I.render();
  };

  function renderHead() {
    const head = document.getElementById('dataHead');
    if (!head) return;
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
    onChange('tableSearch', 'input', (e) => { filterText = e.target.value.toLowerCase(); page = 1; I.render(); });
    onChange('filterStatus', 'change', (e) => { filterStatus = e.target.value; page = 1; I.render(); });
    onChange('filterMonth',  'change', (e) => { filterMonth  = e.target.value; page = 1; I.render(); });
    onChange('pageSize',     'change', (e) => { pageSize = parseInt(e.target.value, 10) || 25; page = 1; I.render(); });

    on('btnAdd',       'click', () => openModal(null));
    on('btnQuickAdd',  'click', () => { if (NS.app) NS.app.go('input'); openModal(null); });
    on('btnReset',     'click', () => {
      if (!confirm('Hapus SEMUA data? Tindakan ini tidak dapat dibatalkan.')) return;
      S.removeAll();
      U.toast('Semua data dihapus', 'warn');
    });
    on('btnLoadSample', 'click', () => {
      S.forceSeedOne();
      U.toast('Data contoh 1 hari ditambahkan', 'success');
    });
  }

  function on(id, evt, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }
  function onChange(id, evt, fn) { on(id, evt, fn); }

  I.render = function () {
    try { _render(); } catch (err) { console.error('[input.render]', err); }
  };

  function _render() {
    if (!document.getElementById('dataBody')) return;
    const settings = S.getSettings();
    let rows = S.getAll().map(r => S.compute(r, settings));

    if (filterText) {
      rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(filterText)));
    }
    if (filterStatus && filterStatus !== '__all__') {
      if (filterStatus === '__empty__') rows = rows.filter(r => !r.total_status);
      else rows = rows.filter(r => r.total_status === filterStatus);
    }
    if (filterMonth) rows = rows.filter(r => String(r.tanggal || '').startsWith(filterMonth));

    rows.sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      if (va === undefined || va === null || va === '') return 1;
      if (vb === undefined || vb === null || vb === '') return -1;
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const rc = document.getElementById('rowCount');
    if (rc) rc.textContent = rows.length + ' baris';

    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);

    const body = document.getElementById('dataBody');
    body.innerHTML = '';
    if (!slice.length) {
      body.insertAdjacentHTML('beforeend', `
        <tr><td colspan="${COLS.length}" style="text-align:center;padding:40px 20px;">
          <div style="opacity:.6;font-size:13px">Belum ada data. Klik <b>Tambah Data</b> di kanan atas untuk mulai mencatat.</div>
        </td></tr>`);
    }
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

    renderPagination(totalPages);
  }

  function renderBadge(v) {
    if (!v) return '<span class="badge">—</span>';
    if (v === 'Terserap') return '<span class="badge b-ok">Terserap</span>';
    return '<span class="badge b-warn">' + v + '</span>';
  }

  function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
    if (!el) return;
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
    on('modalClose', 'click', closeModal);
    on('btnCancel',  'click', closeModal);
    on('modalMask',  'click', (e) => { if (e.target.id === 'modalMask') closeModal(); });
    on('btnSave',    'click', () => saveModal(false));
    on('btnSaveAdd', 'click', () => saveModal(true));
    on('btnDelete',  'click', () => {
      if (modalEditingId && confirm('Hapus baris ini?')) {
        S.remove(modalEditingId);
        U.toast('Baris dihapus', 'warn');
        closeModal();
      }
    });
    on('fTanggal', 'change', () => {
      const t = document.getElementById('fTanggal');
      const h = document.getElementById('fHari');
      if (t && h) h.value = U.dayName(t.value);
      updateLivePreview();
    });
    ['fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS','fPorsi'].forEach(id => {
      on(id, 'input', updateLivePreview);
    });
  }

  function openModal(id) {
    modalEditingId = id || null;
    const f = (sel) => document.getElementById(sel);
    if (id) {
      const r = S.getById(id);
      if (!r) return;
      setText('modalTitle', 'Edit Data — ' + U.fmtDate(r.tanggal));
      const bd = f('btnDelete'); if (bd) bd.classList.remove('hidden');
      setVal('fId', r.id);
      setVal('fTanggal', r.tanggal || '');
      setVal('fHari', r.hari || U.dayName(r.tanggal));
      setVal('fPorsi', r.porsi ?? '');
      setVal('fMenuNasi', r.menu_nasi || '');
      setVal('fMenuHewani', r.menu_hewani || '');
      setVal('fMenuSayur', r.menu_sayur || '');
      setVal('fMenuNabati', r.menu_nabati || '');
      setVal('fMenuBuah', r.menu_buah || '');
      setVal('fNasiP',   r.nasi_p   ?? ''); setVal('fNasiS',   r.nasi_s   ?? '');
      setVal('fHewaniP', r.hewani_p ?? ''); setVal('fHewaniS', r.hewani_s ?? '');
      setVal('fSayurP',  r.sayur_p  ?? ''); setVal('fSayurS',  r.sayur_s  ?? '');
      setVal('fNabatiP', r.nabati_p ?? ''); setVal('fNabatiS', r.nabati_s ?? '');
      setVal('fBuahP',   r.buah_p   ?? ''); setVal('fBuahS',   r.buah_s   ?? '');
    } else {
      setText('modalTitle', 'Tambah Data');
      const bd = f('btnDelete'); if (bd) bd.classList.add('hidden');
      setVal('fId', '');
      setVal('fTanggal', U.todayISO());
      setVal('fHari', U.dayName(U.todayISO()));
      ['fPorsi','fMenuNasi','fMenuHewani','fMenuSayur','fMenuNabati','fMenuBuah',
       'fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS'
      ].forEach(id => setVal(id, ''));
    }
    updateLivePreview();
    const m = document.getElementById('modalMask');
    if (m) m.classList.add('show');
  }

  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  function closeModal() {
    const m = document.getElementById('modalMask');
    if (m) m.classList.remove('show');
    modalEditingId = null;
  }

  function readForm() {
    const f = (sel) => document.getElementById(sel);
    const num = (id) => { const el = f(id); if (!el) return null; const v = el.value; return v === '' ? null : Number(v); };
    const txt = (id) => { const el = f(id); return el ? (el.value || '').trim() : ''; };
    return {
      id: (f('fId') && f('fId').value) || undefined,
      tanggal: f('fTanggal') ? f('fTanggal').value : '',
      hari: (f('fHari') && f('fHari').value) || U.dayName(f('fTanggal') ? f('fTanggal').value : ''),
      porsi: num('fPorsi'),
      menu_nasi: txt('fMenuNasi'),
      menu_hewani: txt('fMenuHewani'),
      menu_sayur: txt('fMenuSayur'),
      menu_nabati: txt('fMenuNabati'),
      menu_buah: txt('fMenuBuah'),
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
    setText('lpTotalP', (c.total_p ?? 0) ? U.fmt(c.total_p) + ' kg' : '0 kg');
    setText('lpTotalS', (c.total_s ?? 0) ? U.fmt(c.total_s) + ' kg' : '0 kg');
    const ls = document.getElementById('lpStatus');
    if (ls) ls.innerHTML = renderBadge(c.total_status);
  }

  function saveModal(addAnother) {
    try {
      const rec = readForm();
      if (!rec.tanggal) { U.toast('Tanggal wajib diisi', 'error'); return; }
      if (rec.porsi === null || rec.porsi < 0) { U.toast('Jumlah porsi wajib diisi', 'error'); return; }
      const isEdit = !!modalEditingId;
      S.upsert(rec);
      U.toast(isEdit ? 'Data diperbarui' : 'Data tersimpan', 'success');
      if (addAnother && !isEdit) {
        const next = new Date(rec.tanggal);
        next.setDate(next.getDate() + 1);
        const nextISO = next.toISOString().slice(0, 10);
        modalEditingId = null;
        setText('modalTitle', 'Tambah Data — ' + U.fmtDate(nextISO));
        const bd = document.getElementById('btnDelete'); if (bd) bd.classList.add('hidden');
        setVal('fId', '');
        setVal('fTanggal', nextISO);
        setVal('fHari', U.dayName(nextISO));
        ['fPorsi','fNasiP','fNasiS','fHewaniP','fHewaniS','fSayurP','fSayurS','fNabatiP','fNabatiS','fBuahP','fBuahS'].forEach(id => setVal(id, ''));
        updateLivePreview();
        try { document.getElementById('fPorsi').focus(); } catch (e) {}
      } else {
        closeModal();
      }
    } catch (err) {
      console.error('[saveModal]', err);
      U.toast('Gagal menyimpan: ' + err.message, 'error');
    }
  }
})();
