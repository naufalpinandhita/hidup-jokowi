# PRODUCT REQUIREMENT DOCUMENT (PRD) FINAL
**Nama Proyek:** Web App Penilaian Tes Divisi (Mobile-First & Offline-First)  
**Tipe Aplikasi:** Single-Page Web Application (Mobile Browser)  
**Target Rilis:** Besok (Urgent)  
**Infrastruktur:** Home Server (Node.js/Express + SQLite)

---

## 1. Ringkasan Eksekutif & Latar Belakang
Aplikasi ini dibangun untuk mendukung proses penyaringan dan pemetaan divisi peserta melalui serangkaian tes materi berbasis pos (*one-on-one*). Materi yang diuji meliputi:
1. Mars & Arti Lambang
2. Janji & Kode Etik
3. Nadar & Mountaineering
4. PAB & PPGD
5. SAR & Survival
6. Kosidan & Makorsasi

Mengingat lokasi tes memiliki keterbatasan jaringan (sinyal mati/lambat), aplikasi ini dirancang **100% Offline-First berbasis Web Mobile-First**. Penguji hanya perlu memuat (*load*) halaman web sekali via jaringan lokal/WiFi, lalu seluruh penilaian dilakukan tanpa koneksi internet dengan memanfaatkan memori browser (`LocalStorage`).

---

## 2. Tujuan & Indikator Keberhasilan (KPI)
* **Mobile-First & Responsif:** Nyaman digunakan dengan satu tangan pada layar smartphone (HP) penguji.
* **100% Bebas Keterbatasan Sinyal:** Input nilai dan catatan peserta berjalan lancar meski WiFi/internet terputus.
* **Kecepatan Transaksi Data:** Waktu pengisian nilai per peserta < 15 detik.
* **Proses Rekapitulasi & Pemetaan Cepat:** Panitia dapat melihat ringkasan kemampuan lengkap tiap peserta secara *real-time* pasca-sync untuk mempercepat rapat penetapan divisi.

---

## 3. Fitur Utama & Kebutuhan Antarmuka (UI/UX)

### 3.1. Halaman Input Penilaian (Penguji)
* **Fixed Header (Mobile):** Menampilkan status jaringan (*Online/Offline*) dan nama pos yang sedang aktif.
* **Pos Selector (Sekali Pilih & Terkunci):** Penguji memilih pos materi di awal sesi (misal: *Pos 3 - Nadar & Mountaineering*), lalu dropdown terkunci otomatis agar penguji fokus pada wawancara.
* **Input Identitas Peserta:** Field teks singkat untuk mengisi Nama atau Nomor Dada peserta (Contoh: `Budi - 01`).
* **Skala Kemahiran Touch-Friendly (Tombol Besar 1 - 5):**
  * `5` - **Sangat Mahir**: Menguasai konsep & praktek secara presisi, tanpa ragu.
  * `4` - **Mahir**: Menguasai sebagian besar materi, ada kesalahan minor.
  * `3` - **Biasa**: Paham dasar, perlu pancingan pertanyaan.
  * `2` - **Kurang**: Banyak ragu, pemahaman minim.
  * `1` - **Tidak Bisa**: Nol pemahaman / tidak menjawab.
* **Catatan Khusus (Opsional):** Textarea singkat untuk mencatat potensi khusus (misal: *"Cocok untuk Divisi Operasional/SAR"*).
* **Tombol "SIMPAN DATA (OFFLINE)":** Menyimpan JSON ke `LocalStorage`, memberikan efek feedback visual (*toast success*), dan mereset form peserta.

### 3.2. Fitur Sinkronisasi & Backup Data
* **Counter Data Offline:** Menampilkan jumlah baris data yang tersimpan di HP penguji dan belum terkirim ke server.
* **Tombol "KIRIM KE SERVER (SYNC)":** Mengirimkan seluruh array data JSON dari `LocalStorage` ke Home Server dalam satu kali *batch HTTP POST request*.
* **Auto-Clear Storage:** Memori `LocalStorage` dibersihkan otomatis setelah server mengembalikan respon HTTP 200/201 OK.
* **Tombol "Export File JSON" (Rencana Cadangan):** Memungkinkan penguji mengunduh file `.json` langsung ke penyimpanan HP jika jaringan Home Server mati total.

### 3.3. Halaman Dashboard Ringkasan & Profil Peserta (Admin/Server)
* **Matriks Ringkasan Anggota (Pivot Table):**
  * Menyajikan seluruh peserta dalam bentuk tabel matriks (Baris = Peserta, Kolom = Pos 1 s/d Pos 6, Nilai Rata-Rata).
