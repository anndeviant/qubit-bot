# Qubit WhatsApp Bot

Bot WhatsApp modular berbasis Baileys dengan plugin downloader yt-dlp.

## Fitur awal

- Session WhatsApp tersimpan di folder `session`
- Arsitektur modular: `core`, `plugins`, `core/data`
- Plugin downloader media dari URL sosial media via yt-dlp

## Struktur folder

- `core/` logika utama bot
- `core/data/` konfigurasi plugin dan pengaturan bot
- `plugins/` command plugin
- `session/` data login WhatsApp (dibuat otomatis)
- `downloads/` hasil file sementara untuk upload

## Setup

1. Install Node.js 18+.
2. Install yt-dlp dan ffmpeg di sistem.
3. Salin `.env.example` menjadi `.env` lalu sesuaikan nilai.
4. Jalankan:
   - `npm install`
   - `npm run dev`

## Command

- `.help` melihat daftar command
- `.ping` cek status bot
- `.dl <url> [audio|video]` download media

Contoh:

- `.dl https://www.youtube.com/watch?v=...`
- `.dl https://www.instagram.com/reel/... audio`

## Catatan

- Batas ukuran file diatur di `core/data/config.json`.
- Jika file terlalu besar, bot akan mengirim pesan gagal.
- Jika YouTube menolak dengan pesan anti-bot, isi `ytDlpCookiesFile` (direkomendasikan) atau `ytDlpCookiesFromBrowser` di `core/data/config.json`.

## Session Cleanup Targeted

Untuk error decrypt dari participant/device tertentu di grup tertentu, gunakan cleanup targeted agar tidak perlu reset semua session.

1. Cek dulu file yang akan kena (dry run):
   - `npm run session:cleanup-targeted -- --group 6287773091264-1598407185@g.us --participant 210745723723960@lid`
2. Eksekusi pembersihan:
   - `npm run session:cleanup-targeted -- --group 6287773091264-1598407185@g.us --participant 210745723723960@lid --apply`
3. Jika ingin sekalian reset sender-key-memory grup:
   - `npm run session:cleanup-targeted -- --group 6287773091264-1598407185@g.us --participant 210745723723960@lid --includeGroupMemory --apply`

Catatan:

- File yang dihapus akan dibackup otomatis ke `session/_backup-targeted/<timestamp>/`.
- Script ini hanya menarget session participant dan sender-key untuk grup yang dipilih.
