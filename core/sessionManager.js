const path = require("path");
const fs = require("fs");
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

async function createSession(sessionPath) {
  const fullSessionPath = path.resolve(process.cwd(), sessionPath);
  fs.mkdirSync(fullSessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(fullSessionPath);
  const { version } = await fetchLatestBaileysVersion();

  return {
    state,
    saveCreds,
    version,
    fullSessionPath,
  };
}

module.exports = {
  createSession,
};
