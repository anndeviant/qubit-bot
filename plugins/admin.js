const {
  isOwnerFromMessage,
  getSenderJid,
  getSenderCandidates,
} = require("../core/utils");

function isOwner(config, message) {
  return isOwnerFromMessage(config, message);
}

const HELP_CATEGORY_ORDER = ["General", "Owner", "Downloader", "Info", "Other"];

function normalizeHelpEntries(command) {
  const fallbackDescription = command.description || "No description";
  const rawEntries = Array.isArray(command.helpEntries)
    ? command.helpEntries
    : [command.name];

  return rawEntries
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          name: entry,
          description: fallbackDescription,
        };
      }

      return {
        name: entry?.name,
        description: entry?.description || fallbackDescription,
      };
    })
    .filter((entry) => entry.name);
}

module.exports = {
  name: "admin",
  commands: [
    {
      name: "ping",
      category: "General",
      description: "Cek status bot",
      async execute({ socket, message }) {
        await socket.sendMessage(message.key.remoteJid, {
          text: "Pong! Bot aktif.",
        });
      },
    },
    {
      name: "help",
      category: "General",
      description: "Lihat daftar command",
      async execute({ socket, message, commandMap, config }) {
        const sectionMap = new Map();

        for (const cmd of commandMap.values()) {
          const category = cmd.category || "Other";
          const lines = normalizeHelpEntries(cmd).map(
            (entry) => `${config.prefix}${entry.name} - ${entry.description}`,
          );

          if (!sectionMap.has(category)) {
            sectionMap.set(category, []);
          }

          sectionMap.get(category).push(...lines);
        }

        const categories = Array.from(sectionMap.keys()).sort((a, b) => {
          const indexA = HELP_CATEGORY_ORDER.indexOf(a);
          const indexB = HELP_CATEGORY_ORDER.indexOf(b);
          const rankA = indexA === -1 ? 999 : indexA;
          const rankB = indexB === -1 ? 999 : indexB;

          if (rankA !== rankB) {
            return rankA - rankB;
          }

          return a.localeCompare(b);
        });

        const commands = categories
          .map((category) => {
            const lines = sectionMap.get(category) || [];
            return `*[${category}]*\n${lines.join("\n")}`;
          })
          .join("\n\n");

        await socket.sendMessage(message.key.remoteJid, {
          text: `${commands}`,
        });
      },
    },
    {
      name: "owner",
      category: "Owner",
      description: "Cek owner",
      async execute({ socket, message, config, responses, logger }) {
        const allowed = isOwner(config, message);
        const senderJid = getSenderJid(message);
        const senderCandidates = getSenderCandidates(message).join(", ");
        logger.info(
          `Owner check sender: ${senderJid} | candidates: [${senderCandidates}] => ${allowed}`,
        );
        await socket.sendMessage(message.key.remoteJid, {
          text: allowed
            ? "Ya, Anda owner."
            : responses.notOwner || "Bukan owner",
        });
      },
    },
  ],
};
