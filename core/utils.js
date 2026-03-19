const path = require("path");

function ensureJid(jid) {
  return (jid || "").trim();
}

function stripNumberFromJid(jid) {
  return (ensureJid(jid).split("@")[0] || "").split(":")[0] || "";
}

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

function splitJid(jidOrNumber) {
  const cleaned = ensureJid(jidOrNumber);
  const [left = "", server = ""] = cleaned.split("@");
  const user = left.split(":")[0] || "";
  return {
    raw: cleaned,
    user,
    server,
  };
}

function isOwnerNumber(config, jidOrNumber) {
  const sender = normalizePhoneNumber(stripNumberFromJid(jidOrNumber));
  const owners = Array.isArray(config?.ownerNumbers)
    ? config.ownerNumbers.map(normalizePhoneNumber).filter(Boolean)
    : [];

  return Boolean(sender) && owners.includes(sender);
}

function getSenderJid(message) {
  const candidates = [
    message?.key?.participant,
    message?.participant,
    message?.key?.remoteJid,
  ];

  return candidates.find((item) => ensureJid(item)) || "";
}

function getSenderCandidates(message) {
  const candidates = [
    message?.key?.participant,
    message?.participant,
    message?.key?.remoteJid,
    message?.key?.participantAlt,
    message?.key?.remoteJidAlt,
    message?.key?.participantPn,
    message?.participantPn,
    message?.message?.extendedTextMessage?.contextInfo?.participant,
    message?.message?.extendedTextMessage?.contextInfo?.participantPn,
  ];

  const uniq = [];
  for (const item of candidates) {
    const value = ensureJid(item);
    if (value && !uniq.includes(value)) {
      uniq.push(value);
    }
  }

  return uniq;
}

function getOwnerEntries(config) {
  const rawEntries = Array.isArray(config?.ownerNumbers)
    ? config.ownerNumbers
    : [];

  const ownerJids = new Set();
  const ownerIds = new Set();
  const ownerPhones = new Set();

  for (const entry of rawEntries) {
    const value = ensureJid(entry);
    if (!value) {
      continue;
    }

    const parts = splitJid(value);
    if (parts.raw.includes("@")) {
      ownerJids.add(parts.raw);
    }

    if (parts.user) {
      ownerIds.add(parts.user);
      const normalizedPhone = normalizePhoneNumber(parts.user);
      if (normalizedPhone) {
        ownerPhones.add(normalizedPhone);
      }
    }

    const normalizedDirect = normalizePhoneNumber(value);
    if (normalizedDirect) {
      ownerPhones.add(normalizedDirect);
    }
  }

  return {
    ownerJids,
    ownerIds,
    ownerPhones,
  };
}

function isOwnerFromMessage(config, message) {
  const ownerEntries = getOwnerEntries(config);
  if (
    !ownerEntries.ownerJids.size &&
    !ownerEntries.ownerIds.size &&
    !ownerEntries.ownerPhones.size
  ) {
    return false;
  }

  const senderCandidates = getSenderCandidates(message);
  for (const candidate of senderCandidates) {
    const parts = splitJid(candidate);

    if (ownerEntries.ownerJids.has(parts.raw)) {
      return true;
    }

    if (parts.user && ownerEntries.ownerIds.has(parts.user)) {
      return true;
    }

    const normalizedPhone = normalizePhoneNumber(parts.user || parts.raw);
    if (normalizedPhone && ownerEntries.ownerPhones.has(normalizedPhone)) {
      return true;
    }
  }

  return false;
}

function isUrl(text) {
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function safeFileName(input) {
  const raw = String(input || "media")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\.\s]+$/g, "");

  return raw || "media";
}

function joinRoot(...parts) {
  return path.resolve(process.cwd(), ...parts);
}

module.exports = {
  ensureJid,
  stripNumberFromJid,
  normalizePhoneNumber,
  isOwnerNumber,
  getSenderJid,
  getSenderCandidates,
  isOwnerFromMessage,
  isUrl,
  safeFileName,
  joinRoot,
};
