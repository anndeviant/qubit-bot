function toNumber(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(value);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Qubit/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  name: "kurs",
  commands: [
    {
      name: "kurs",
      category: "Info",
      helpEntries: [
        {
          name: "kurs [kurs]",
          description: "Kurs to IDR, cth. !kurs usd",
        },
        {
          name: "kurs [kurs1] [kurs2] 100",
          description: "Konversi, !kurs usd idr 100",
        },
      ],
      description: "Cek kurs mata uang via Frankfurter API",
      async execute({ socket, message, args, config }) {
        const targetJid = message.key.remoteJid;

        const from = String(args[0] || "USD").toUpperCase();
        const to = String(args[1] || "IDR").toUpperCase();
        const amount = toNumber(args[2], 1);

        if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
          await socket.sendMessage(targetJid, {
            text: `Format salah. Contoh:\n${config.prefix}kurs usd\n${config.prefix}kurs usd idr 100`,
          });
          return;
        }

        try {
          const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
          const data = await fetchJson(url);

          const value = data?.rates?.[to];
          if (!Number.isFinite(value)) {
            await socket.sendMessage(targetJid, {
              text: `Data kurs ${from} ke ${to} tidak tersedia.`,
            });
            return;
          }

          const text =
            `Kurs ${from} ke ${to}\n` +
            `Tanggal: ${data.date || "-"}\n` +
            `${formatNumber(amount)} ${from} = ${formatNumber(value)} ${to}`;

          await socket.sendMessage(targetJid, { text });
        } catch (error) {
          await socket.sendMessage(targetJid, {
            text: "Gagal mengambil data kurs. Coba lagi beberapa saat.",
          });
        }
      },
    },
  ],
};
