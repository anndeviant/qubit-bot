const { getYtDlpInfo } = require("../core/downloader");
const { isUrl } = require("../core/utils");

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return "-";
  }

  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((total / 60) % 60)
    .toString()
    .padStart(2, "0");
  const h = Math.floor(total / 3600);

  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

module.exports = {
  name: "check",
  commands: [
    {
      name: "cek",
      category: "Downloader",
      description: "Cek support URL downloader",
      async execute({ socket, message, args, config, logger }) {
        const targetJid = message.key.remoteJid;
        const url = args[0];

        if (!url || !isUrl(url)) {
          await socket.sendMessage(targetJid, {
            text: `Format salah. Contoh: ${config.prefix}cek <url>`,
          });
          return;
        }

        await socket.sendMessage(targetJid, {
          text: "Mengecek URL dengan yt-dlp...",
        });

        try {
          const info = await getYtDlpInfo({
            ytDlpBin: config.ytDlpBin,
            url,
          });

          const formats = Array.isArray(info.formats) ? info.formats : [];
          const hasVideo = formats.some((f) => (f.vcodec || "none") !== "none");
          const hasAudio = formats.some((f) => (f.acodec || "none") !== "none");
          const extractor = info.extractor_key || info.extractor || "unknown";
          const title = info.title || "(tanpa judul)";
          const uploader = info.uploader || info.channel || "-";
          const duration = formatDuration(info.duration);

          await socket.sendMessage(targetJid, {
            text:
              `Hasil cek URL\n` +
              `Platform: ${extractor}\n` +
              `Judul: ${title}\n` +
              `Uploader: ${uploader}\n` +
              `Durasi: ${duration}\n` +
              `Video tersedia: ${hasVideo ? "Ya" : "Tidak"}\n` +
              `Audio tersedia: ${hasAudio ? "Ya" : "Tidak"}`,
          });
        } catch (error) {
          logger.error(`Check URL failed: ${error.stack || error.message}`);
          await socket.sendMessage(targetJid, {
            text: "URL tidak bisa diproses oleh yt-dlp atau butuh login/cookies.",
          });
        }
      },
    },
  ],
};
