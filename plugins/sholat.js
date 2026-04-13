async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "WhatsAppBot/1.0 (Node.js)",
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
  name: "sholat",
  commands: [
    {
      name: "sholat",
      category: "Info",
      description: "Jadwal sholat kota Indonesia.",
      async execute({ socket, message, args }) {
        const targetJid = message.key.remoteJid;
        const city = (args.join(" ") || "Jakarta").trim();

        try {
          const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Indonesia&method=11`;
          const data = await fetchJson(url);

          if (data?.code !== 200 || !data?.data?.timings) {
            await socket.sendMessage(targetJid, {
              text: `Jadwal sholat untuk kota "${city}" tidak ditemukan.`,
            });
            return;
          }

          const timings = data.data.timings;
          const date = data.data.date?.readable || "-";

          const text =
            `Jadwal sholat - ${city}\n` +
            `Tanggal: ${date}\n` +
            `Imsak: ${timings.Imsak}\n` +
            `Subuh: ${timings.Fajr}\n` +
            `Dzuhur: ${timings.Dhuhr}\n` +
            `Ashar: ${timings.Asr}\n` +
            `Maghrib: ${timings.Maghrib}\n` +
            `Isya: ${timings.Isha}`;

          await socket.sendMessage(targetJid, { text });
        } catch (error) {
          await socket.sendMessage(targetJid, {
            text: "Gagal mengambil jadwal sholat. Coba lagi beberapa saat.",
          });
        }
      },
    },
  ],
};