* **Visual Color Coding:**
  * Nilai **4 - 5** diberi sorotan **Hijau** (Indikasi Potensi Utama/Mahir).
  * Nilai **1 - 2** diberi sorotan **Kuning/Merah** (Indikasi Kurang/Perlu Pembinaan).
* **Aturan Rekomendasi Divisi Otomatis (Auto-Recommendation Badge):**
  * High Score Pos 3 (Nadar) & Pos 5 (SAR) $
ightarrow$ Badge **"Rekomendasi: Operasional / Lapangan"**.
  * High Score Pos 6 (Kosidan) & Pos 1/2 (Keorganisasian) $
ightarrow$ Badge **"Rekomendasi: Kesekretariatan / Logistik"**.
* **Detail Modal / Pop-up Catatan:** Klik pada nama peserta untuk menampilkan *pop-up* gabungan seluruh catatan khusus dari penguji Pos 1 hingga Pos 6.
* **Export Ringkasan (1-Click):** Tombol `Export to CSV / Excel` untuk mengunduh rekapitulasi utuh hasil akhir seleksi.

---

## 4. Alur Kerja Deployment & Infrastruktur Home Server

### 4.1. Arsitektur Sederhana
```text
[HP Penguji 1] ──┐ (Load Web Sekali + Simpan LocalStorage)
[HP Penguji 2] ──┼──> [WiFi Lokal / IP Server] ──> [Home Server (Node.js + SQLite)]
[HP Penguji 3] ──┘                                        │
                                                          └──> [Dashboard Ringkasan Admin]
```

### 4.2. Spesifikasi Backend & Database
* **Runtime:** Node.js dengan Express.js (Melayani static file HTML/CSS/JS + REST API).
* **Database:** SQLite (File tunggal `evaluasi.db`, tanpa instalasi server database terpisah).
* **Asset Handling:** Seluruh asset (CSS/JS) wajib disajikan secara **lokal/inline** (Nol dependensi CDN luar seperti Bootstrap/Tailwind CDN atau Google Fonts).

### 4.3. API Endpoint Specification
1. **`POST /api/submit-evaluations`**
   * **Deskripsi:** Menerima array JSON data offline dari penguji.
   * **Payload Request:**
     ```json
     [
       {
         "id": 1727810000000,
         "pos": "Nadar & Mountaineering",
         "participant": "Budi - 01",
         "score": 4,
         "notes": "Paham plotting kompas malam.",
         "timestamp": "2026-10-01T19:30:00Z"
       }
     ]
     ```
   * **Response:** `{ "status": "success", "count": 1 }`
2. **`GET /api/recap`**
   * **Deskripsi:** Menampilkan atau mengunduh hasil rekapitulasi matriks nilai dan rekomendasi divisi seluruh peserta (format JSON/CSV) untuk rapat seleksi.

---

## 5. Rencana Penanganan Risiko (Risk Mitigation)

| Skenario Risiko | Dampak | Solusi Penanganan |
| :--- | :--- | :--- |
| **Koneksi WiFi Putus / Router Mati** | Tidak bisa buka URL atau Sync | Web yang sudah di-load tetap bisa simpan data ke `LocalStorage`. Saat sync, gunakan tombol **Export JSON** lalu kirim file ke laptop panitia via WhatsApp/Bluetooth/Flashdisk. |
| **Browser HP Ter-refresh / Tab Tertutup** | Takut data hilang | Data di `LocalStorage` bersifat presisten dan tidak hilang meskipun tab browser tertutup atau HP di-restart. |
| **Baterai HP Penguji Habis** | Wawancara terhambat | Data yang sudah tersimpan aman di HP. Penguji tinggal ganti HP, dan HP lama di-sync setelah di-charge. |
| **Bentrokan Identitas Peserta** | Kesulitan pemetaan | Diwajibkan menginput Nama + Nomor Dada (Contoh: `Siti - 05`). |

---

## 6. Checklist Eksekusi Malam Ini
- [ ] Buat file `index.html` (Mobile-First, Inline CSS/JS, LocalStorage logic).
- [ ] Buat file `server.js` (Express.js, SQLite setup, Endpoint `/api/submit-evaluations` & `/api/recap`).
- [ ] Buat halaman Dashboard Matriks Ringkasan Anggota (Pivot View & Auto-Recommendation Badge).
- [ ] Test alur: Buka web di HP $
ightarrow$ Matikan WiFi $
ightarrow$ Submit 3 data $
ightarrow$ Nyalakan WiFi $
ightarrow$ Klik Sync $
ightarrow$ Cek Dashboard Ringkasan di Server.
- [ ] Siapkan IP Lokal Home Server / QR Code URL agar penguji tinggal scan besok.
