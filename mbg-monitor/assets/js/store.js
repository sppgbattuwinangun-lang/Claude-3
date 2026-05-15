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
  S.loadSample = function (days) {
    days = days || 30;
    const today = new Date();
    const rows = [];
    const menus = [
      { nasi:'Nasi Putih', hewani:'Telur',         sayur:'Sayur Tumis',     nabati:'Tempe',         buah:'Pisang' },
      { nasi:'Nasi Putih', hewani:'Ayam Bakar',    sayur:'Sop Sayur',       nabati:'Tahu',          buah:'Jeruk' },
      { nasi:'Nasi Putih', hewani:'Ikan Goreng',   sayur:'Cap Cay',         nabati:'Tempe Goreng',  buah:'Apel' },
      { nasi:'Nasi Putih', hewani:'Daging Sapi',   sayur:'Bayam Bening',    nabati:'Tahu Bacem',    buah:'Semangka' },
      { nasi:'Nasi Putih', hewani:'Telur Balado',  sayur:'Tumis Kangkung',  nabati:'Tempe Mendoan', buah:'Pepaya' },
      { nasi:'Nasi Putih', hewani:'Ayam Goreng',   sayur:'Sayur Asem',      nabati:'Tahu Goreng',   buah:'Melon' },
      { nasi:'Nasi Putih', hewani:'Ikan Bakar',    sayur:'Tumis Buncis',    nabati:'Tempe Bacem',   buah:'Mangga' }
    ];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      // Skip weekend (program MBG umumnya hari sekolah Senin-Jumat)
      // tapi tetap masukkan beberapa weekend agar grafik kontinu
      const m = menus[(days - 1 - i) % menus.length];
      const tanggal = d.toISOString().slice(0,10);
      const porsi = 3000 + Math.round(Math.random() * 800);
      const rec = {
        tanggal, hari: U.dayName(tanggal), porsi,
        menu_nasi: m.nasi, menu_hewani: m.hewani, menu_sayur: m.sayur, menu_nabati: m.nabati, menu_buah: m.buah,
        nasi_p: 200 + Math.random()*30,   nasi_s: 20 + Math.random()*20,
        hewani_p: 140 + Math.random()*20, hewani_s: 12 + Math.random()*15,
        sayur_p: 180 + Math.random()*30,  sayur_s: 22 + Math.random()*20,
        nabati_p: 90 + Math.random()*15,  nabati_s: 8  + Math.random()*10,
        buah_p:  120 + Math.random()*20,  buah_s:  10 + Math.random()*12
      };
      // round 1 dec
      ['nasi_p','nasi_s','hewani_p','hewani_s','sayur_p','sayur_s','nabati_p','nabati_s','buah_p','buah_s'].forEach(k => rec[k] = Math.round(rec[k]*10)/10);
      rec.id = U.uuid();
      rec.createdAt = Date.now();
      rows.push(rec);
    }
    S.saveAll(rows);
    return rows.length;
  };

  // Auto-seed dinonaktifkan: user input data sendiri.
  // Fungsi loadSample() tetap tersedia bila user klik tombol di Pengaturan/Data.
  S.autoSeedIfEmpty = function () { return false; };
})();
