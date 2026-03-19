const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  prefix: "!",
  ownerNumbers: [],
  maxDownloadSizeMb: 60,
  sessionPath: "session",
  downloadsPath: "downloads",
  ytDlpBin: "yt-dlp",
  ffmpegBin: "ffmpeg",
};

function loadJson(jsonPath) {
  const fullPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

function loadConfig() {
  const dataConfigPath = path.join(__dirname, "data", "config.json");
  const fileConfig = loadJson(dataConfigPath) || {};

  return {
    ...DEFAULTS,
    ...fileConfig,
    prefix: process.env.BOT_PREFIX || fileConfig.prefix || DEFAULTS.prefix,
    ownerNumbers: process.env.OWNER_NUMBERS
      ? process.env.OWNER_NUMBERS.split(",")
          .map((n) => n.trim())
          .filter(Boolean)
      : fileConfig.ownerNumbers || DEFAULTS.ownerNumbers,
    ytDlpBin: process.env.YTDLP_BIN || fileConfig.ytDlpBin || DEFAULTS.ytDlpBin,
    ffmpegBin:
      process.env.FFMPEG_BIN || fileConfig.ffmpegBin || DEFAULTS.ffmpegBin,
  };
}

function loadCustomResponses() {
  const jsonPath = path.join(__dirname, "data", "customResponses.json");
  return loadJson(jsonPath) || {};
}

function loadPluginsConfig() {
  const jsonPath = path.join(__dirname, "data", "plugins.json");
  return loadJson(jsonPath) || { enabled: [] };
}

module.exports = {
  loadConfig,
  loadCustomResponses,
  loadPluginsConfig,
};
