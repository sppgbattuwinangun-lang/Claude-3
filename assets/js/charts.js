/* =========================================================
   Grafik per Item — combo bar+line per item, defensive
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const C = (NS.charts = {});

  let charts = {};
  let initialized = false;

  C.init = function () {
    const grid = document.getElementById('chartGrid');
    if (!grid) return;
    grid.innerHTML = '';
    [...S.ITEMS, { key: 'total', label: 'Total Keseluruhan', color: '#0ea5e9' }].forEach(it => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-head">
          <h3 style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${it.color}"></span>
            ${it.label}
          </h3>
          <div class="sub">Pemakaian vs Sampah harian</div>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart_${it.key}"></canvas></div>
        </div>`;
      grid.appendChild(card);
    });
    initialized = true;
    C.render();
  };

  C.render = function () {
    if (typeof Chart === 'undefined') return;
    if (!initialized && document.getElementById('chartGrid')) C.init();
    if (!document.getElementById('chartGrid')) return;
    const settings = S.getSettings();
    const rows = S.getAll().slice().sort((a,b) => String(a.tanggal||'').localeCompare(String(b.tanggal||'')));
    [...S.ITEMS, { key: 'total', label: 'Total', color: '#0ea5e9' }].forEach(it => {
      const labels = rows.map(r => U.fmtDate(r.tanggal));
      const usage = rows.map(r => {
        const c = S.compute(r, settings);
        return c[it.key + '_p'] ?? 0;
      });
      const waste = rows.map(r => {
        const c = S.compute(r, settings);
        return c[it.key + '_s'] ?? 0;
      });
      const id = 'chart_' + it.key;
      const cv = document.getElementById(id);
      if (!cv) return;
      try { if (charts[id]) charts[id].destroy(); } catch (e) {}
      charts[id] = new Chart(cv.getContext('2d'), {
        data: {
          labels,
          datasets: [
            { type: 'bar', label: 'Pemakaian (kg)', data: usage,
              backgroundColor: it.color + 'aa', borderColor: it.color, borderWidth: 1, borderRadius: 6 },
            { type: 'line', label: 'Sampah (kg)', data: waste,
              borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.18)',
              tension: .35, fill: true, pointRadius: 4, pointHoverRadius: 6,
              pointBackgroundColor: '#ef4444', pointBorderColor: '#fff', pointBorderWidth: 2 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor() } },
            tooltip: {
              backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
              borderColor: 'rgba(168,139,250,.4)', borderWidth: 1, padding: 12, cornerRadius: 10
            }
          },
          scales: {
            x: { ticks: { color: textColor() }, grid: { color: gridColor() } },
            y: { beginAtZero: true, ticks: { color: textColor() }, grid: { color: gridColor() } }
          }
        }
      });
    });
  };
  function textColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155';
  }
  function gridColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)';
  }
})();
