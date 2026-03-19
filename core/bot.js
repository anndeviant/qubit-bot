require("dotenv").config();

const fs = require("fs");
const path = require("path");
const makeWASocket = require("@whiskeysockets/baileys").default;
const qrcode = require("qrcode-terminal");
const logger = require("./logger");
const {
  loadConfig,
  loadCustomResponses,
  loadPluginsConfig,
} = require("./configManager");
const { createSession } = require("./sessionManager");
const { loadPlugins } = require("./pluginManager");
const { handleIncomingMessage } = require("./commandHandler");

async function start() {
  const config = loadConfig();
  const responses = loadCustomResponses();
  const pluginsConfig = loadPluginsConfig();

  fs.mkdirSync(path.resolve(process.cwd(), config.downloadsPath), {
    recursive: true,
  });

  const { state, saveCreds, version } = await createSession(config.sessionPath);

  const socket = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ module: "baileys" }),
  });

  const commandMap = loadPlugins(pluginsConfig);

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info("QR generated. Scan dari WhatsApp untuk login.");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.message || "unknown";
      logger.warn(`Connection closed: ${reason}. Reconnecting...`);
      start().catch((error) => logger.error(error));
      return;
    }

    if (connection === "open") {
      logger.info("WhatsApp bot connected.");
    }
  });

  socket.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages?.[0];
    if (!message || message.key.fromMe) {
      return;
    }

    await handleIncomingMessage({
      socket,
      message,
      commandMap,
      config,
      responses,
      logger,
    });
  });
}

start().catch((error) => {
  logger.error(`Fatal error: ${error.stack || error.message}`);
});
