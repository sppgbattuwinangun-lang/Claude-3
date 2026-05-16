# MBG Monitor

Monitoring Sampah Pasca Distribusi MBG — aplikasi web (HTML + CSS + Vanilla JS) untuk SPPG Battu Winangun.

## Fitur

- 🔐 Login admin (PBKDF2 hash, sesi 8 jam atau 7 hari)
- 📊 Dashboard real-time dengan KPI animated counter
- 📝 Input harian (39 kolom: tanggal, menu, pemakaian/sampah per item, status)
- 📈 Grafik per item (5 item utama + total) — combo bar+line
- 📄 **Laporan PDF** dengan filter rentang waktu (7/14/30/90 hari, bulan ini, bulan lalu, semua, custom)
  - Cover page bergradien
  - Ringkasan eksekutif (KPI + tabel per item)
  - Grafik analisis (trend + komposisi + perbandingan)
  - Tabel detail harian
- 🎨 UI premium gradient + glassmorphism, ripple click effect, animated background
- 🌗 Dark / Light mode toggle
- 🔄 Real-time sync antar tab via BroadcastChannel
- 💾 Penyimpanan localStorage (tanpa server)

## Teknologi

- HTML / CSS / Vanilla JS (tanpa framework)
- [Chart.js](https://www.chartjs.org/) — grafik
- [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) — laporan PDF
- Web Crypto API — hash password

## Struktur

```
.
├── index.html          # Splash / redirect
├── login.html          # Halaman login
├── app.html            # Aplikasi utama (single-page)
├── 404.html
├── assets/
│   ├── css/styles.css  # Premium gradient theme
│   └── js/
│       ├── utils.js    # Storage, format, hash, theme, event bus
│       ├── auth.js     # Login + manajemen user
│       ├── store.js    # CRUD + perhitungan + agregasi
│       ├── effects.js  # Ripple, counter, reveal, tilt
│       ├── dashboard.js
│       ├── charts.js   # Grafik per item
│       ├── input.js    # Tabel + modal CRUD
│       ├── pdf.js      # Generator laporan PDF
│       ├── settings.js # Pengaturan + manajemen admin
│       ├── login.js
│       └── app.js      # Orchestrator
└── .github/workflows/
    └── deploy-pages.yml # Auto-deploy ke GitHub Pages
```

## Kredensial Default

- Username: `admin`
- Password: `admin123`

> Anda akan **diminta mengganti password** setelah login pertama.

## Penggunaan

1. Buka `https://sppgbattuwinangun-lang.github.io/Claude-3/`
2. Login dengan kredensial default, ganti password.
3. Buka **Input Harian** → klik **Tambah Data** → isi form → simpan.
4. Pantau di **Dashboard**.
5. Untuk laporan: **Laporan PDF** → pilih rentang → **Unduh PDF**.

## Pengembangan Lokal

Aplikasi 100% static — bisa dijalankan dengan static server apa pun:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve
```

Lalu buka `http://localhost:8080`.

## Lisensi

Internal — SPPG Battu Winangun.
