const fs = require("fs");
const path = require("path");
const {
  runYtDlp,
  getYtDlpTitle,
  getYtDlpInfo,
  getMediaType,
  readableSize,
  makeOutputFileName,
  extractMediaTitle,
} = require("../core/downloader");
const { isUrl } = require("../core/utils");

function isYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "youtu.be" || host.endsWith("youtube.com");
  } catch (error) {
    return false;
  }
}

function isTikTokUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().includes("tiktok.com");
  } catch (error) {
    return false;
  }
}

module.exports = {
  name: "audio",
  commands: [
    {
      name: "audio",
      category: "Downloader",
      helpEntries: [
        {
          name: "audio",
          description: "Audio (Player)",
        },
        {
          name: "audio file",
          description: "Dokumen Audio MP3",
        },
      ],
      description: "Downloader Audio",
      async execute({ socket, message, args, config, responses, logger }) {
        const targetJid = message.key.remoteJid;
        const wantsDocument = String(args[0] || "").toLowerCase() === "file";
        const url = wantsDocument ? args[1] : args[0];
        const mode = "audio";

        if (!url || !isUrl(url)) {
          await socket.sendMessage(targetJid, {
            text: `Format salah. Contoh:\n${config.prefix}audio <url>\n${config.prefix}audio file <url>`,
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
          const isTikTok = isTikTokUrl(url);
          const isYoutube = isYouTubeUrl(url);
          const youtubeTitle = isYoutube
            ? await getYtDlpTitle({ ytDlpBin: config.ytDlpBin, url })
            : null;
          const tiktokInfo = isTikTok
            ? await getYtDlpInfo({ ytDlpBin: config.ytDlpBin, url }).catch(
                () => null,
              )
            : null;
          const tiktokDesc = String(
            tiktokInfo?.title || tiktokInfo?.description || "",
          ).trim();

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
          const title =
            tiktokDesc || youtubeTitle || extractMediaTitle(baseName);
          const fileName = makeOutputFileName(title, mode);
          const titleLabel = isTikTok ? "Desc" : "Judul";

          const payload = {
            mimetype: mediaType.mimetype,
            fileName,
            caption: `${titleLabel}: ${title}\nSelesai. Ukuran: ${readableSize(stat.size)}`,
          };

          if (wantsDocument) {
            payload.document = fileBuffer;
          } else {
            payload[mediaType.messageType] = fileBuffer;
            payload.ptt = false;
          }

          const sentAudioMessage = await socket.sendMessage(
            targetJid,
            payload,
            {
              quoted: message,
            },
          );

          if (isYoutube && !wantsDocument) {
            await socket.sendMessage(
              targetJid,
              {
                text: `Title: ${title}`,
              },
              { quoted: sentAudioMessage || message },
            );
          }
        } catch (error) {
          logger.error(
            `Audio downloader failed: ${error.stack || error.message}`,
          );
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
