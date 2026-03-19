const {
  isOwnerFromMessage,
  getSenderJid,
  getSenderCandidates,
} = require("../core/utils");

function isOwner(config, message) {
  return isOwnerFromMessage(config, message);
}

module.exports = {
  name: "admin",
  commands: [
    {
      name: "ping",
      description: "Cek status bot",
      async execute({ socket, message }) {
        await socket.sendMessage(message.key.remoteJid, {
          text: "Pong! Bot aktif.",
        });
      },
    },
    {
      name: "help",
      description: "Lihat daftar command",
      async execute({ socket, message, commandMap, config }) {
        const commands = Array.from(commandMap.values())
          .map(
            (cmd) =>
              `${config.prefix}${cmd.name} - ${cmd.description || "No description"}`,
          )
          .join("\n");

        await socket.sendMessage(message.key.remoteJid, {
          text: `Daftar command:\n${commands}`,
        });
      },
    },
    {
      name: "owner",
      description: "Cek apakah pengirim owner",
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
