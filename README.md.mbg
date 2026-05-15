# MBG Monitor — Monitoring Sampah Pasca Distribusi

Aplikasi web statis untuk SPPG yang memantau pemakaian, sampah, % serapan, dan
status harian per item makanan (Nasi, Protein Hewani, Sayur, Protein Nabati,
Buah) — sesuai struktur Excel `monitoring_sampah_mbg_analisis_item_otomatis_final`.

## Fitur

- **Login admin** dengan PBKDF2-SHA256 (200.000 iterasi) + sesi 8 jam (7 hari
  jika centang "Ingat saya"). Password default `admin / admin123` **wajib**
  diganti pada login pertama.
- **Dashboard** berisi KPI, ringkasan per item, donut komposisi sampah, tren
  harian (line + bar combo), dan tabel rekap dengan ambang serapan.
- **Input Harian** lengkap dengan semua kolom Excel: tanggal, hari (otomatis),
  5 menu, jumlah porsi, pemakaian & sampah per item, % sampah, % serapan,
  status, total. Mendukung tambah/edit/hapus, search, filter status, filter
  bulan, sort, dan paginasi.
- **Grafik Per Item** untuk Nasi, Protein Hewani, Sayur, Protein Nabati, Buah,
  dan Total — pemakaian vs sampah.
- **Import / Export Excel** kompatibel SPPG (deteksi header otomatis pada
  sheet "Input Harian"). Ekspor menghasilkan file dengan sheet *Input Harian*,
  *Dashboard*, dan *Panduan*.
- **Real-time** — perubahan data langsung tersinkron antar tab/jendela melalui
  `BroadcastChannel` (fallback `storage` event).
- **Tema gelap & terang**, responsif (HP, tablet, desktop).
- **Manajemen admin**: tambah/hapus admin, ganti password, ubah ambang serapan.

## Cara Pakai

1. Buka `login.html` di browser (Chrome dianjurkan).
2. Login dengan `admin` / `admin123` lalu ganti password sesuai instruksi.
3. Mulai input data atau gunakan **Import Excel** untuk memuat file SPPG yang
   sudah ada.

## Deploy ke GitHub Pages (gratis, dapat URL Chrome-ready)

1. Push repo ke GitHub.
2. Repo Settings → **Pages** → Source: `Deploy from a branch`
   → Branch: `main` (atau branch tujuan), folder: `/ (root)` jika file ada di
   root, atau `/docs` bila Anda salin folder `mbg-monitor` ke `docs`.
3. Setelah deploy, URL aplikasi:
   `https://<username>.github.io/<repo>/mbg-monitor/login.html`

> Folder ini sudah berisi `.nojekyll` agar GitHub Pages tidak memproses Jekyll.

### Alternatif Lain

- **Netlify / Vercel / Cloudflare Pages**: drag & drop folder `mbg-monitor/`,
  lalu deploy. Tidak perlu konfigurasi build.
- **Local**: jalankan `npx serve mbg-monitor` atau `python3 -m http.server 8080`
  di dalam folder ini, lalu buka `http://localhost:8080`.

## Keamanan

- Password disimpan sebagai PBKDF2-SHA256 dengan salt unik per user.
- Sesi disimpan di `localStorage` dengan kedaluwarsa.
- Karena ini app statis (tanpa server), data tersimpan di browser pengguna
  (`localStorage`) — gunakan **Export Excel** untuk backup berkala. Bila
  membutuhkan database multi-user terpusat, hubungkan ke backend (mis. Supabase
  atau Firebase) — modul `store.js` mudah dialihkan.

## Struktur File

```
mbg-monitor/
├── index.html            # redirect ke login/app
├── login.html            # halaman login + paksa ganti pw
├── app.html              # aplikasi utama (SPA satu halaman)
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── utils.js      # helpers, hashing, BroadcastChannel
│       ├── auth.js       # user store, login/logout, change pw
│       ├── store.js      # data CRUD + perhitungan otomatis
│       ├── excel.js      # import/export xlsx (SheetJS)
│       ├── dashboard.js  # KPI, charts, ringkasan
│       ├── input.js      # tabel + modal input/edit
│       ├── charts.js     # grafik per item
│       ├── settings.js   # ambang, password, manajemen user
│       └── app.js        # orchestrator (navigasi, auth guard)
└── .nojekyll
```

## Catatan

- Library eksternal dimuat via CDN (`Chart.js`, `SheetJS`). Pastikan koneksi
  internet aktif untuk pertama kali memuat halaman; setelahnya browser akan
  cache.
- Aplikasi sepenuhnya statis sehingga aman di-host di GitHub Pages tanpa biaya.
