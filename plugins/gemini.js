const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const MAX_INLINE_BYTES = 8 * 1024 * 1024;
const WA_TEXT_CHUNK_SIZE = 3500;

const CUSTOM_INSTRUCTION =
  "Berikan penjelasan dengan singkat, padat, dan jelas. Komunikasi layaknya ngobrol sama teman dan gen z, serta boleh menggunakan bahasa aku or kamu. Gunakan bahasa Indonesia yang natural dan mudah dipahami. Jangan gunakan emoji. Jangan gunakan bullet list dengan simbol strip. Kalau perlu membuat daftar, gunakan penomoran 1. 2. 3. Jelaskan langkah secara runtut dan berikan contoh praktis jika relevan. Format kata jika menggunakan arteri diulis 1 arteris saja di awal dan diakhir, contohnya *contoh* bukan **contoh**";

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
    msg.audioMessage?.contextInfo ||
    null
  );
}

function pickMediaFromMessage(content) {
  const msg = unwrapMessageContent(content);
  if (!msg || typeof msg !== "object") {
    return null;
  }

  if (msg.imageMessage) {
    return {
      media: msg.imageMessage,
      type: "image",
      mimeType: msg.imageMessage.mimetype || "image/jpeg",
    };
  }

  if (msg.videoMessage) {
    return {
      media: msg.videoMessage,
      type: "video",
      mimeType: msg.videoMessage.mimetype || "video/mp4",
    };
  }

  if (msg.audioMessage) {
    return {
      media: msg.audioMessage,
      type: "audio",
      mimeType: msg.audioMessage.mimetype || "audio/mpeg",
    };
  }

  if (msg.documentMessage) {
    return {
      media: msg.documentMessage,
      type: "document",
      mimeType: msg.documentMessage.mimetype || "application/octet-stream",
    };
  }

  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadMediaBuffer(mediaSelection) {
  if (!mediaSelection) {
    return null;
  }

  const stream = await downloadContentFromMessage(
    mediaSelection.media,
    mediaSelection.type,
  );
  const data = await streamToBuffer(stream);

  return {
    data,
    mimeType: mediaSelection.mimeType,
  };
}

async function callGemini({ apiKey, prompt, media }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const userParts = [{ text: prompt }];
  if (media) {
    userParts.push({
      inline_data: {
        mime_type: media.mimeType,
        data: media.data.toString("base64"),
      },
    });
  }

  const body = {
    system_instruction: {
      parts: [{ text: CUSTOM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1200,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const finishReason = json?.candidates?.[0]?.finishReason || "";
  const text = parts
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini tidak mengembalikan jawaban teks.");
  }

  return {
    text,
    finishReason,
  };
}

function splitTextIntoChunks(text, size = WA_TEXT_CHUNK_SIZE) {
  const chunks = [];
  const input = String(text || "").trim();
  if (!input) {
    return chunks;
  }

  let rest = input;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) {
      cut = rest.lastIndexOf(" ", size);
    }
    if (cut < size * 0.5) {
      cut = size;
    }

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) {
    chunks.push(rest);
  }

  return chunks;
}

async function sendLongText({ socket, jid, text }) {
  const chunks = splitTextIntoChunks(text);
  for (let i = 0; i < chunks.length; i += 1) {
    const prefix =
      chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}]\n` : "";
    await socket.sendMessage(jid, {
      text: `${prefix}${chunks[i]}`,
    });
  }
}

module.exports = {
  name: "gemini",
  commands: [
    {
      name: "gemini",
      category: "AI",
      helpEntries: [
        {
          name: "gemini <pertanyaan>",
          description: "Tanya ke Gemini 2.5 Flash",
        },
        {
          name: "gemini <pertanyaan> (reply file)",
          description: "Tanya Gemini dengan menganalisis file yang direply",
        },
      ],
      description: "Tanya Gemini 2.5 Flash dengan teks atau file",
      async execute({ socket, message, args, config, logger }) {
        const targetJid = message.key.remoteJid;
        const apiKey = process.env.GEMINI_API_KEY;
        const prompt = args.join(" ").trim();

        if (!apiKey) {
          await socket.sendMessage(targetJid, {
            text: "GEMINI_API_KEY belum diatur di .env.",
          });
          return;
        }

        const msg = unwrapMessageContent(message.message);
        const contextInfo = getContextInfo(msg);
        const quotedMessage = contextInfo?.quotedMessage;

        const ownMedia = pickMediaFromMessage(msg);
        const quotedMedia = pickMediaFromMessage(quotedMessage);
        const mediaSelection = ownMedia || quotedMedia;

        if (!prompt && !mediaSelection) {
          await socket.sendMessage(targetJid, {
            text: `Format salah. Contoh: ${config.prefix}gemini Jelaskan singkat apa itu blockchain`,
          });
          return;
        }

        let mediaPayload = null;
        if (mediaSelection) {
          try {
            mediaPayload = await downloadMediaBuffer(mediaSelection);
          } catch (error) {
            logger.error(
              `Gemini media download failed: ${error.stack || error.message}`,
            );
            await socket.sendMessage(targetJid, {
              text: "Gagal membaca file attachment/reply untuk dianalisis.",
            });
            return;
          }

          if (mediaPayload.data.length > MAX_INLINE_BYTES) {
            await socket.sendMessage(targetJid, {
              text: "Ukuran file terlalu besar untuk dianalisis Gemini. Maksimal sekitar 8 MB.",
            });
            return;
          }
        }

        await socket.sendMessage(targetJid, {
          text: "Sedang mikir, bentar ya...",
        });

        try {
          const ask = prompt || "Tolong jelaskan isi file ini secara jelas.";
          const first = await callGemini({
            apiKey,
            prompt: ask,
            media: mediaPayload,
          });
          let finalText = first.text;

          if (first.finishReason === "MAX_TOKENS") {
            const continuationPrompt =
              "Lanjutkan jawaban sebelumnya dari titik terakhir tanpa mengulang bagian awal. " +
              `Pertanyaan awal: ${ask}\n\n` +
              `Potongan terakhir jawaban sebelumnya:\n${first.text.slice(-600)}`;

            const second = await callGemini({
              apiKey,
              prompt: continuationPrompt,
              media: null,
            });

            finalText = `${first.text}\n\n${second.text}`.trim();
          }

          await sendLongText({
            socket,
            jid: targetJid,
            text: finalText,
          });
        } catch (error) {
          logger.error(
            `Gemini command failed: ${error.stack || error.message}`,
          );
          await socket.sendMessage(targetJid, {
            text: "Gagal mendapatkan jawaban dari Gemini. Coba lagi beberapa saat.",
          });
        }
      },
    },
  ],
};
