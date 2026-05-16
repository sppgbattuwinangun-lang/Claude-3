/* =========================================================
   Store — data CRUD, perhitungan otomatis, real-time sync
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util;
  const S = (NS.store = {});

  // 5 item utama, sesuai Excel
  S.ITEMS = [
    { key: 'nasi',   label: 'Nasi',            color: '#f59e0b' },
    { key: 'hewani', label: 'Protein Hewani',  color: '#ef4444' },
    { key: 'sayur',  label: 'Sayur',           color: '#16a34a' },
    { key: 'nabati', label: 'Protein Nabati',  color: '#8b5cf6' },
    { key: 'buah',   label: 'Buah',            color: '#ec4899' }
  ];

  S.DEFAULT_SETTINGS = {
    ambangSerapan: 0.80, // 80%
    organisasi: 'SPPG Battu Winangun'
  };

  S.getSettings = function () {
    const s = U.read(U.K.SETTING, null);
    return Object.assign({}, S.DEFAULT_SETTINGS, s || {});
  };
  S.saveSettings = function (patch) {
    const next = Object.assign({}, S.getSettings(), patch || {});
    U.write(U.K.SETTING, next);
    U.bus.emit('settings:changed', next);
    return next;
  };

  S.getAll = function () {
    return U.read(U.K.DATA, []);
  };
  S.saveAll = function (rows) {
    U.write(U.K.DATA, rows);
    U.bus.emit('data:changed', { count: rows.length });
  };

  S.getById = function (id) {
    return S.getAll().find(r => r.id === id) || null;
  };

  S.upsert = function (record) {
    const rows = S.getAll();
    let final;
    if (record.id) {
      const i = rows.findIndex(r => r.id === record.id);
      if (i >= 0) {
        rows[i] = Object.assign({}, rows[i], record, { updatedAt: Date.now() });
        final = rows[i];
      } else {
        record.createdAt = Date.now();
        rows.push(record);
        final = record;
      }
    } else {
      record.id = U.uuid();
      record.createdAt = Date.now();
      record.updatedAt = Date.now();
      rows.push(record);
      final = record;
    }
    S.saveAll(rows);
    return final;
  };

  S.remove = function (id) {
    const rows = S.getAll().filter(r => r.id !== id);
    S.saveAll(rows);
  };

  S.removeAll = function () {
    S.saveAll([]);
  };

  // Hitung metrik untuk satu baris
  // record: { tanggal, hari, porsi, menu_*, *_p, *_s }
  S.compute = function (rec, settings) {
    settings = settings || S.getSettings();
    const out = Object.assign({}, rec);
    let totalP = 0, totalS = 0, hasAny = false;
    S.ITEMS.forEach(it => {
      const p = numOrNull(rec[it.key + '_p']);
      const s = numOrNull(rec[it.key + '_s']);
      out[it.key + '_p'] = p;
      out[it.key + '_s'] = s;
      if (p !== null && s !== null && p > 0) {
        const pctSampah = s / p;
        const pctSerap = 1 - pctSampah;
        out[it.key + '_pct_sampah']  = pctSampah;
        out[it.key + '_pct_serapan'] = pctSerap;
        out[it.key + '_status'] = pctSerap >= settings.ambangSerapan ? 'Terserap' : 'Perlu Evaluasi';
        totalP += p; totalS += s; hasAny = true;
      } else {
        out[it.key + '_pct_sampah']  = null;
        out[it.key + '_pct_serapan'] = null;
        out[it.key + '_status'] = '';
        if (p !== null) { totalP += p; hasAny = true; }
        if (s !== null) { totalS += s; hasAny = true; }
      }
    });
    out.total_p = hasAny ? totalP : null;
    out.total_s = hasAny ? totalS : null;
    if (totalP > 0) {
      out.total_pct_sampah  = totalS / totalP;
      out.total_pct_serapan = 1 - (totalS / totalP);
      out.total_status = (1 - totalS/totalP) >= settings.ambangSerapan ? 'Terserap' : 'Perlu Evaluasi';
    } else {
      out.total_pct_sampah = null;
      out.total_pct_serapan = null;
      out.total_status = '';
    }
    if (!out.hari && out.tanggal) out.hari = U.dayName(out.tanggal);
    return out;
  };

  function numOrNull(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null;
    return Number(v);
  }

  // Agregasi: total per item, total keseluruhan
  S.aggregate = function (rows, settings) {
    settings = settings || S.getSettings();
    const agg = { perItem: {}, total: { p: 0, s: 0, days: 0, daysOk: 0 } };
    S.ITEMS.forEach(it => agg.perItem[it.key] = { p: 0, s: 0, days: 0, daysOk: 0, label: it.label, color: it.color });
    rows.forEach(r => {
      const c = S.compute(r, settings);
      let rowHasAny = false;
      let rowAllOk = c.total_status === 'Terserap';
      S.ITEMS.forEach(it => {
        const p = c[it.key + '_p'], s = c[it.key + '_s'];
        if (p !== null) { agg.perItem[it.key].p += p; rowHasAny = true; }
        if (s !== null) { agg.perItem[it.key].s += s; rowHasAny = true; }
        if (p !== null && s !== null && p > 0) {
          agg.perItem[it.key].days++;
          if ((1 - s/p) >= settings.ambangSerapan) agg.perItem[it.key].daysOk++;
        }
      });
      if (rowHasAny) {
        agg.total.days++;
        if (c.total_p && c.total_p > 0) {
          agg.total.p += c.total_p;
          agg.total.s += c.total_s;
          if (rowAllOk) agg.total.daysOk++;
        }
      }
    });
    // derived
    Object.values(agg.perItem).forEach(it => {
      it.pctSampah  = it.p > 0 ? it.s / it.p : null;
      it.pctSerapan = it.p > 0 ? 1 - it.s / it.p : null;
      it.status     = (it.pctSerapan !== null && it.pctSerapan >= settings.ambangSerapan) ? 'Terserap' : (it.p > 0 ? 'Perlu Evaluasi' : '—');
    });
    agg.total.pctSampah  = agg.total.p > 0 ? agg.total.s / agg.total.p : null;
    agg.total.pctSerapan = agg.total.p > 0 ? 1 - agg.total.s / agg.total.p : null;
    agg.total.status = (agg.total.pctSerapan !== null && agg.total.pctSerapan >= settings.ambangSerapan)
      ? 'Terserap' : (agg.total.p > 0 ? 'Perlu Evaluasi' : '—');
    return agg;
  };

  // Sample data bila kosong (agar dashboard tidak kosong saat pertama kali dipakai)
  // Default 30 hari, menu sesuai pola Excel SPPG (Nasi Putih, Telur, Sayur Tumis, Tempe, Pisang)
  // Variasi sengaja dibuat agar ada hari "Terserap" dan "Perlu Evaluasi"
  S.loadSample = function (days) {
    days = days || 30;
    const today = new Date();
    const rows = [];
    const menus = [
      { nasi:'Nasi Putih', hewani:'Telur',          sayur:'Sayur Tumis',     nabati:'Tempe',          buah:'Pisang' },
      { nasi:'Nasi Putih', hewani:'Ayam Bakar',     sayur:'Sop Sayur',       nabati:'Tahu',           buah:'Jeruk' },
      { nasi:'Nasi Putih', hewani:'Ikan Goreng',    sayur:'Cap Cay',         nabati:'Tempe Goreng',   buah:'Apel' },
      { nasi:'Nasi Kuning',hewani:'Daging Sapi',    sayur:'Bayam Bening',    nabati:'Tahu Bacem',     buah:'Semangka' },
      { nasi:'Nasi Putih', hewani:'Telur Balado',   sayur:'Tumis Kangkung',  nabati:'Tempe Mendoan',  buah:'Pepaya' },
      { nasi:'Nasi Putih', hewani:'Ayam Goreng',    sayur:'Sayur Asem',      nabati:'Tahu Goreng',    buah:'Melon' },
      { nasi:'Nasi Putih', hewani:'Ikan Bakar',     sayur:'Tumis Buncis',    nabati:'Tempe Bacem',    buah:'Mangga' },
      { nasi:'Nasi Putih', hewani:'Rendang',        sayur:'Sayur Lodeh',     nabati:'Tahu Isi',       buah:'Salak' },
      { nasi:'Nasi Putih', hewani:'Telur Dadar',    sayur:'Tumis Wortel',    nabati:'Tempe Orek',     buah:'Anggur' },
      { nasi:'Nasi Putih', hewani:'Ayam Suwir',     sayur:'Sup Jagung',      nabati:'Tahu Sutera',    buah:'Pir' }
    ];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dayIdx = days - 1 - i;
      const m = menus[dayIdx % menus.length];
      const tanggal = d.toISOString().slice(0, 10);
      const porsi = 3000 + Math.round(Math.random() * 800);

      // Buat 3 variasi: ~70% terserap baik, ~20% perlu evaluasi, ~10% serapan tinggi
      const r = Math.random();
      let factor;
      if (r < 0.20) {
        // Hari kurang baik (serapan ~60-78%, masuk Perlu Evaluasi)
        factor = 0.22 + Math.random() * 0.16;
      } else if (r < 0.85) {
        // Hari normal (serapan ~80-92%)
        factor = 0.08 + Math.random() * 0.12;
      } else {
        // Hari sangat baik (serapan >92%)
        factor = 0.02 + Math.random() * 0.06;
      }

      const round1 = (n) => Math.round(n * 10) / 10;
      const rec = {
        tanggal, hari: U.dayName(tanggal), porsi,
        menu_nasi: m.nasi, menu_hewani: m.hewani, menu_sayur: m.sayur, menu_nabati: m.nabati, menu_buah: m.buah,
        nasi_p:   round1(200 + Math.random() * 30),
        hewani_p: round1(140 + Math.random() * 20),
        sayur_p:  round1(180 + Math.random() * 30),
        nabati_p: round1(90  + Math.random() * 15),
        buah_p:   round1(120 + Math.random() * 20)
      };
      // Sampah = pemakaian × factor (per item, dengan sedikit variasi)
      rec.nasi_s   = round1(rec.nasi_p   * (factor + (Math.random() - 0.5) * 0.04));
      rec.hewani_s = round1(rec.hewani_p * (factor + (Math.random() - 0.5) * 0.04));
      rec.sayur_s  = round1(rec.sayur_p  * (factor + (Math.random() - 0.5) * 0.04));
      rec.nabati_s = round1(rec.nabati_p * (factor + (Math.random() - 0.5) * 0.04));
      rec.buah_s   = round1(rec.buah_p   * (factor + (Math.random() - 0.5) * 0.04));
      // Pastikan tidak negatif
      ['nasi_s','hewani_s','sayur_s','nabati_s','buah_s'].forEach(k => { if (rec[k] < 0) rec[k] = 0; });

      rec.id = U.uuid();
      rec.createdAt = Date.now();
      rows.push(rec);
    }
    S.saveAll(rows);
    return rows.length;
  };

  // Auto-seed dimatikan: aplikasi tidak lagi memuat data contoh otomatis.
  // User input data secara manual lewat form. Fungsi loadSample() tetap tersedia
  // jika sewaktu-waktu admin ingin mencoba dengan data dummy.
  S.autoSeedIfEmpty = function () {
    return false;
  };

  // Filter records berdasarkan rentang tanggal (inklusif). Format: ISO 'YYYY-MM-DD'.
  S.filterByRange = function (rows, from, to) {
    rows = rows || S.getAll();
    return rows.filter(r => {
      const d = String(r.tanggal || '');
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  };

  // Helper: dapatkan rentang tanggal min/max dari semua data
  S.getDateRange = function () {
    const rows = S.getAll();
    if (!rows.length) return { min: null, max: null };
    const dates = rows.map(r => r.tanggal).filter(Boolean).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  };
})();
