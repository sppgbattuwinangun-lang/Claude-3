/* =========================================================
   Dashboard rendering — defensive
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const D = (NS.dashboard = {});

  let trendChart = null, donutChart = null;
  let trendRange = 'all';

  D.init = function () {
    document.querySelectorAll('#page-dashboard .tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#page-dashboard .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        trendRange = t.dataset.range;
        D.render();
      });
    });
    on('btnEmptyAdd', () => {
      if (NS.app && NS.app.go) NS.app.go('input');
      const btn = document.getElementById('btnAdd');
      if (btn) btn.click();
    });
    on('btnEmptySample', () => {
      const btn = document.getElementById('btnLoadSample');
      if (btn) btn.click();
      else { S.loadSample(1); U.toast('Data contoh dimuat (1 hari)', 'success'); }
    });
    D.render();
  };

  function on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  D.render = function () {
    if (!document.getElementById('page-dashboard')) return;
    const settings = S.getSettings();
    const rows = S.getAll().slice().sort((a,b) => String(a.tanggal||'').localeCompare(String(b.tanggal||'')));
    const agg = S.aggregate(rows, settings);

    const emptyEl = document.getElementById('emptyHint');
    if (emptyEl) emptyEl.style.display = rows.length === 0 ? 'flex' : 'none';

    const E = NS.effects;
    const setKpi = (id, value, opts) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (E && E.countTo) E.countTo(el, value, opts || {});
      else el.textContent = value;
    };
    setKpi('kpiDays',  agg.total.days, { decimals: 0 });
    setKpi('kpiUse',   agg.total.p || 0, { decimals: 1, suffix: ' kg' });
    setKpi('kpiWaste', agg.total.s || 0, { decimals: 1, suffix: ' kg' });
    const absorbEl = document.getElementById('kpiAbsorb');
    if (absorbEl) {
      if (agg.total.pctSerapan !== null) {
        if (E && E.countTo) E.countTo(absorbEl, agg.total.pctSerapan * 100, { decimals: 1, suffix: '%' });
        else absorbEl.textContent = U.pct(agg.total.pctSerapan, 1);
      } else {
        absorbEl.textContent = '—';
      }
    }
    const sub = document.getElementById('kpiAbsorbStatus');
    if (sub) {
      sub.textContent = agg.total.status === 'Terserap'
        ? `Terserap (≥ ${Math.round(settings.ambangSerapan*100)}%)`
        : (agg.total.status === '—' ? 'Belum ada data' : `Perlu Evaluasi (< ${Math.round(settings.ambangSerapan*100)}%)`);
    }

    const grid = document.getElementById('itemSummaryGrid');
    if (grid) {
      grid.innerHTML = '';
      S.ITEMS.forEach(it => {
        const a = agg.perItem[it.key];
        const pctSerap = a.pctSerapan !== null ? Math.max(0, Math.min(1, a.pctSerapan)) : 0;
        const badge = a.status === 'Terserap' ? '<span class="badge b-ok">Terserap</span>' :
                     (a.status === '—' ? '<span class="badge">—</span>' :
                     '<span class="badge b-warn">Perlu Evaluasi</span>');
        grid.insertAdjacentHTML('beforeend', `
          <div class="item-card t-${it.key}">
            <div class="head">
              <div class="swatch">${it.label[0]}</div>
              <div style="flex:1">
                <div class="name">${it.label}</div>
                <div class="meta">${a.days} hari tercatat</div>
              </div>
              ${badge}
            </div>
            <div class="row"><span class="muted">Pemakaian</span><span class="num">${U.fmt(a.p,{maximumFractionDigits:1})} kg</span></div>
            <div class="row"><span class="muted">Sampah</span><span class="num" style="color:var(--c-danger)">${U.fmt(a.s,{maximumFractionDigits:1})} kg</span></div>
            <div class="row"><span class="muted">% Sampah</span><span>${a.pctSampah!==null?U.pct(a.pctSampah):'—'}</span></div>
            <div class="row"><span class="muted">% Serapan</span><span><b>${a.pctSerapan!==null?U.pct(a.pctSerapan):'—'}</b></span></div>
            <div class="progress"><span style="width:${pctSerap*100}%; background: linear-gradient(90deg, ${it.color}, ${it.color}aa);"></span></div>
          </div>`);
      });
    }

    const body = document.getElementById('recapBody');
    if (body) {
      body.innerHTML = '';
      S.ITEMS.forEach(it => {
        const a = agg.perItem[it.key];
        const status = a.status === 'Terserap' ? '<span class="badge b-ok">Terserap</span>'
                     : a.status === '—' ? '<span class="badge">—</span>'
                     : '<span class="badge b-warn">Perlu Evaluasi</span>';
        body.insertAdjacentHTML('beforeend', `
          <tr>
            <td><span class="badge" style="background:${it.color}22; color:${it.color}; font-weight:700;">${it.label}</span></td>
            <td class="col-num">${U.fmt(a.p,{maximumFractionDigits:2})}</td>
            <td class="col-num" style="color:var(--c-danger)">${U.fmt(a.s,{maximumFractionDigits:2})}</td>
            <td class="col-num">${a.pctSampah!==null?U.pct(a.pctSampah):'—'}</td>
            <td class="col-num">${a.pctSerapan!==null?U.pct(a.pctSerapan):'—'}</td>
            <td>${U.pct(settings.ambangSerapan,0)}</td>
            <td>${status}</td>
          </tr>`);
      });
    }
    const foot = document.getElementById('recapFoot');
    if (foot) {
      const tStat = agg.total.status === 'Terserap' ? '<span class="badge b-ok">Terserap</span>'
                   : agg.total.status === '—' ? '<span class="badge">—</span>'
                   : '<span class="badge b-warn">Perlu Evaluasi</span>';
      foot.innerHTML = `
        <tr>
          <td>TOTAL KESELURUHAN</td>
          <td class="col-num">${U.fmt(agg.total.p,{maximumFractionDigits:2})}</td>
          <td class="col-num" style="color:var(--c-danger)">${U.fmt(agg.total.s,{maximumFractionDigits:2})}</td>
          <td class="col-num">${agg.total.pctSampah!==null?U.pct(agg.total.pctSampah):'—'}</td>
          <td class="col-num">${agg.total.pctSerapan!==null?U.pct(agg.total.pctSerapan):'—'}</td>
          <td>${U.pct(settings.ambangSerapan,0)}</td>
          <td>${tStat}</td>
        </tr>`;
    }

    const sliced = sliceByRange(rows, trendRange);
    renderTrend(sliced, settings);
    renderDonut(agg);
  };

  function sliceByRange(rows, range) {
    if (range === 'all') return rows;
    const n = parseInt(range, 10);
    return rows.slice(-n);
  }

  function chartTextColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155';
  }
  function chartGridColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)';
  }

  function renderTrend(rows, settings) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartTrend');
    if (!cv) return;
    const labels = rows.map(r => U.fmtDate(r.tanggal));
    const usage = rows.map(r => S.compute(r, settings).total_p ?? 0);
    const waste = rows.map(r => S.compute(r, settings).total_s ?? 0);
    try { if (trendChart) trendChart.destroy(); } catch (e) {}
    trendChart = new Chart(cv.getContext('2d'), {
      data: {
        labels,
        datasets: [
          { type: 'line', label: 'Pemakaian (kg)', data: usage,
            borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.18)',
            tension: .35, fill: true, pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: '#6366f1', pointBorderColor: '#fff', pointBorderWidth: 2 },
          { type: 'bar', label: 'Sampah (kg)', data: waste,
            backgroundColor: 'rgba(236,72,153,.7)', borderColor: '#ec4899',
            borderWidth: 1, borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: chartTextColor() } },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
            borderColor: 'rgba(168,139,250,.4)', borderWidth: 1, padding: 12, cornerRadius: 10,
            callbacks: { label: (c) => `${c.dataset.label}: ${U.fmt(c.parsed.y,{maximumFractionDigits:2})} kg` }
          }
        },
        scales: {
          x: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
          y: { beginAtZero: true,
               ticks: { color: chartTextColor(), callback: v => U.fmt(v,{maximumFractionDigits:0}) },
               grid: { color: chartGridColor() } }
        }
      }
    });
  }

  function renderDonut(agg) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartDonut');
    if (!cv) return;
    const labels = S.ITEMS.map(i => i.label);
    const data = S.ITEMS.map(i => agg.perItem[i.key].s);
    const colors = S.ITEMS.map(i => i.color);
    try { if (donutChart) donutChart.destroy(); } catch (e) {}
    donutChart = new Chart(cv.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'rgba(10,10,30,.6)', hoverOffset: 12 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: chartTextColor(), padding: 14 } },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
            borderColor: 'rgba(168,139,250,.4)', borderWidth: 1, padding: 12, cornerRadius: 10,
            callbacks: { label: (c) => `${c.label}: ${U.fmt(c.parsed,{maximumFractionDigits:2})} kg` }
          }
        }
      }
    });
  }
})();
