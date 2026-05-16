/* =========================================================
   PDF Report — Generate laporan PDF dengan filter rentang waktu
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const P = (NS.pdf = {});

  let previewTrend = null, previewDonut = null, previewBars = null;
  let currentRange = { from: null, to: null };

  P.init = function () {
    if (!document.getElementById('rFrom')) {
      // Halaman laporan tidak ada — skip
      return;
    }
    bindRangeBar();
    bindReportActions();
    setQuickRange('30');
    P.renderPreview();
  };

  // ---------- Range Bar ----------
  function bindRangeBar() {
    const fromEl = document.getElementById('rFrom');
    const toEl   = document.getElementById('rTo');
    if (fromEl) fromEl.addEventListener('change', () => { currentRange.from = fromEl.value; clearActiveQuick(); P.renderPreview(); });
    if (toEl)   toEl.addEventListener('change',   () => { currentRange.to   = toEl.value;   clearActiveQuick(); P.renderPreview(); });

    document.querySelectorAll('.q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setQuickRange(btn.dataset.range);
        P.renderPreview();
      });
    });
  }

  function clearActiveQuick() {
    document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
  }

  function setQuickRange(range) {
    const today = new Date();
    const toISO = isoOf(today);
    let fromISO = null;
    if (range === 'all') {
      const all = S.getAll();
      if (all.length) {
        const sorted = all.map(r => r.tanggal).filter(Boolean).sort();
        fromISO = sorted[0];
      } else {
        fromISO = toISO;
      }
    } else if (range === 'month') {
      fromISO = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-01';
    } else if (range === 'lastmonth') {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lme = new Date(today.getFullYear(), today.getMonth(), 0);
      currentRange.from = isoOf(lm);
      currentRange.to   = isoOf(lme);
      const f = document.getElementById('rFrom'); if (f) f.value = currentRange.from;
      const t = document.getElementById('rTo');   if (t) t.value = currentRange.to;
      document.querySelectorAll('.q-btn').forEach(b => b.classList.toggle('active', b.dataset.range === 'lastmonth'));
      return;
    } else if (range === 'custom') {
      return;
    } else {
      const days = parseInt(range, 10) || 30;
      const from = new Date(today.getTime() - (days - 1) * 86400000);
      fromISO = isoOf(from);
    }
    currentRange.from = fromISO;
    currentRange.to   = toISO;
    const f = document.getElementById('rFrom'); if (f) f.value = fromISO;
    const t = document.getElementById('rTo');   if (t) t.value = toISO;
    document.querySelectorAll('.q-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
  }

  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function filteredRows() {
    const all = S.getAll().slice().sort((a,b) => String(a.tanggal||'').localeCompare(String(b.tanggal||'')));
    const f = currentRange.from, t = currentRange.to;
    return all.filter(r => {
      const d = String(r.tanggal || '');
      if (!d) return false;
      if (f && d < f) return false;
      if (t && d > t) return false;
      return true;
    });
  }

  // ---------- Preview ----------
  P.renderPreview = function () {
    if (!document.getElementById('rFrom')) return;
    const rows = filteredRows();
    const settings = S.getSettings();
    const agg = S.aggregate(rows, settings);

    const cEl = document.getElementById('rCount');
    if (cEl) cEl.textContent = rows.length + ' baris terpilih';

    setVal('rkDays',  rows.length, 0);
    setVal('rkUse',   agg.total.p || 0, 1, ' kg');
    setVal('rkWaste', agg.total.s || 0, 1, ' kg');
    const sEl = document.getElementById('rkAbsorb');
    if (sEl) sEl.textContent = agg.total.pctSerapan !== null ? U.pct(agg.total.pctSerapan, 1) : '—';

    const summaryEl = document.getElementById('reportItemSummary');
    if (summaryEl) {
      summaryEl.innerHTML = '';
      S.ITEMS.forEach(it => {
        const a = agg.perItem[it.key];
        const status = a.status === 'Terserap' ? '<span class="badge b-ok">Terserap</span>' :
                       a.status === '—' ? '<span class="badge">—</span>' :
                       '<span class="badge b-warn">Perlu Evaluasi</span>';
        const pct = a.pctSerapan !== null ? Math.max(0, Math.min(1, a.pctSerapan)) : 0;
        summaryEl.insertAdjacentHTML('beforeend', `
          <div class="item-card t-${it.key}">
            <div class="head">
              <div class="swatch">${it.label[0]}</div>
              <div style="flex:1">
                <div class="name">${it.label}</div>
                <div class="meta">${a.days} hari tercatat</div>
              </div>
              ${status}
            </div>
            <div class="row"><span class="muted">Pemakaian</span><span class="num">${U.fmt(a.p, {maximumFractionDigits:1})} kg</span></div>
            <div class="row"><span class="muted">Sampah</span><span class="num" style="color:var(--c-danger)">${U.fmt(a.s, {maximumFractionDigits:1})} kg</span></div>
            <div class="row"><span class="muted">% Serapan</span><span><b>${a.pctSerapan!==null ? U.pct(a.pctSerapan) : '—'}</b></span></div>
            <div class="progress"><span style="width:${pct*100}%;background:linear-gradient(90deg, ${it.color}, ${it.color}aa);"></span></div>
          </div>
        `);
      });
    }
    renderPreviewCharts(rows, agg, settings);
  };

  function setVal(id, value, decimals, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    if (NS.effects && NS.effects.countTo) {
      NS.effects.countTo(el, value, { decimals, suffix: suffix || '' });
    } else {
      el.textContent = U.fmt(value, { maximumFractionDigits: decimals });
      if (suffix) el.textContent += suffix;
    }
  }

  function chartTextColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155';
  }
  function chartGridColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)';
  }

  function renderPreviewCharts(rows, agg, settings) {
    if (typeof Chart === 'undefined') return;
    const labels = rows.map(r => U.fmtDate(r.tanggal));
    const usage  = rows.map(r => S.compute(r, settings).total_p ?? 0);
    const waste  = rows.map(r => S.compute(r, settings).total_s ?? 0);

    const tcv = document.getElementById('reportTrend');
    if (tcv) {
      try { if (previewTrend) previewTrend.destroy(); } catch (e) {}
      previewTrend = new Chart(tcv.getContext('2d'), {
        data: {
          labels,
          datasets: [
            { type: 'line', label: 'Pemakaian (kg)', data: usage,
              borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.15)',
              tension: .35, fill: true, pointRadius: 3 },
            { type: 'bar', label: 'Sampah (kg)', data: waste,
              backgroundColor: 'rgba(236,72,153,.7)', borderColor: '#ec4899', borderWidth: 1, borderRadius: 6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom', labels: { color: chartTextColor() } } },
          scales: {
            x: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
            y: { beginAtZero: true, ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } }
          }
        }
      });
    }
    const dcv = document.getElementById('reportDonut');
    if (dcv) {
      try { if (previewDonut) previewDonut.destroy(); } catch (e) {}
      previewDonut = new Chart(dcv.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: S.ITEMS.map(i => i.label),
          datasets: [{ data: S.ITEMS.map(i => agg.perItem[i.key].s), backgroundColor: S.ITEMS.map(i => i.color), borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { legend: { position: 'bottom', labels: { color: chartTextColor() } } }
        }
      });
    }
    const bcv = document.getElementById('reportBars');
    if (bcv) {
      try { if (previewBars) previewBars.destroy(); } catch (e) {}
      previewBars = new Chart(bcv.getContext('2d'), {
        type: 'bar',
        data: {
          labels: S.ITEMS.map(i => i.label),
          datasets: [
            { label: 'Pemakaian (kg)', data: S.ITEMS.map(i => agg.perItem[i.key].p), backgroundColor: 'rgba(99,102,241,.7)', borderRadius: 6 },
            { label: 'Sampah (kg)',    data: S.ITEMS.map(i => agg.perItem[i.key].s), backgroundColor: 'rgba(236,72,153,.7)', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: chartTextColor() } } },
          scales: {
            x: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
            y: { beginAtZero: true, ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } }
          }
        }
      });
    }
  }

  // ---------- Generate offscreen chart image for PDF ----------
  function renderChartToImage(config, width, height) {
    return new Promise(resolve => {
      const cv = document.createElement('canvas');
      cv.width = width;
      cv.height = height;
      const bgPlugin = {
        id: 'whitebg',
        beforeDraw: (chart) => {
          const ctx = chart.canvas.getContext('2d');
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      };
      const darkText = '#1f2937';
      const lightGrid = 'rgba(15,23,42,.1)';
      function patchColors(cfg) {
        cfg.options = cfg.options || {};
        cfg.options.responsive = false;
        cfg.options.animation = false;
        cfg.options.maintainAspectRatio = false;
        cfg.options.plugins = cfg.options.plugins || {};
        cfg.options.plugins.legend = cfg.options.plugins.legend || {};
        cfg.options.plugins.legend.labels = Object.assign({}, cfg.options.plugins.legend.labels, { color: darkText, font: { size: 11 } });
        cfg.options.scales = cfg.options.scales || {};
        if (cfg.options.scales.x) {
          cfg.options.scales.x.ticks = Object.assign({}, cfg.options.scales.x.ticks, { color: darkText });
          cfg.options.scales.x.grid  = Object.assign({}, cfg.options.scales.x.grid,  { color: lightGrid });
        }
        if (cfg.options.scales.y) {
          cfg.options.scales.y.ticks = Object.assign({}, cfg.options.scales.y.ticks, { color: darkText });
          cfg.options.scales.y.grid  = Object.assign({}, cfg.options.scales.y.grid,  { color: lightGrid });
        }
        return cfg;
      }
      const finalCfg = patchColors(config);
      finalCfg.plugins = [bgPlugin];
      const chart = new Chart(cv.getContext('2d'), finalCfg);
      requestAnimationFrame(() => {
        const url = cv.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve({ url, width, height });
      });
    });
  }

  function bindReportActions() {
    const gen = document.getElementById('btnGenPdf');
    if (gen) gen.addEventListener('click', () => {
      P.generate().catch(err => {
        console.error(err);
        U.toast('Gagal membuat PDF: ' + err.message, 'error');
      });
    });
    const pr = document.getElementById('btnPrintReport');
    if (pr) pr.addEventListener('click', () => window.print());
  }

  // ---------- Generate PDF ----------
  P.generate = async function () {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      U.toast('Library PDF belum termuat. Cek koneksi internet & refresh.', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    if (typeof Chart === 'undefined') {
      U.toast('Library Chart belum termuat. Cek koneksi internet & refresh.', 'error');
      return;
    }

    const rows = filteredRows();
    if (!rows.length) {
      U.toast('Tidak ada data pada rentang yang dipilih', 'warn');
      return;
    }
    const settings = S.getSettings();
    const agg = S.aggregate(rows, settings);

    U.toast('Menyiapkan laporan PDF…', 'info');

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'p' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;

    drawCover(doc, pageW, pageH, rows, agg, settings);

    doc.addPage();
    let y = drawHeader(doc, pageW, margin, 'Ringkasan Eksekutif');
    y = drawKpiBlock(doc, pageW, margin, y, rows, agg, settings);
    y = drawItemSummary(doc, pageW, margin, y, agg, settings);

    doc.addPage();
    y = drawHeader(doc, pageW, margin, 'Grafik Analisis');
    y = await drawCharts(doc, pageW, pageH, margin, y, rows, agg, settings);

    doc.addPage();
    drawHeader(doc, pageW, margin, 'Tabel Detail Harian');
    drawDetailTable(doc, pageW, margin, rows, settings);

    drawFooter(doc, pageW, pageH);

    const stamp = (currentRange.from || 'awal') + '_sd_' + (currentRange.to || 'akhir');
    doc.save('Laporan_MBG_' + stamp + '.pdf');
    U.toast('PDF berhasil dibuat', 'success');
  };

  // ---------- Cover Page ----------
  function drawCover(doc, pageW, pageH, rows, agg, settings) {
    drawGradientRect(doc, 0, 0, pageW, pageH, [99, 102, 241], [236, 72, 153]);

    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.circle(pageW - 80, 100, 130, 'F');
    doc.circle(60, pageH - 120, 90, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.15 }));
    doc.roundedRect(pageW/2 - 36, 130, 72, 72, 14, 14, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(38);
    doc.text('M', pageW/2, 182, { align: 'center' });

    doc.setFontSize(28);
    doc.text('LAPORAN MONITORING', pageW/2, 250, { align: 'center' });
    doc.setFontSize(20);
    doc.text('Sampah Pasca Distribusi MBG', pageW/2, 280, { align: 'center' });

    doc.setDrawColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.4 }));
    doc.setLineWidth(1);
    doc.line(pageW/2 - 80, 300, pageW/2 + 80, 300);
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Periode Pelaporan', pageW/2, 330, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const periode = U.fmtDate(currentRange.from) + '  s.d.  ' + U.fmtDate(currentRange.to);
    doc.text(periode, pageW/2, 354, { align: 'center' });

    const cardY = 400;
    const cardW = pageW - 120;
    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.95 }));
    doc.roundedRect(60, cardY, cardW, 180, 16, 16, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setTextColor(50, 50, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RINGKASAN', 80, cardY + 28);

    const bx = 80, by = cardY + 50;
    const cw = (cardW - 40) / 2;
    drawCoverStat(doc, bx,        by,      cw, 'Total Hari Tercatat', String(agg.total.days), '');
    drawCoverStat(doc, bx + cw,   by,      cw, 'Total Pemakaian',     U.fmt(agg.total.p, {maximumFractionDigits:1}), 'kg');
    drawCoverStat(doc, bx,        by + 60, cw, 'Total Sampah',        U.fmt(agg.total.s, {maximumFractionDigits:1}), 'kg');
    const pctText = agg.total.pctSerapan !== null ? (agg.total.pctSerapan * 100).toFixed(1) + '%' : '—';
    drawCoverStat(doc, bx + cw,   by + 60, cw, '% Serapan Total',     pctText, '');

    const isOk = agg.total.status === 'Terserap';
    doc.setFillColor(isOk ? 16 : 245, isOk ? 185 : 158, isOk ? 129 : 11);
    doc.roundedRect(pageW/2 - 70, cardY + 200, 140, 28, 14, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((agg.total.status || '—').toUpperCase(), pageW/2, cardY + 218, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(settings.organisasi || 'SPPG Battu Winangun', pageW/2, pageH - 80, { align: 'center' });
    doc.setFontSize(9);
    doc.setGState(new doc.GState({ opacity: 0.85 }));
    doc.text('Dibuat ' + new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }), pageW/2, pageH - 60, { align: 'center' });
    doc.setGState(new doc.GState({ opacity: 1 }));
  }

  function drawCoverStat(doc, x, y, w, label, value, unit) {
    doc.setTextColor(120, 120, 130);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(value, x, y + 26);
    if (unit) {
      const valW = doc.getTextWidth(value);
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 130);
      doc.text(' ' + unit, x + valW + 2, y + 26);
    }
  }

  function drawHeader(doc, pageW, margin, sectionTitle) {
    drawGradientRect(doc, 0, 0, pageW, 50, [99, 102, 241], [236, 72, 153]);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MBG Monitor', margin, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setGState(new doc.GState({ opacity: 0.85 }));
    doc.text('Laporan · ' + U.fmtDate(currentRange.from) + ' – ' + U.fmtDate(currentRange.to),
             pageW - margin, 30, { align: 'right' });
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(sectionTitle, margin, 90);
    doc.setDrawColor(168, 139, 250);
    doc.setLineWidth(2);
    doc.line(margin, 96, margin + 50, 96);
    return 120;
  }

  function drawFooter(doc, pageW, pageH) {
    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.5);
      doc.line(36, pageH - 36, pageW - 36, pageH - 36);
      doc.setTextColor(150, 150, 160);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Dibuat oleh MBG Monitor · ' + new Date().toLocaleDateString('id-ID'), 36, pageH - 22);
      doc.text('Halaman ' + i + ' dari ' + total, pageW - 36, pageH - 22, { align: 'right' });
    }
  }

  function drawKpiBlock(doc, pageW, margin, y, rows, agg, settings) {
    const w = (pageW - margin*2 - 30) / 4;
    const h = 80;
    const items = [
      { label: 'Hari Tercatat',   value: String(agg.total.days), color: [56, 189, 248] },
      { label: 'Total Pemakaian', value: U.fmt(agg.total.p, {maximumFractionDigits:1}) + ' kg', color: [16, 185, 129] },
      { label: 'Total Sampah',    value: U.fmt(agg.total.s, {maximumFractionDigits:1}) + ' kg', color: [245, 158, 11] },
      { label: '% Serapan Total', value: agg.total.pctSerapan !== null ? (agg.total.pctSerapan * 100).toFixed(1) + '%' : '—', color: [236, 72, 153] }
    ];
    items.forEach((it, i) => {
      const x = margin + i * (w + 10);
      doc.setFillColor(248, 249, 252);
      doc.roundedRect(x, y, w, h, 10, 10, 'F');
      doc.setFillColor(it.color[0], it.color[1], it.color[2]);
      doc.roundedRect(x, y, w, 4, 2, 2, 'F');
      doc.setTextColor(110, 110, 130);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(it.label.toUpperCase(), x + 12, y + 22);
      doc.setTextColor(20, 20, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(it.value, x + 12, y + 50);
    });

    const statusY = y + h + 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 100);
    doc.text('Status Akhir Periode:', margin, statusY + 14);
    const isOk = agg.total.status === 'Terserap';
    if (isOk) doc.setFillColor(16, 185, 129); else doc.setFillColor(245, 158, 11);
    doc.roundedRect(margin + 130, statusY, 120, 22, 11, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text((agg.total.status || '—').toUpperCase(), margin + 190, statusY + 15, { align: 'center' });

    doc.setTextColor(120, 120, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Ambang serapan minimum: ' + Math.round(settings.ambangSerapan * 100) + '%', margin + 270, statusY + 14);

    return statusY + 40;
  }

  function drawItemSummary(doc, pageW, margin, y, agg, settings) {
    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ringkasan Per Item', margin, y);
    y += 12;

    const head = [['Item', 'Pemakaian (kg)', 'Sampah (kg)', '% Sampah', '% Serapan', 'Status']];
    const body = S.ITEMS.map(it => {
      const a = agg.perItem[it.key];
      return [
        it.label,
        U.fmt(a.p, {maximumFractionDigits:2}),
        U.fmt(a.s, {maximumFractionDigits:2}),
        a.pctSampah !== null ? (a.pctSampah*100).toFixed(1) + '%' : '—',
        a.pctSerapan !== null ? (a.pctSerapan*100).toFixed(1) + '%' : '—',
        a.status || '—'
      ];
    });
    body.push([
      { content: 'TOTAL KESELURUHAN', styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } },
      { content: U.fmt(agg.total.p, {maximumFractionDigits:2}), styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } },
      { content: U.fmt(agg.total.s, {maximumFractionDigits:2}), styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } },
      { content: agg.total.pctSampah !== null ? (agg.total.pctSampah*100).toFixed(1) + '%' : '—', styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } },
      { content: agg.total.pctSerapan !== null ? (agg.total.pctSerapan*100).toFixed(1) + '%' : '—', styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } },
      { content: agg.total.status || '—', styles: { fontStyle: 'bold', fillColor: [240, 240, 250] } }
    ]);

    doc.autoTable({
      head, body, startY: y + 4,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10, textColor: [40, 40, 60] },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const v = String(data.cell.raw || '').toLowerCase();
          if (v === 'terserap') { data.cell.styles.fillColor = [220, 252, 231]; data.cell.styles.textColor = [22, 101, 52]; data.cell.styles.fontStyle = 'bold'; }
          else if (v.includes('evaluasi')) { data.cell.styles.fillColor = [254, 243, 199]; data.cell.styles.textColor = [146, 64, 14]; data.cell.styles.fontStyle = 'bold'; }
        }
      }
    });

    return doc.lastAutoTable.finalY + 10;
  }

  async function drawCharts(doc, pageW, pageH, margin, y, rows, agg, settings) {
    const labels = rows.map(r => U.fmtDate(r.tanggal));
    const usage  = rows.map(r => S.compute(r, settings).total_p ?? 0);
    const waste  = rows.map(r => S.compute(r, settings).total_s ?? 0);

    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Tren Harian: Pemakaian vs Sampah', margin, y);

    const trendImg = await renderChartToImage({
      data: {
        labels,
        datasets: [
          { type: 'line', label: 'Pemakaian (kg)', data: usage, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.2)', tension: .35, fill: true, pointRadius: 2, borderWidth: 2 },
          { type: 'bar',  label: 'Sampah (kg)',    data: waste, backgroundColor: 'rgba(236,72,153,.7)', borderColor: '#ec4899', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { x: {}, y: { beginAtZero: true } }
      }
    }, 1100, 400);
    const trendW = pageW - margin*2;
    const trendH = trendW * (trendImg.height / trendImg.width);
    doc.addImage(trendImg.url, 'PNG', margin, y + 10, trendW, trendH);
    y = y + 10 + trendH + 16;

    const half = (pageW - margin*2 - 16) / 2;
    doc.setTextColor(30, 30, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Komposisi Sampah', margin, y);
    doc.text('Pemakaian vs Sampah Per Item', margin + half + 16, y);

    const donutImg = await renderChartToImage({
      type: 'doughnut',
      data: { labels: S.ITEMS.map(i => i.label), datasets: [{ data: S.ITEMS.map(i => agg.perItem[i.key].s), backgroundColor: S.ITEMS.map(i => i.color), borderWidth: 0 }] },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '55%' }
    }, 600, 500);

    const barImg = await renderChartToImage({
      type: 'bar',
      data: {
        labels: S.ITEMS.map(i => i.label),
        datasets: [
          { label: 'Pemakaian (kg)', data: S.ITEMS.map(i => agg.perItem[i.key].p), backgroundColor: 'rgba(99,102,241,.7)', borderRadius: 4 },
          { label: 'Sampah (kg)',    data: S.ITEMS.map(i => agg.perItem[i.key].s), backgroundColor: 'rgba(236,72,153,.7)', borderRadius: 4 }
        ]
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { x: {}, y: { beginAtZero: true } } }
    }, 700, 500);

    const sideH = half * (donutImg.height / donutImg.width);
    const barH  = half * (barImg.height / barImg.width);
    const useH  = Math.max(sideH, barH);
    doc.addImage(donutImg.url, 'PNG', margin, y + 10, half, sideH);
    doc.addImage(barImg.url,   'PNG', margin + half + 16, y + 10, half, barH);

    return y + 10 + useH + 16;
  }

  function drawDetailTable(doc, pageW, margin, rows, settings) {
    const head = [[
      'No', 'Tanggal', 'Hari', 'Porsi',
      'Nasi P', 'Nasi S',
      'Hewani P', 'Hewani S',
      'Sayur P', 'Sayur S',
      'Nabati P', 'Nabati S',
      'Buah P', 'Buah S',
      'Total P', 'Total S', '% Serap', 'Status'
    ]];
    const body = rows.map((r, i) => {
      const c = S.compute(r, settings);
      return [
        i + 1,
        U.fmtDate(c.tanggal),
        c.hari || '',
        c.porsi != null ? c.porsi : '',
        fmtN(c.nasi_p), fmtN(c.nasi_s),
        fmtN(c.hewani_p), fmtN(c.hewani_s),
        fmtN(c.sayur_p), fmtN(c.sayur_s),
        fmtN(c.nabati_p), fmtN(c.nabati_s),
        fmtN(c.buah_p), fmtN(c.buah_s),
        fmtN(c.total_p), fmtN(c.total_s),
        c.total_pct_serapan != null ? (c.total_pct_serapan*100).toFixed(1) + '%' : '—',
        c.total_status || '—'
      ];
    });

    doc.autoTable({
      head, body, startY: 110,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 50 },
        2: { cellWidth: 38 },
        3: { cellWidth: 30 },
        17: { cellWidth: 50 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 17) {
          const v = String(data.cell.raw || '').toLowerCase();
          if (v === 'terserap') { data.cell.styles.fillColor = [220, 252, 231]; data.cell.styles.textColor = [22, 101, 52]; data.cell.styles.fontStyle = 'bold'; }
          else if (v.includes('evaluasi')) { data.cell.styles.fillColor = [254, 243, 199]; data.cell.styles.textColor = [146, 64, 14]; data.cell.styles.fontStyle = 'bold'; }
        }
      }
    });
  }

  function fmtN(v) {
    if (v === null || v === undefined || v === '') return '';
    return Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  }

  function drawGradientRect(doc, x, y, w, h, c1, c2) {
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      doc.setFillColor(r, g, b);
      doc.rect(x + (w / steps) * i, y, w / steps + 1, h, 'F');
    }
  }
})();
