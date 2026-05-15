/* =========================================================
   Dashboard rendering
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const D = (NS.dashboard = {});

  let trendChart = null, donutChart = null;
  let trendRange = 'all'; // 7, 14, 30, all

  D.init = function () {
    document.querySelectorAll('#page-dashboard .tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#page-dashboard .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        trendRange = t.dataset.range;
        D.render();
      });
    });
    D.render();
  };

  D.render = function () {
    const settings = S.getSettings();
    const rows = S.getAll().slice().sort((a,b) => String(a.tanggal||'').localeCompare(String(b.tanggal||'')));
    const agg = S.aggregate(rows, settings);

    // KPIs
    document.getElementById('kpiDays').textContent  = U.fmt(agg.total.days, { maximumFractionDigits: 0 });
    document.getElementById('kpiUse').textContent   = U.fmt(agg.total.p, { maximumFractionDigits: 1 }) + ' kg';
    document.getElementById('kpiWaste').textContent = U.fmt(agg.total.s, { maximumFractionDigits: 1 }) + ' kg';
    document.getElementById('kpiAbsorb').textContent = agg.total.pctSerapan !== null ? U.pct(agg.total.pctSerapan, 1) : '—';
    const sub = document.getElementById('kpiAbsorbStatus');
    sub.textContent = agg.total.status === 'Terserap'
      ? `Terserap (≥ ${Math.round(settings.ambangSerapan*100)}%)`
      : (agg.total.status === '—' ? 'Belum ada data' : `Perlu Evaluasi (< ${Math.round(settings.ambangSerapan*100)}%)`);

    // Item summary cards
    const grid = document.getElementById('itemSummaryGrid');
    grid.innerHTML = '';
    S.ITEMS.forEach(it => {
      const a = agg.perItem[it.key];
      const pctSerap = a.pctSerapan !== null ? Math.max(0, Math.min(1, a.pctSerapan)) : 0;
      const badge = a.status === 'Terserap' ? '<span class="badge b-ok">Terserap</span>' :
                   (a.status === '—' ? '<span class="badge">—</span>' :
                   '<span class="badge b-warn">Perlu Evaluasi</span>');
      const html = `
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
        </div>`;
      grid.insertAdjacentHTML('beforeend', html);
    });

    // Recap table
    const body = document.getElementById('recapBody');
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
    const foot = document.getElementById('recapFoot');
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

    // Charts
    const sliced = sliceByRange(rows, trendRange);
    renderTrend(sliced, settings);
    renderDonut(agg);
  };

  function sliceByRange(rows, range) {
    if (range === 'all') return rows;
    const n = parseInt(range, 10);
    return rows.slice(-n);
  }

  function renderTrend(rows, settings) {
    const ctx = document.getElementById('chartTrend').getContext('2d');
    const labels = rows.map(r => U.fmtDate(r.tanggal));
    const usage = rows.map(r => S.compute(r, settings).total_p ?? 0);
    const waste = rows.map(r => S.compute(r, settings).total_s ?? 0);
    const data = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Pemakaian (kg)',
          data: usage,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,.15)',
          tension: .35, fill: true, pointRadius: 3, pointHoverRadius: 5
        },
        {
          type: 'bar',
          label: 'Sampah (kg)',
          data: waste,
          backgroundColor: 'rgba(239,68,68,.65)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    };
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      data,
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${U.fmt(c.parsed.y,{maximumFractionDigits:2})} kg`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => U.fmt(v,{maximumFractionDigits:0}) } }
        }
      }
    });
  }

  function renderDonut(agg) {
    const ctx = document.getElementById('chartDonut').getContext('2d');
    const labels = S.ITEMS.map(i => i.label);
    const data = S.ITEMS.map(i => agg.perItem[i.key].s);
    const colors = S.ITEMS.map(i => i.color);
    if (donutChart) donutChart.destroy();
    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (c) => `${c.label}: ${U.fmt(c.parsed,{maximumFractionDigits:2})} kg`
            }
          }
        }
      }
    });
  }
})();
