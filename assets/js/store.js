/* =========================================================
   Store — data CRUD, perhitungan otomatis, analytics, real-time sync
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util;
  const S = (NS.store = {});

  // 5 item utama, sesuai Excel SPPG
  S.ITEMS = [
    { key: 'nasi',   label: 'Nasi',            color: '#f59e0b' },
    { key: 'hewani', label: 'Protein Hewani',  color: '#ef4444' },
    { key: 'sayur',  label: 'Sayur',           color: '#16a34a' },
    { key: 'nabati', label: 'Protein Nabati',  color: '#8b5cf6' },
    { key: 'buah',   label: 'Buah',            color: '#ec4899' }
  ];

  // Cuaca options
  S.WEATHER = [
    { key: 'cerah',     label: 'Cerah',     icon: '☀️' },
    { key: 'berawan',   label: 'Berawan',   icon: '⛅' },
    { key: 'mendung',   label: 'Mendung',   icon: '☁️' },
    { key: 'hujan',     label: 'Hujan',     icon: '🌧️' },
    { key: 'gerimis',   label: 'Gerimis',   icon: '🌦️' }
  ];

  // Sasaran distribusi
  S.SASARAN = [
    { key: 'sd',     label: 'Siswa SD' },
    { key: 'smp',    label: 'Siswa SMP' },
    { key: 'sma',    label: 'Siswa SMA' },
    { key: 'paud',   label: 'PAUD/TK' },
    { key: 'ibu',    label: 'Ibu Hamil/Menyusui' },
    { key: 'balita', label: 'Balita' },
    { key: 'umum',   label: 'Umum' }
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
    const r = U.read(U.K.DATA, []);
    return Array.isArray(r) ? r : [];
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

  // ---------- Compute ----------
  // Hitung metrik untuk satu baris.
  // Schema record (semua opsional kecuali tanggal):
  //   tanggal, hari, porsi (= jumlah porsi terdistribusi)
  //   target_porsi (rencana), hadir (yang hadir/ambil), cuaca, sasaran (array)
  //   menu_nasi, menu_hewani, menu_sayur, menu_nabati, menu_buah
  //   {item}_p (pemakaian kg), {item}_s (sampah kg)
  //   {item}_org (sampah organik kg), {item}_anorg (sampah anorganik kg)
  //   alasan_sampah (string), catatan
  S.compute = function (rec, settings) {
    settings = settings || S.getSettings();
    const out = Object.assign({}, rec);
    let totalP = 0, totalS = 0, totalOrg = 0, totalAnorg = 0, hasAny = false, hasSubBreakdown = false;

    S.ITEMS.forEach(it => {
      const p   = numOrNull(rec[it.key + '_p']);
      const s   = numOrNull(rec[it.key + '_s']);
      const org = numOrNull(rec[it.key + '_org']);
      const ano = numOrNull(rec[it.key + '_anorg']);
      out[it.key + '_p'] = p;
      out[it.key + '_s'] = s;
      out[it.key + '_org'] = org;
      out[it.key + '_anorg'] = ano;

      // Hitung total sampah dari sub bila tersedia
      let effectiveS = s;
      if (s === null && (org !== null || ano !== null)) {
        effectiveS = (org || 0) + (ano || 0);
        out[it.key + '_s'] = effectiveS;
      }

      if (p !== null && effectiveS !== null && p > 0) {
        const pctSampah = effectiveS / p;
        const pctSerap = 1 - pctSampah;
        out[it.key + '_pct_sampah']  = pctSampah;
        out[it.key + '_pct_serapan'] = pctSerap;
        out[it.key + '_status'] = pctSerap >= settings.ambangSerapan ? 'Terserap' : 'Perlu Evaluasi';
        totalP += p;
        totalS += effectiveS;
        if (org !== null) { totalOrg += org; hasSubBreakdown = true; }
        if (ano !== null) { totalAnorg += ano; hasSubBreakdown = true; }
        hasAny = true;
      } else {
        out[it.key + '_pct_sampah']  = null;
        out[it.key + '_pct_serapan'] = null;
        out[it.key + '_status'] = '';
        if (p !== null) { totalP += p; hasAny = true; }
        if (effectiveS !== null) { totalS += effectiveS; hasAny = true; }
        if (org !== null) { totalOrg += org; hasSubBreakdown = true; }
        if (ano !== null) { totalAnorg += ano; hasSubBreakdown = true; }
      }
    });

    out.total_p = hasAny ? totalP : null;
    out.total_s = hasAny ? totalS : null;
    out.total_org = hasSubBreakdown ? totalOrg : null;
    out.total_anorg = hasSubBreakdown ? totalAnorg : null;

    if (totalP > 0) {
      out.total_pct_sampah  = totalS / totalP;
      out.total_pct_serapan = 1 - (totalS / totalP);
      out.total_status = (1 - totalS/totalP) >= settings.ambangSerapan ? 'Terserap' : 'Perlu Evaluasi';
    } else {
      out.total_pct_sampah = null;
      out.total_pct_serapan = null;
      out.total_status = '';
    }

    // Distribusi metrics
    const target = numOrNull(rec.target_porsi);
    const porsi  = numOrNull(rec.porsi);
    const hadir  = numOrNull(rec.hadir);
    out.target_porsi = target;
    out.porsi = porsi;
    out.hadir = hadir;
    out.tingkat_distribusi = (target && target > 0 && porsi !== null) ? porsi / target : null;
    out.tingkat_kehadiran  = (porsi && porsi > 0 && hadir !== null)  ? hadir / porsi  : null;

    if (!out.hari && out.tanggal) out.hari = U.dayName(out.tanggal);
    return out;
  };

  function numOrNull(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null;
    return Number(v);
  }

  // ---------- Aggregate ----------
  S.aggregate = function (rows, settings) {
    settings = settings || S.getSettings();
    const agg = {
      perItem: {},
      total: { p: 0, s: 0, org: 0, anorg: 0, days: 0, daysOk: 0,
               porsi: 0, target: 0, hadir: 0 }
    };
    S.ITEMS.forEach(it => agg.perItem[it.key] = {
      p: 0, s: 0, org: 0, anorg: 0, days: 0, daysOk: 0,
      label: it.label, color: it.color
    });
    rows.forEach(r => {
      const c = S.compute(r, settings);
      let rowHasAny = false;
      let rowAllOk = c.total_status === 'Terserap';
      S.ITEMS.forEach(it => {
        const p = c[it.key + '_p'], s = c[it.key + '_s'];
        const org = c[it.key + '_org'], ano = c[it.key + '_anorg'];
        if (p !== null) { agg.perItem[it.key].p += p; rowHasAny = true; }
        if (s !== null) { agg.perItem[it.key].s += s; rowHasAny = true; }
        if (org !== null) agg.perItem[it.key].org += org;
        if (ano !== null) agg.perItem[it.key].anorg += ano;
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
          if (c.total_org !== null) agg.total.org += c.total_org;
          if (c.total_anorg !== null) agg.total.anorg += c.total_anorg;
          if (rowAllOk) agg.total.daysOk++;
        }
        if (c.porsi) agg.total.porsi += c.porsi;
        if (c.target_porsi) agg.total.target += c.target_porsi;
        if (c.hadir) agg.total.hadir += c.hadir;
      }
    });
    Object.values(agg.perItem).forEach(it => {
      it.pctSampah  = it.p > 0 ? it.s / it.p : null;
      it.pctSerapan = it.p > 0 ? 1 - it.s / it.p : null;
      it.status     = (it.pctSerapan !== null && it.pctSerapan >= settings.ambangSerapan) ? 'Terserap' : (it.p > 0 ? 'Perlu Evaluasi' : '—');
    });
    agg.total.pctSampah  = agg.total.p > 0 ? agg.total.s / agg.total.p : null;
    agg.total.pctSerapan = agg.total.p > 0 ? 1 - agg.total.s / agg.total.p : null;
    agg.total.status = (agg.total.pctSerapan !== null && agg.total.pctSerapan >= settings.ambangSerapan)
      ? 'Terserap' : (agg.total.p > 0 ? 'Perlu Evaluasi' : '—');
    agg.total.pctDistribusi = agg.total.target > 0 ? agg.total.porsi / agg.total.target : null;
    agg.total.pctKehadiran  = agg.total.porsi  > 0 ? agg.total.hadir / agg.total.porsi  : null;
    return agg;
  };

  // ---------- ANALYTICS ENGINE ----------
  // Hasilkan insight lanjut:
  //  - bestDay, worstDay (berdasarkan % serapan)
  //  - currentStreak (hari berturut-turut "Terserap" dari yg terakhir)
  //  - longestStreak
  //  - trendDelta (perbandingan minggu ini vs minggu lalu)
  //  - byDayOfWeek (mean serapan per hari Senin..Minggu)
  //  - topMenusHigh / topMenusLow (menu paling baik dan paling buruk)
  //  - byWeather (mean serapan per kondisi cuaca)
  //  - bySasaran (mean serapan per sasaran)
  //  - heatmap (per tanggal: status & serapan)
  //  - perItemAvg (rata-rata serapan per item)
  //  - alasanFreq (frekuensi alasan sampah)
  S.analytics = function (rows, settings) {
    settings = settings || S.getSettings();
    rows = (rows || []).slice().sort((a, b) =>
      String(a.tanggal || '').localeCompare(String(b.tanggal || ''))
    );

    const ambang = settings.ambangSerapan;
    const out = {
      totalRows: rows.length,
      bestDay: null, worstDay: null,
      currentStreak: 0, longestStreak: 0,
      trendDelta: null, // selisih % serapan minggu ini vs minggu lalu
      thisWeekAvg: null, lastWeekAvg: null,
      byDayOfWeek: {}, // {Senin: {avg, count, ok}, ...}
      topMenusHigh: [], topMenusLow: [],
      byWeather: {}, bySasaran: {},
      heatmap: [],
      perItemAvg: {},
      alasanFreq: {},
      orgVsAnorg: { org: 0, anorg: 0, hasSub: false }
    };

    if (!rows.length) return out;

    // Compute all rows' metrics
    const enriched = rows.map(r => S.compute(r, settings));

    // ---- bestDay / worstDay ----
    const withSerapan = enriched.filter(r => r.total_pct_serapan !== null);
    if (withSerapan.length) {
      withSerapan.sort((a, b) => b.total_pct_serapan - a.total_pct_serapan);
      out.bestDay = simplifyDay(withSerapan[0]);
      out.worstDay = simplifyDay(withSerapan[withSerapan.length - 1]);
    }

    // ---- streaks (Terserap berturut-turut) ----
    let curr = 0, longest = 0;
    let runningCurr = 0;
    enriched.forEach(r => {
      if (r.total_status === 'Terserap') {
        runningCurr++;
        if (runningCurr > longest) longest = runningCurr;
      } else {
        runningCurr = 0;
      }
    });
    // currentStreak: hitung dari yang TERAKHIR ke belakang
    for (let i = enriched.length - 1; i >= 0; i--) {
      if (enriched[i].total_status === 'Terserap') curr++;
      else break;
    }
    out.currentStreak = curr;
    out.longestStreak = longest;

    // ---- minggu ini vs minggu lalu ----
    const today = new Date();
    const startWeek = new Date(today.getTime() - 6 * 86400000);
    const startLastWeek = new Date(today.getTime() - 13 * 86400000);
    const endLastWeek = new Date(today.getTime() - 7 * 86400000);

    const inRange = (iso, from, to) => {
      const d = new Date(iso);
      return d >= from && d <= to;
    };
    const thisWeek = enriched.filter(r =>
      r.total_pct_serapan !== null && inRange(r.tanggal, startWeek, today));
    const lastWeek = enriched.filter(r =>
      r.total_pct_serapan !== null && inRange(r.tanggal, startLastWeek, endLastWeek));

    if (thisWeek.length) {
      out.thisWeekAvg = thisWeek.reduce((a, r) => a + r.total_pct_serapan, 0) / thisWeek.length;
    }
    if (lastWeek.length) {
      out.lastWeekAvg = lastWeek.reduce((a, r) => a + r.total_pct_serapan, 0) / lastWeek.length;
    }
    if (out.thisWeekAvg !== null && out.lastWeekAvg !== null) {
      out.trendDelta = out.thisWeekAvg - out.lastWeekAvg;
    }

    // ---- byDayOfWeek ----
    const dayOrder = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    dayOrder.forEach(d => out.byDayOfWeek[d] = { sum: 0, count: 0, ok: 0 });
    enriched.forEach(r => {
      if (r.total_pct_serapan === null) return;
      const day = r.hari || U.dayName(r.tanggal);
      if (out.byDayOfWeek[day]) {
        out.byDayOfWeek[day].sum += r.total_pct_serapan;
        out.byDayOfWeek[day].count++;
        if (r.total_status === 'Terserap') out.byDayOfWeek[day].ok++;
      }
    });
    Object.keys(out.byDayOfWeek).forEach(d => {
      const o = out.byDayOfWeek[d];
      o.avg = o.count > 0 ? o.sum / o.count : null;
    });

    // ---- topMenus (gabungan semua item; menu yang muncul ≥2 kali) ----
    const menuStats = {}; // key = nama menu lowercase, value = {label, sum, count, ok}
    enriched.forEach(r => {
      if (r.total_pct_serapan === null) return;
      S.ITEMS.forEach(it => {
        const m = (r['menu_' + it.key] || '').trim();
        if (!m) return;
        const key = it.key + '|' + m.toLowerCase();
        if (!menuStats[key]) menuStats[key] = {
          item: it.label, menu: m, sum: 0, count: 0, ok: 0
        };
        const pct = r[it.key + '_pct_serapan'];
        if (pct !== null) {
          menuStats[key].sum += pct;
          menuStats[key].count++;
          if (pct >= ambang) menuStats[key].ok++;
        }
      });
    });
    const menuList = Object.values(menuStats).map(m => ({
      ...m, avg: m.count > 0 ? m.sum / m.count : 0
    })).filter(m => m.count >= 2);
    menuList.sort((a, b) => b.avg - a.avg);
    out.topMenusHigh = menuList.slice(0, 5);
    out.topMenusLow = menuList.slice(-5).reverse();

    // ---- byWeather ----
    enriched.forEach(r => {
      if (!r.cuaca || r.total_pct_serapan === null) return;
      const w = r.cuaca;
      if (!out.byWeather[w]) out.byWeather[w] = { sum: 0, count: 0 };
      out.byWeather[w].sum += r.total_pct_serapan;
      out.byWeather[w].count++;
    });
    Object.keys(out.byWeather).forEach(w => {
      const o = out.byWeather[w];
      o.avg = o.count > 0 ? o.sum / o.count : null;
      o.label = (S.WEATHER.find(x => x.key === w) || {}).label || w;
      o.icon = (S.WEATHER.find(x => x.key === w) || {}).icon || '';
    });

    // ---- bySasaran ----
    enriched.forEach(r => {
      if (!r.sasaran || r.total_pct_serapan === null) return;
      const sasaranList = Array.isArray(r.sasaran) ? r.sasaran : [r.sasaran];
      sasaranList.forEach(s => {
        if (!s) return;
        if (!out.bySasaran[s]) out.bySasaran[s] = { sum: 0, count: 0 };
        out.bySasaran[s].sum += r.total_pct_serapan;
        out.bySasaran[s].count++;
      });
    });
    Object.keys(out.bySasaran).forEach(s => {
      const o = out.bySasaran[s];
      o.avg = o.count > 0 ? o.sum / o.count : null;
      o.label = (S.SASARAN.find(x => x.key === s) || {}).label || s;
    });

    // ---- heatmap (per tanggal) ----
    out.heatmap = enriched.map(r => ({
      tanggal: r.tanggal,
      hari: r.hari,
      serapan: r.total_pct_serapan,
      status: r.total_status,
      pemakaian: r.total_p,
      sampah: r.total_s
    })).filter(h => h.tanggal);

    // ---- perItemAvg ----
    S.ITEMS.forEach(it => {
      const vals = enriched
        .map(r => r[it.key + '_pct_serapan'])
        .filter(v => v !== null);
      out.perItemAvg[it.key] = {
        label: it.label,
        color: it.color,
        avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
        count: vals.length
      };
    });

    // ---- alasanFreq ----
    enriched.forEach(r => {
      const a = (r.alasan_sampah || '').trim();
      if (!a) return;
      out.alasanFreq[a] = (out.alasanFreq[a] || 0) + 1;
    });

    // ---- orgVsAnorg ----
    let totalOrg = 0, totalAnorg = 0, hasSub = false;
    enriched.forEach(r => {
      if (r.total_org !== null) { totalOrg += r.total_org; hasSub = true; }
      if (r.total_anorg !== null) { totalAnorg += r.total_anorg; hasSub = true; }
    });
    out.orgVsAnorg = { org: totalOrg, anorg: totalAnorg, hasSub };

    return out;
  };

  function simplifyDay(r) {
    return {
      tanggal: r.tanggal,
      hari: r.hari,
      serapan: r.total_pct_serapan,
      status: r.total_status,
      pemakaian: r.total_p,
      sampah: r.total_s,
      menu_nasi: r.menu_nasi,
      menu_hewani: r.menu_hewani,
      menu_sayur: r.menu_sayur,
      menu_nabati: r.menu_nabati,
      menu_buah: r.menu_buah
    };
  }

  // ---------- Sample data generator (extended dengan field baru) ----------
  S.loadSample = function (days) {
    days = days || 1;
    const today = new Date();
    const rows = S.getAll();
    const menus = [
      { nasi:'Nasi Putih', hewani:'Telur Balado',   sayur:'Sayur Tumis',     nabati:'Tempe Goreng',   buah:'Pisang' },
      { nasi:'Nasi Putih', hewani:'Ayam Bakar',     sayur:'Sop Sayur',       nabati:'Tahu Bacem',     buah:'Jeruk' },
      { nasi:'Nasi Putih', hewani:'Ikan Goreng',    sayur:'Cap Cay',         nabati:'Tempe Mendoan',  buah:'Apel' },
      { nasi:'Nasi Kuning',hewani:'Daging Sapi',    sayur:'Bayam Bening',    nabati:'Tahu Goreng',    buah:'Semangka' },
      { nasi:'Nasi Putih', hewani:'Ayam Goreng',    sayur:'Sayur Asem',      nabati:'Tahu Isi',       buah:'Pepaya' },
      { nasi:'Nasi Putih', hewani:'Ikan Bakar',     sayur:'Tumis Buncis',    nabati:'Tempe Bacem',    buah:'Melon' },
      { nasi:'Nasi Putih', hewani:'Rendang',        sayur:'Sayur Lodeh',     nabati:'Tahu Sutera',    buah:'Mangga' }
    ];
    const cuacaList = ['cerah', 'cerah', 'berawan', 'mendung', 'hujan'];
    const sasaranList = ['sd', 'smp', 'sd', 'paud'];
    const round1 = (n) => Math.round(n * 10) / 10;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const idx = (days - 1 - i) % menus.length;
      const m = menus[idx];
      const tanggal = d.toISOString().slice(0, 10);
      const target = 3500 + Math.round(Math.random() * 200);
      const porsi = target - Math.round(Math.random() * 150);
      const hadir = porsi - Math.round(Math.random() * 80);

      const factor = 0.08 + Math.random() * 0.10;

      const rec = {
        tanggal, hari: U.dayName(tanggal),
        target_porsi: target, porsi, hadir,
        cuaca: cuacaList[Math.floor(Math.random() * cuacaList.length)],
        sasaran: [sasaranList[Math.floor(Math.random() * sasaranList.length)]],
        menu_nasi: m.nasi, menu_hewani: m.hewani, menu_sayur: m.sayur, menu_nabati: m.nabati, menu_buah: m.buah,
        nasi_p:   round1(210 + Math.random() * 30),
        hewani_p: round1(150 + Math.random() * 20),
        sayur_p:  round1(200 + Math.random() * 30),
        nabati_p: round1(95  + Math.random() * 15),
        buah_p:   round1(130 + Math.random() * 20)
      };

      // Generate sub-sampah (organik dominan ~80%)
      ['nasi', 'hewani', 'sayur', 'nabati', 'buah'].forEach(k => {
        const totalS = Math.max(0, round1(rec[k + '_p'] * (factor + (Math.random() - 0.5) * 0.04)));
        rec[k + '_s'] = totalS;
        rec[k + '_org'] = round1(totalS * (0.75 + Math.random() * 0.15));
        rec[k + '_anorg'] = round1(Math.max(0, totalS - rec[k + '_org']));
      });

      // Tambah alasan sampah random
      const alasanList = [
        'Porsi terlalu banyak',
        'Anak tidak suka menu',
        'Cuaca panas, anak kurang nafsu',
        'Distribusi terlambat',
        'Menu kurang variasi'
      ];
      if (Math.random() < 0.4) rec.alasan_sampah = alasanList[Math.floor(Math.random() * alasanList.length)];

      rec.id = U.uuid();
      rec.createdAt = Date.now();
      rows.push(rec);
    }
    S.saveAll(rows);
    return days;
  };

  S.autoSeedIfEmpty = function () {
    let already;
    try { already = localStorage.getItem(U.K.SEED); } catch (e) { already = null; }
    if (already) return false;
    if (S.getAll().length > 0) {
      try { localStorage.setItem(U.K.SEED, '1'); } catch (e) {}
      return false;
    }
    S.loadSample(1);
    try { localStorage.setItem(U.K.SEED, '1'); } catch (e) {}
    return true;
  };

  S.forceSeedOne = function () {
    S.loadSample(1);
    try { localStorage.setItem(U.K.SEED, '1'); } catch (e) {}
    return true;
  };

  // ---------- Filter helpers ----------
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

  S.getDateRange = function () {
    const rows = S.getAll();
    if (!rows.length) return { min: null, max: null };
    const dates = rows.map(r => r.tanggal).filter(Boolean).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  };
})();
