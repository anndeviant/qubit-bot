const fs = require("fs");
const path = require("path");
const {
  runYtDlp,
  getMediaType,
  normalizeMode,
  readableSize,
  makeOutputFileName,
} = require("../core/downloader");
const { isUrl } = require("../core/utils");

module.exports = {
  name: "downloader",
  commands: [
    {
      name: "dl",
      description: "Downloader Media",
      async execute({ socket, message, args, config, responses, logger }) {
        const targetJid = message.key.remoteJid;
        const url = args[0];
        const mode = normalizeMode(args[1]);

        if (!url || !isUrl(url)) {
          await socket.sendMessage(targetJid, {
            text: `Format salah. Contoh: ${config.prefix}dl <url> [audio|video]`,
          });
          return;
        }

        await socket.sendMessage(targetJid, {
          text: responses.downloadStarted || "Sedang memproses...",
        });

        const downloadsDir = path.resolve(process.cwd(), config.downloadsPath);
        fs.mkdirSync(downloadsDir, { recursive: true });

        let outputFilePath;
        try {
          outputFilePath = await runYtDlp({
            ytDlpBin: config.ytDlpBin,
            ffmpegBin: config.ffmpegBin,
            url,
            mode,
            outputDir: downloadsDir,
          });

          const stat = fs.statSync(outputFilePath);
          const maxSizeBytes =
            Number(config.maxDownloadSizeMb || 60) * 1024 * 1024;

          if (stat.size > maxSizeBytes) {
            await socket.sendMessage(targetJid, {
              text: `${responses.downloadTooLarge || "File terlalu besar"}\nUkuran file: ${readableSize(stat.size)}`,
            });
            return;
          }

          const mediaType = getMediaType(mode);
          const fileBuffer = fs.readFileSync(outputFilePath);
          const baseName = path.basename(
            outputFilePath,
            path.extname(outputFilePath),
          );
          const fileName = makeOutputFileName(baseName, mode);

          const payload = {
            mimetype: mediaType.mimetype,
            fileName,
            caption: `Selesai. Ukuran: ${readableSize(stat.size)}`,
          };

          payload[mediaType.messageType] = fileBuffer;

          await socket.sendMessage(targetJid, payload, {
            quoted: message,
          });
        } catch (error) {
          logger.error(`Downloader failed: ${error.stack || error.message}`);
          await socket.sendMessage(targetJid, {
            text: responses.downloadFailed || "Gagal memproses download",
          });
        } finally {
          if (outputFilePath && fs.existsSync(outputFilePath)) {
            fs.unlinkSync(outputFilePath);
          }
        }
      },
    },
  ],
};
