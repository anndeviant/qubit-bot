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

- `!help` melihat daftar command
- `!ping` cek status bot
- `!dl <url> [audio|video]` download media

Contoh:

- `!dl https://www.youtube.com/watch?v=...`
- `!dl https://www.instagram.com/reel/... audio`

## Catatan

- Batas ukuran file diatur di `core/data/config.json`.
- Jika file terlalu besar, bot akan mengirim pesan gagal.
