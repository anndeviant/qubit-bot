const { isOwnerFromMessage, isUrl } = require("./utils");

function isOwner(config, message) {
  return isOwnerFromMessage(config, message);
}

function unwrapMessageContent(content) {
  if (!content || typeof content !== "object") {
    return content;
  }

  if (content.ephemeralMessage?.message) {
    return unwrapMessageContent(content.ephemeralMessage.message);
  }

  if (content.viewOnceMessage?.message) {
    return unwrapMessageContent(content.viewOnceMessage.message);
  }

  if (content.viewOnceMessageV2?.message) {
    return unwrapMessageContent(content.viewOnceMessageV2.message);
  }

  if (content.documentWithCaptionMessage?.message) {
    return unwrapMessageContent(content.documentWithCaptionMessage.message);
  }

  return content;
}

function extractTextFromMessage(content) {
  const msg = unwrapMessageContent(content);
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

function getContextInfo(content) {
  const msg = unwrapMessageContent(content);
  if (!msg || typeof msg !== "object") {
    return null;
  }

  return (
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.documentMessage?.contextInfo ||
    msg.stickerMessage?.contextInfo ||
    null
  );
}

function findFirstUrl(text) {
  if (!text) {
    return null;
  }

  const matches = String(text).match(/https?:\/\/[^\s<>\"]+/gi) || [];
  return matches.find((item) => isUrl(item)) || null;
}

async function tryAutoDownloadFromStickerReply({
  socket,
  message,
  commandMap,
  config,
  responses,
  logger,
}) {
  if (!isOwner(config, message)) {
    return false;
  }

  const msg = unwrapMessageContent(message.message);
  if (!msg?.stickerMessage) {
    return false;
  }

  const contextInfo = getContextInfo(msg);
  const quotedMessage = contextInfo?.quotedMessage;
  if (!quotedMessage) {
    return false;
  }

  const quotedText = extractTextFromMessage(quotedMessage);
  const url = findFirstUrl(quotedText);
  if (!url) {
    return false;
  }

  const downloaderCommand = commandMap.get("video") || commandMap.get("dl");
  if (!downloaderCommand || typeof downloaderCommand.execute !== "function") {
    logger.warn("Auto downloader skipped: video command not available.");
    return false;
  }

  await downloaderCommand.execute({
    socket,
    message,
    args: [url],
    config,
    responses,
    commandMap,
    logger,
  });

  return true;
}

async function handleIncomingMessage({
  socket,
  message,
  commandMap,
  config,
  responses,
  logger,
}) {
  const msg = message.message;
  if (!msg) {
    return;
  }

  const handledByAutoDownload = await tryAutoDownloadFromStickerReply({
    socket,
    message,
    commandMap,
    config,
    responses,
    logger,
  });
  if (handledByAutoDownload) {
    return;
  }

  const text = extractTextFromMessage(msg);

  if (!text || !text.startsWith(config.prefix)) {
    return;
  }

  const [name, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = (name || "").toLowerCase();
  const command = commandMap.get(commandName);

  if (!command) {
    await socket.sendMessage(message.key.remoteJid, {
      text: responses.unknownCommand || "Unknown command",
    });
    return;
  }

  const context = {
    socket,
    message,
    args,
    config,
    responses,
    commandMap,
    logger,
  };

  try {
    await command.execute(context);
  } catch (error) {
    logger.error(
      `Command ${commandName} error: ${error.stack || error.message}`,
    );
    await socket.sendMessage(message.key.remoteJid, {
      text: "Terjadi error saat menjalankan command.",
    });
  }
}

module.exports = {
  handleIncomingMessage,
};
