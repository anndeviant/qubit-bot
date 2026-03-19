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
const { getSenderJid, stripNumberFromJid } = require("./utils");
const { createSession } = require("./sessionManager");
const { loadPlugins } = require("./pluginManager");
const { handleIncomingMessage } = require("./commandHandler");

function extractIncomingText(messageContent) {
  if (!messageContent || typeof messageContent !== "object") {
    return "";
  }

  const unwrap = (content) => {
    if (!content || typeof content !== "object") {
      return content;
    }

    if (content.ephemeralMessage?.message) {
      return unwrap(content.ephemeralMessage.message);
    }

    if (content.viewOnceMessage?.message) {
      return unwrap(content.viewOnceMessage.message);
    }

    if (content.viewOnceMessageV2?.message) {
      return unwrap(content.viewOnceMessageV2.message);
    }

    if (content.documentWithCaptionMessage?.message) {
      return unwrap(content.documentWithCaptionMessage.message);
    }

    return content;
  };

  const msg = unwrap(messageContent);
  if (!msg || typeof msg !== "object") {
    return "";
  }

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    ""
  );
}

function truncateText(value, maxLen = 140) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "(non-text message)";
  }

  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

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

    const senderJid = getSenderJid(message) || "unknown";
    const senderId = stripNumberFromJid(senderJid) || senderJid;
    const isGroup = Boolean((message.key.remoteJid || "").endsWith("@g.us"));
    const chatType = isGroup ? "group" : "private";
    const incomingText = truncateText(extractIncomingText(message.message));

    logger.info(
      `[INCOMING] from=${senderId} type=${chatType} text="${incomingText}"`,
    );

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
