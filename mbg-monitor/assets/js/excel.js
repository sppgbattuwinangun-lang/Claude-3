/* =========================================================
   Excel — Import / Export menggunakan SheetJS (window.XLSX)
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const X = (NS.excel = {});

  // Pemetaan header Excel -> field internal
  // Kunci dinormalkan: lowercase + tanpa karakter selain a-z0-9
  const HEADER_MAP = {
    'no': 'no',
    'tanggal': 'tanggal',
    'hari': 'hari',
    'menunasi': 'menu_nasi',
    'menuproteinhewani': 'menu_hewani',
    'menusayur': 'menu_sayur',
    'menuproteinnabati': 'menu_nabati',
    'menubuah': 'menu_buah',
    'jumlahporsi': 'porsi',
    'pemakaiannasikg': 'nasi_p',
    'sampahnasikg': 'nasi_s',
    'sampahnasi': 'nasi_pct_sampah',
    'serapannasi': 'nasi_pct_serapan',
    'statusnasi': 'nasi_status',

    'pemakaianproteinhewanikg': 'hewani_p',
    'sampahproteinhewanikg': 'hewani_s',
    'sampahproteinhewani': 'hewani_pct_sampah',
    'serapanproteinhewani': 'hewani_pct_serapan',
    'statusproteinhewani': 'hewani_status',

    'pemakaiansayurkg': 'sayur_p',
    'sampahsayurkg': 'sayur_s',
    'sampahsayur': 'sayur_pct_sampah',
    'serapansayur': 'sayur_pct_serapan',
    'statussayur': 'sayur_status',

    'pemakaianproteinnabatikg': 'nabati_p',
    'sampahproteinnabatikg': 'nabati_s',
    'sampahproteinnabati': 'nabati_pct_sampah',
    'serapanproteinnabati': 'nabati_pct_serapan',
    'statusproteinnabati': 'nabati_status',

    'pemakaianbuahkg': 'buah_p',
    'sampahbuahkg': 'buah_s',
    'sampahbuah': 'buah_pct_sampah',
    'serapanbuah': 'buah_pct_serapan',
    'statusbuah': 'buah_status',

    'totalpemakaiankg': 'total_p',
    'totalsampahkg': 'total_s',
    'sampahtotal': 'total_pct_sampah',
    'serapantotal': 'total_pct_serapan',
    'statustotal': 'total_status'
  };
  function normalize(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  X.importFile = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const wb = XLSX.read(data, { type: 'array' });
          // Cari sheet "Input Harian", fallback sheet pertama
          let sheetName = wb.SheetNames.find(n => /input/i.test(n) && /harian/i.test(n));
          if (!sheetName) sheetName = wb.SheetNames[0];
          const sh = wb.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });
          const rows = parseSheetAOA(aoa);
          resolve({ count: rows.length, rows, sheetName });
        } catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  function parseSheetAOA(aoa) {
    if (!aoa || !aoa.length) return [];
    // Cari baris header: cari baris yang mengandung "Tanggal" dan "Jumlah Porsi"
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 25); i++) {
      const row = (aoa[i] || []).map(c => String(c || '').toLowerCase());
      if (row.some(c => c.includes('tanggal')) && row.some(c => c.includes('jumlah') && c.includes('porsi'))) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx < 0) {
      // fallback: row 0 sebagai header
      headerRowIdx = 0;
    }
    const headers = (aoa[headerRowIdx] || []).map(normalize);
    const fieldByCol = headers.map(h => HEADER_MAP[h] || null);

    const out = [];
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] || [];
      // skip empty
      if (row.every(c => c === null || c === undefined || c === '')) continue;
      const rec = { id: U.uuid(), createdAt: Date.now() };
      for (let c = 0; c < row.length; c++) {
        const f = fieldByCol[c]; if (!f) continue;
        let v = row[c];
        if (v === null || v === undefined || v === '') continue;
        if (f === 'tanggal') {
          if (typeof v === 'number') {
            const d = U.excelToDate(v);
            if (d) v = d.toISOString().slice(0,10);
          } else {
            const d = parseDate(String(v));
            if (d) v = d;
          }
        } else if (f === 'porsi' || f.endsWith('_p') || f.endsWith('_s') || f === 'total_p' || f === 'total_s') {
          v = Number(v);
          if (isNaN(v)) v = null;
        } else if (f.startsWith('menu_') || f === 'hari' || f.endsWith('_status')) {
          v = String(v).trim();
        } else if (f.endsWith('_pct_sampah') || f.endsWith('_pct_serapan')) {
          v = Number(v);
          if (isNaN(v)) v = null;
        }
        rec[f] = v;
      }
      // require minimal: tanggal atau menu/porsi
      if (!rec.tanggal && !rec.porsi && !rec.menu_nasi) continue;
      if (rec.tanggal && !rec.hari) rec.hari = U.dayName(rec.tanggal);
      out.push(rec);
    }
    return out;
  }

  function parseDate(s) {
    s = s.trim();
    // ISO yyyy-mm-dd
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    // dd/mm/yyyy or dd-mm-yyyy
    m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // dd/mm/yy
    m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/.exec(s);
    if (m) return `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return null;
  }

  X.exportXlsx = function (rows, settings) {
    settings = settings || S.getSettings();
    const data = rows.map((r, i) => {
      const c = S.compute(r, settings);
      return {
        'No': i + 1,
        'Tanggal': c.tanggal || '',
        'Hari': c.hari || '',
        'Menu Nasi': c.menu_nasi || '',
        'Menu Protein Hewani': c.menu_hewani || '',
        'Menu Sayur': c.menu_sayur || '',
        'Menu Protein Nabati': c.menu_nabati || '',
        'Menu Buah': c.menu_buah || '',
        'Jumlah Porsi': c.porsi ?? '',
        'Pemakaian Nasi (kg)': c.nasi_p ?? '',
        'Sampah Nasi (kg)': c.nasi_s ?? '',
        '% Sampah Nasi': c.nasi_pct_sampah ?? '',
        '% Serapan Nasi': c.nasi_pct_serapan ?? '',
        'Status Nasi': c.nasi_status || '',
        'Pemakaian Protein Hewani (kg)': c.hewani_p ?? '',
        'Sampah Protein Hewani (kg)': c.hewani_s ?? '',
        '% Sampah Protein Hewani': c.hewani_pct_sampah ?? '',
        '% Serapan Protein Hewani': c.hewani_pct_serapan ?? '',
        'Status Protein Hewani': c.hewani_status || '',
        'Pemakaian Sayur (kg)': c.sayur_p ?? '',
        'Sampah Sayur (kg)': c.sayur_s ?? '',
        '% Sampah Sayur': c.sayur_pct_sampah ?? '',
        '% Serapan Sayur': c.sayur_pct_serapan ?? '',
        'Status Sayur': c.sayur_status || '',
        'Pemakaian Protein Nabati (kg)': c.nabati_p ?? '',
        'Sampah Protein Nabati (kg)': c.nabati_s ?? '',
        '% Sampah Protein Nabati': c.nabati_pct_sampah ?? '',
        '% Serapan Protein Nabati': c.nabati_pct_serapan ?? '',
        'Status Protein Nabati': c.nabati_status || '',
        'Pemakaian Buah (kg)': c.buah_p ?? '',
        'Sampah Buah (kg)': c.buah_s ?? '',
        '% Sampah Buah': c.buah_pct_sampah ?? '',
        '% Serapan Buah': c.buah_pct_serapan ?? '',
        'Status Buah': c.buah_status || '',
        'Total Pemakaian (kg)': c.total_p ?? '',
        'Total Sampah (kg)': c.total_s ?? '',
        '% Sampah Total': c.total_pct_sampah ?? '',
        '% Serapan Total': c.total_pct_serapan ?? '',
        'Status Total': c.total_status || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    // lebar kolom kira-kira
    ws['!cols'] = Object.keys(data[0] || {'a':1}).map(k => ({ wch: Math.min(30, Math.max(10, k.length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Input Harian');

    // Sheet Dashboard
    const agg = S.aggregate(rows, settings);
    const dash = [
      ['DASHBOARD ANALISIS SAMPAH MBG'],
      [],
      ['Hari Tercatat', agg.total.days],
      ['Total Pemakaian Keseluruhan (kg)', round(agg.total.p, 2)],
      ['Total Sampah Keseluruhan (kg)', round(agg.total.s, 2)],
      ['% Serapan Keseluruhan', agg.total.pctSerapan ?? ''],
      ['Hari Status Terserap', agg.total.daysOk],
      [],
      ['Item', 'Pemakaian (kg)', 'Sampah (kg)', '% Sampah', '% Serapan', 'Ambang Terserap', 'Maks. Sampah', 'Status Akhir']
    ];
    S.ITEMS.forEach(it => {
      const a = agg.perItem[it.key];
      dash.push([
        it.label, round(a.p,2), round(a.s,2),
        a.pctSampah ?? '', a.pctSerapan ?? '',
        settings.ambangSerapan, 1 - settings.ambangSerapan,
        a.status
      ]);
    });
    dash.push([
      'TOTAL KESELURUHAN', round(agg.total.p,2), round(agg.total.s,2),
      agg.total.pctSampah ?? '', agg.total.pctSerapan ?? '',
      settings.ambangSerapan, 1 - settings.ambangSerapan,
      agg.total.status
    ]);
    const dws = XLSX.utils.aoa_to_sheet(dash);
    XLSX.utils.book_append_sheet(wb, dws, 'Dashboard');

    // Sheet Panduan
    const pdn = [
      ['PANDUAN & PARAMETER ANALISIS SAMPAH MBG'],
      [],
      ['Parameter Penilaian', 'Nilai'],
      ['Ambang minimal serapan agar status = Terserap', settings.ambangSerapan],
      ['Ambang maksimal sampah terhadap pemakaian', 1 - settings.ambangSerapan],
      ['Satuan input', 'kilogram (kg)'],
      ['Keterangan status', 'Terserap jika % Serapan >= ambang serapan']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pdn), 'Panduan');

    const fname = 'monitoring_sampah_MBG_' + new Date().toISOString().slice(0,10) + '.xlsx';
    XLSX.writeFile(wb, fname);
  };

  X.exportCsv = function (rows, settings) {
    const data = rows.map((r, i) => S.compute(r, settings));
    const headers = ['No','Tanggal','Hari','Menu Nasi','Menu Protein Hewani','Menu Sayur','Menu Protein Nabati','Menu Buah','Jumlah Porsi',
      'Pemakaian Nasi (kg)','Sampah Nasi (kg)','% Sampah Nasi','% Serapan Nasi','Status Nasi',
      'Pemakaian Protein Hewani (kg)','Sampah Protein Hewani (kg)','% Sampah Protein Hewani','% Serapan Protein Hewani','Status Protein Hewani',
      'Pemakaian Sayur (kg)','Sampah Sayur (kg)','% Sampah Sayur','% Serapan Sayur','Status Sayur',
      'Pemakaian Protein Nabati (kg)','Sampah Protein Nabati (kg)','% Sampah Protein Nabati','% Serapan Protein Nabati','Status Protein Nabati',
      'Pemakaian Buah (kg)','Sampah Buah (kg)','% Sampah Buah','% Serapan Buah','Status Buah',
      'Total Pemakaian (kg)','Total Sampah (kg)','% Sampah Total','% Serapan Total','Status Total'];
    const fields = ['no','tanggal','hari','menu_nasi','menu_hewani','menu_sayur','menu_nabati','menu_buah','porsi',
      'nasi_p','nasi_s','nasi_pct_sampah','nasi_pct_serapan','nasi_status',
      'hewani_p','hewani_s','hewani_pct_sampah','hewani_pct_serapan','hewani_status',
      'sayur_p','sayur_s','sayur_pct_sampah','sayur_pct_serapan','sayur_status',
      'nabati_p','nabati_s','nabati_pct_sampah','nabati_pct_serapan','nabati_status',
      'buah_p','buah_s','buah_pct_sampah','buah_pct_serapan','buah_status',
      'total_p','total_s','total_pct_sampah','total_pct_serapan','total_status'];
    const out = [headers.join(',')];
    data.forEach((c, i) => {
      const row = fields.map((f, idx) => {
        let v = idx === 0 ? (i+1) : c[f];
        if (v === null || v === undefined) v = '';
        if (typeof v === 'string' && /[",;\n]/.test(v)) v = '"' + v.replace(/"/g,'""') + '"';
        return v;
      });
      out.push(row.join(','));
    });
    const blob = new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8;' });
    download(blob, 'monitoring_sampah_MBG_' + U.todayISO() + '.csv');
  };

  X.exportJson = function (rows) {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    download(blob, 'monitoring_sampah_MBG_' + U.todayISO() + '.json');
  };

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function round(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '';
    const f = Math.pow(10, d || 0);
    return Math.round(n * f) / f;
  }
})();
