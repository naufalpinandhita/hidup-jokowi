# Penilaian Tes Divisi

Web app penilaian tes divisi berbasis pos (one-on-one).  
**Mobile-first**, **offline-first**, ringan, tanpa CDN eksternal.

- Penguji input skor 1–5 dari HP (bisa offline, nyimpan di LocalStorage)
- Sinkron batch ke server saat WiFi kembali
- Dashboard rekap nilai per peserta & per materi
- Export CSV

## Prasyarat

| Tool | Versi |
|------|--------|
| Node.js | **≥ 22** (dites di v24) |
| npm | bawaan Node |

Cek versi:

```bash
node -v   # harus v22 ke atas
npm -v
```

## Instalasi

```bash
# 1. Clone repo
git clone git@github.com:naufalpinandhita/hidup-jokowi.git
cd hidup-jokowi

# 2. Install dependensi (hanya express)
npm install

# 3. Siapkan daftar peserta (WAJIB)
cp participants.example.json participants.json
# lalu edit participants.json — isi nama peserta sesungguhnya, contoh:
# [
#   "BUDI SANTOSO",
#   "SITI RAHAYU - 05"
# ]

# 4. Jalankan server
npm start
```

Server aktif di `http://0.0.0.0:3000`.

## Akses

| Halaman | URL |
|---------|-----|
| Input penguji | `http://localhost:3000/` |
| Dashboard hasil | `http://localhost:3000/dashboard` |
| Health check | `http://localhost:3000/api/health` |

Dari HP di **jaringan WiFi yang sama**, ganti `localhost` dengan IP komputer server, misal:

```text
http://192.168.18.4:3000/           ← penguji
http://192.168.18.4:3000/dashboard  ← panitia
```

Cari IP server:

```bash
# Linux
hostname -I
# atau
ip -4 addr show
```

> Server sudah bind `0.0.0.0:3000` sehingga bisa diakses dari jaringan lokal.

## Alur pakai (singkat)

### Penguji
1. Buka `http://<IP-SERVER>:3000/`
2. Pilih **materi/pos** (terkunci setelah dipilih)
3. Pilih **nama peserta** dari daftar
4. Ketuk skor **1–5**
5. Isi catatan (opsional)
6. **Simpan Offline** — data masuk LocalStorage HP
7. Kalau sudah ada WiFi: **Sinkron** → kirim batch ke server

### Panitia
1. Buka `http://<IP-SERVER>:3000/dashboard`
2. Lihat ringkasan, statistik materi, tabel peringkat
3. Klik nama peserta untuk detail skor + catatan
4. **Export CSV** untuk rapat

## Offline-first

- Input nilai **tetap bisa** meski WiFi mati (setelah halaman sempat di-load sekali)
- Data tersimpan di `localStorage` browser penguji
- Saat sinkron, data dikirim sekaligus (`POST /api/submit-evaluations`)
- Setelah server OK, localStorage otomatis dibersihkan
- Kalau server mati total: pakai **Export JSON** di halaman penguji, kirim file ke panitia

## Database

- SQLite file: `evaluasi.db` (dibuat otomatis saat pertama jalan)
- Mode WAL aktif
- Tabel:
  - `evaluations` — satu baris = satu penilaian
  - `participants` — di-seed dari `participants.json` saat server start

### Reset data (bersih untuk event baru)

```bash
rm -f evaluasi.db evaluasi.db-shm evaluasi.db-wal
npm start
```

Nama peserta akan di-seed ulang dari `participants.json`.

## Materi / pos (12)

| # | Materi |
|---|--------|
| 1 | Mars |
| 2 | Arti Lambang |
| 3 | Janji |
| 4 | Kode Etik |
| 5 | Nadar |
| 6 | Mountaineering |
| 7 | PAB |
| 8 | PPGD |
| 9 | SAR |
| 10 | Survival |
| 11 | Kosidan |
| 12 | Makorsasi |

## API

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/health` | Status server + jumlah data |
| `GET` | `/api/participants` | Daftar nama peserta |
| `POST` | `/api/submit-evaluations` | Terima array evaluasi (batch) |
| `GET` | `/api/recap` | Rekap JSON (`?format=csv` untuk unduh) |
| `GET` | `/api/evaluations` | Log evaluasi mentah |

### Contoh payload submit

```json
[
  {
    "id": 1727810000000,
    "pos": "Nadar",
    "participant": "BUDI SANTOSO",
    "score": 4,
    "notes": "Paham plotting kompas.",
    "timestamp": "2026-10-01T19:30:00Z"
  }
]
```

Response sukses: `{ "status": "success", "count": 1 }`

## Akses dari luar jaringan lokal (opsional)

Kalau penguji **tidak** selalu di WiFi yang sama, salah satu opsi:

### Opsi 1 — Cloudflare Tunnel (HTTPS publik)

```bash
# install cloudflared, lalu:
cloudflared tunnel --url http://localhost:3000
```

Dapat URL `https://xxx.trycloudflare.com` → bagikan ke penguji.

### Opsi 2 — Port forwarding router

Forward port `3000` ke IP lokal server, lalu akses:

```text
http://<IP-PUBLIK-SERVER>:3000/
```

> **Catatan keamanan:** aplikasi ini **belum punya login**.  
> Jangan sebar URL ke publik tanpa kendali. Untuk event tertutup,  
> gunakan WiFi lokal atau tunnel/VPN pribadi (mis. Tailscale).

## Script npm

```bash
npm start        # jalankan server
npm run dev      # jalankan dengan auto-reload (node --watch)
```

## Struktur proyek

```text
.
├── server.js              # Express + SQLite + API
├── package.json
├── package-lock.json
├── participants.json      # daftar peserta (DI-ISI SENDIRI, tidak di-commit)
├── participants.example.json
├── PRD.md                 # dokumen kebutuhan
└── public/
    ├── index.html         # halaman penguji (mobile-first)
    └── dashboard.html     # halaman rekap panitia
```

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `Cannot find module 'express'` | Jalankan `npm install` |
| Port 3000 terpakai | `PORT=3001 npm start` |
| Daftar peserta kosong | Pastikan `participants.json` valid, lalu restart server |
| HP tidak bisa buka URL | Pastikan HP & server di WiFi yang sama; cek IP server |
| Data offline hilang | Jangan clear data browser sebelum sinkron; pakai Export JSON |

## Lisensi

Gunakan untuk kebutuhan kegiatan/internal. Sesuaikan bila perlu.
