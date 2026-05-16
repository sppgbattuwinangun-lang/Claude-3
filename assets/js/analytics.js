/* =========================================================
   Analytics — halaman Analisa Lanjut
   Render: insight cards, heatmap kalender, top menu,
   cuaca, sasaran, hari dalam minggu, organik vs anorganik
   ========================================================= */
(function () {
  const NS = (window.MBG = window.MBG || {});
  const U = NS.util, S = NS.store;
  const A = (NS.analytics = {});

  let charts = {};

  A.init = function () {
    if (!document.getElementById('page-analisa')) return;
    A.render();
  };

  A.render = function () {
    if (!document.getElementById('page-analisa')) return;
    const settings = S.getSettings();
    const rows = S.getAll();
    const an = S.analytics(rows, settings);
    renderInsightCards(an, settings);
    renderHeatmap(an);
    renderDayOfWeek(an);
    renderTopMenus(an);
    renderWeather(an);
    renderSasaran(an);
    renderOrgVsAnorg(an);
    renderPerItemRadar(an);
    renderAlasan(an);
  };

  // ---------- Insight cards ----------
  function renderInsightCards(an, settings) {
    const ambang = Math.round(settings.ambangSerapan * 100);
    const wrap = document.getElementById('analisaInsights');
    if (!wrap) return;
    wrap.innerHTML = '';

    const cards = [];

    // Hari Terbaik
    if (an.bestDay) {
      cards.push({
        icon: '🏆', label: 'HARI TERBAIK',
        val: U.pct(an.bestDay.serapan, 1),
        sub: U.fmtDate(an.bestDay.tanggal) + ' · ' + (an.bestDay.hari || ''),
        accent: '#10b981'
      });
    }
    // Hari Terburuk
    if (an.worstDay) {
      cards.push({
        icon: '⚠️', label: 'HARI PALING BOROS',
        val: U.pct(an.worstDay.serapan, 1),
        sub: U.fmtDate(an.worstDay.tanggal) + ' · ' + (an.worstDay.hari || ''),
        accent: '#f59e0b'
      });
    }
    // Streak saat ini
    cards.push({
      icon: '🔥', label: 'STREAK TERSERAP SAAT INI',
      val: an.currentStreak + ' hari',
      sub: an.currentStreak >= 3 ? 'Pertahankan!' : 'Mari ditingkatkan',
      accent: '#ec4899'
    });
    // Streak terlama
    cards.push({
      icon: '🌟', label: 'REKOR TERLAMA',
      val: an.longestStreak + ' hari',
      sub: 'Hari berturut-turut Terserap',
      accent: '#8b5cf6'
    });
    // Trend minggu
    if (an.trendDelta !== null) {
      const up = an.trendDelta >= 0;
      cards.push({
        icon: up ? '📈' : '📉',
        label: 'TREN MINGGU INI',
        val: (up ? '+' : '') + (an.trendDelta * 100).toFixed(1) + '%',
        sub: 'vs minggu lalu (' + (an.lastWeekAvg !== null ? U.pct(an.lastWeekAvg, 0) : '—') + ')',
        accent: up ? '#10b981' : '#ef4444'
      });
    }
    // Total Hari
    cards.push({
      icon: '📅', label: 'TOTAL HARI TERCATAT',
      val: an.totalRows,
      sub: 'Sejak pertama kali input',
      accent: '#6366f1'
    });

    cards.forEach(c => {
      wrap.insertAdjacentHTML('beforeend', `
        <div class="insight-card" style="--accent:${c.accent}">
          <div class="ic-icon">${c.icon}</div>
          <div class="ic-label">${c.label}</div>
          <div class="ic-val">${c.val}</div>
          <div class="ic-sub">${c.sub}</div>
        </div>`);
    });
  }

  // ---------- Heatmap kalender ----------
  function renderHeatmap(an) {
    const cv = document.getElementById('heatmap');
    if (!cv) return;
    cv.innerHTML = '';
    if (!an.heatmap.length) {
      cv.innerHTML = '<div style="opacity:.6;font-size:13px;padding:20px;text-align:center">Belum ada data untuk heatmap</div>';
      return;
    }
    // Tampilkan 8 minggu terakhir
    const end = new Date();
    const days = 56;
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const map = {};
    an.heatmap.forEach(h => map[h.tanggal] = h);

    // Build grid: kolom = minggu, baris = hari (Sen..Min)
    // Get start at Monday
    const startDate = new Date(start);
    while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

    const totalCells = Math.ceil((end - startDate) / 86400000) + 1;

    let html = '<div class="heatmap-grid">';
    // Day labels
    html += '<div class="hm-days">';
    ['S','S','R','K','J','S','M'].forEach(l => html += `<div class="hm-day-label">${l}</div>`);
    html += '</div>';
    html += '<div class="hm-cells">';
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(startDate.getTime() + i * 86400000);
      if (d > end) { html += '<div class="hm-cell empty"></div>'; continue; }
      const iso = d.toISOString().slice(0, 10);
      const data = map[iso];
      let cls = 'hm-cell';
      let title = U.fmtDate(iso);
      if (data && data.serapan !== null) {
        const v = data.serapan;
        if (v >= 0.9) cls += ' lvl-4';
        else if (v >= 0.85) cls += ' lvl-3';
        else if (v >= 0.8) cls += ' lvl-2';
        else if (v >= 0.7) cls += ' lvl-1';
        else cls += ' lvl-low';
        title += ` · Serapan ${U.pct(v, 1)} · ${data.status}`;
      } else {
        cls += ' empty';
        title += ' · tidak ada data';
      }
      html += `<div class="${cls}" title="${title}"></div>`;
    }
    html += '</div></div>';
    html += `<div class="hm-legend">
      <span>Kurang</span>
      <span class="hm-cell lvl-low"></span>
      <span class="hm-cell lvl-1"></span>
      <span class="hm-cell lvl-2"></span>
      <span class="hm-cell lvl-3"></span>
      <span class="hm-cell lvl-4"></span>
      <span>Sangat baik</span>
    </div>`;
    cv.innerHTML = html;
  }

  // ---------- Day of Week chart ----------
  function renderDayOfWeek(an) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartByDay');
    if (!cv) return;
    const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    const data = days.map(d => {
      const o = an.byDayOfWeek[d];
      return o && o.avg !== null ? +(o.avg * 100).toFixed(1) : 0;
    });
    try { if (charts.byDay) charts.byDay.destroy(); } catch (e) {}
    charts.byDay = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Rata-rata % Serapan',
          data,
          backgroundColor: data.map(v => v >= 80 ? 'rgba(16,185,129,.7)' : 'rgba(245,158,11,.7)'),
          borderColor: data.map(v => v >= 80 ? '#10b981' : '#f59e0b'),
          borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
            callbacks: {
              label: (c) => {
                const o = an.byDayOfWeek[c.label];
                return [`Serapan: ${c.parsed.y.toFixed(1)}%`,
                        `Hari tercatat: ${o.count}`,
                        `Hari Terserap: ${o.ok}`];
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: txt() }, grid: { color: grid() } },
          y: { beginAtZero: true, max: 100, ticks: { color: txt(), callback: v => v + '%' }, grid: { color: grid() } }
        }
      }
    });
  }

  // ---------- Top Menus ----------
  function renderTopMenus(an) {
    const high = document.getElementById('topMenusHigh');
    const low = document.getElementById('topMenusLow');
    if (high) {
      high.innerHTML = '';
      if (!an.topMenusHigh.length) {
        high.innerHTML = '<div class="muted" style="font-size:13px;padding:14px">Butuh ≥2 catatan menu yang sama untuk muncul di sini</div>';
      } else {
        an.topMenusHigh.forEach((m, i) => {
          high.insertAdjacentHTML('beforeend', `
            <div class="menu-row top">
              <span class="menu-rank">#${i + 1}</span>
              <span class="menu-info">
                <span class="menu-name">${m.menu}</span>
                <span class="menu-meta">${m.item} · ${m.count} kali</span>
              </span>
              <span class="menu-score" style="color:#10b981">${U.pct(m.avg, 1)}</span>
            </div>`);
        });
      }
    }
    if (low) {
      low.innerHTML = '';
      if (!an.topMenusLow.length) {
        low.innerHTML = '<div class="muted" style="font-size:13px;padding:14px">Butuh ≥2 catatan menu yang sama untuk muncul di sini</div>';
      } else {
        an.topMenusLow.forEach((m, i) => {
          low.insertAdjacentHTML('beforeend', `
            <div class="menu-row low">
              <span class="menu-rank">#${i + 1}</span>
              <span class="menu-info">
                <span class="menu-name">${m.menu}</span>
                <span class="menu-meta">${m.item} · ${m.count} kali</span>
              </span>
              <span class="menu-score" style="color:#f59e0b">${U.pct(m.avg, 1)}</span>
            </div>`);
        });
      }
    }
  }

  // ---------- Weather ----------
  function renderWeather(an) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartWeather');
    if (!cv) return;
    const items = Object.entries(an.byWeather);
    if (!items.length) {
      // tampilkan placeholder
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      try { if (charts.weather) charts.weather.destroy(); } catch (e) {}
      cv.parentElement.innerHTML = '<div class="muted" style="text-align:center;padding:40px;font-size:13px">Belum ada data cuaca tercatat. Isi field "Cuaca" saat input data.</div>';
      return;
    }
    items.sort((a, b) => b[1].avg - a[1].avg);
    try { if (charts.weather) charts.weather.destroy(); } catch (e) {}
    charts.weather = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: items.map(([k, v]) => v.icon + ' ' + v.label),
        datasets: [{
          label: 'Rata-rata Serapan (%)',
          data: items.map(([k, v]) => +(v.avg * 100).toFixed(1)),
          backgroundColor: 'rgba(56,189,248,.7)',
          borderColor: '#38bdf8', borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { color: txt(), callback: v => v + '%' }, grid: { color: grid() } },
          y: { ticks: { color: txt() }, grid: { color: grid() } }
        }
      }
    });
  }

  // ---------- Sasaran ----------
  function renderSasaran(an) {
    const wrap = document.getElementById('sasaranList');
    if (!wrap) return;
    const items = Object.entries(an.bySasaran);
    if (!items.length) {
      wrap.innerHTML = '<div class="muted" style="font-size:13px;padding:14px">Belum ada data sasaran. Isi field "Sasaran" saat input data.</div>';
      return;
    }
    items.sort((a, b) => b[1].avg - a[1].avg);
    wrap.innerHTML = '';
    items.forEach(([k, v]) => {
      const pct = Math.max(0, Math.min(1, v.avg)) * 100;
      wrap.insertAdjacentHTML('beforeend', `
        <div class="sasaran-row">
          <div class="sasaran-name">${v.label}</div>
          <div class="sasaran-bar"><span style="width:${pct}%; background: linear-gradient(90deg, #6366f1, #ec4899);"></span></div>
          <div class="sasaran-val">${U.pct(v.avg, 1)} <span class="muted">(${v.count}×)</span></div>
        </div>`);
    });
  }

  // ---------- Organik vs Anorganik ----------
  function renderOrgVsAnorg(an) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartOrgAnorg');
    if (!cv) return;
    const wrapEmpty = document.getElementById('orgAnorgEmpty');
    if (!an.orgVsAnorg.hasSub) {
      cv.style.display = 'none';
      if (wrapEmpty) wrapEmpty.style.display = 'block';
      return;
    }
    cv.style.display = '';
    if (wrapEmpty) wrapEmpty.style.display = 'none';
    try { if (charts.orgAnorg) charts.orgAnorg.destroy(); } catch (e) {}
    charts.orgAnorg = new Chart(cv.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Organik', 'Anorganik'],
        datasets: [{
          data: [an.orgVsAnorg.org, an.orgVsAnorg.anorg],
          backgroundColor: ['#16a34a', '#64748b'],
          borderWidth: 2,
          borderColor: 'rgba(10,10,30,.5)',
          hoverOffset: 14
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: txt(), padding: 14 } },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
            callbacks: { label: (c) => `${c.label}: ${U.fmt(c.parsed, {maximumFractionDigits:2})} kg` }
          }
        }
      }
    });
  }

  // ---------- Per-item radar ----------
  function renderPerItemRadar(an) {
    if (typeof Chart === 'undefined') return;
    const cv = document.getElementById('chartItemRadar');
    if (!cv) return;
    const labels = S.ITEMS.map(it => it.label);
    const data = S.ITEMS.map(it => {
      const o = an.perItemAvg[it.key];
      return o.avg !== null ? +(o.avg * 100).toFixed(1) : 0;
    });
    try { if (charts.itemRadar) charts.itemRadar.destroy(); } catch (e) {}
    charts.itemRadar = new Chart(cv.getContext('2d'), {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Rata-rata Serapan (%)',
          data,
          backgroundColor: 'rgba(168,139,250,.2)',
          borderColor: '#a855f7',
          borderWidth: 2.5,
          pointBackgroundColor: '#ec4899',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: txt() } },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,.95)', titleColor: '#fff', bodyColor: '#cbd5e1'
          }
        },
        scales: {
          r: {
            beginAtZero: true, max: 100,
            ticks: { color: txt(), backdropColor: 'transparent' },
            grid: { color: grid() },
            angleLines: { color: grid() },
            pointLabels: { color: txt(), font: { size: 12, weight: '600' } }
          }
        }
      }
    });
  }

  // ---------- Alasan sampah ----------
  function renderAlasan(an) {
    const wrap = document.getElementById('alasanList');
    if (!wrap) return;
    const items = Object.entries(an.alasanFreq).sort((a, b) => b[1] - a[1]);
    if (!items.length) {
      wrap.innerHTML = '<div class="muted" style="font-size:13px;padding:14px">Belum ada catatan alasan sampah. Isi field "Alasan/Catatan Sampah" saat input data.</div>';
      return;
    }
    wrap.innerHTML = '';
    items.slice(0, 8).forEach(([alasan, count]) => {
      wrap.insertAdjacentHTML('beforeend', `
        <div class="alasan-row">
          <span class="alasan-text">${escapeHtml(alasan)}</span>
          <span class="alasan-count">${count}×</span>
        </div>`);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function txt() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155'; }
  function grid() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,.15)' : 'rgba(15,23,42,.08)'; }
})();
