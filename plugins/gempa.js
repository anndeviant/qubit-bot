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
  name: "gempa",
  commands: [
    {
      name: "gempa",
      category: "Info",
      description: "Info gempa terbaru BMKG",
      async execute({ socket, message, config }) {
        const targetJid = message.key.remoteJid;

        try {
          const data = await fetchJson(
            "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
          );

          const gempa = data?.Infogempa?.gempa;
          if (!gempa) {
            await socket.sendMessage(targetJid, {
              text: "Data gempa terbaru tidak tersedia saat ini.",
            });
            return;
          }

          const text =
            "Gempa Terbaru (BMKG)\n" +
            `Tanggal: ${gempa.Tanggal || "-"}\n` +
            `Jam: ${gempa.Jam || "-"}\n` +
            `Magnitude: ${gempa.Magnitude || "-"}\n` +
            `Kedalaman: ${gempa.Kedalaman || "-"}\n` +
            `Lokasi: ${gempa.Wilayah || "-"}\n` +
            `Koordinat: ${gempa.Coordinates || `${gempa.Lintang || "-"}, ${gempa.Bujur || "-"}`}\n` +
            `Potensi: ${gempa.Potensi || "-"}\n` +
            `Dirasakan: ${gempa.Dirasakan || "Tidak ada info"}`;

          const shakemap = String(gempa.Shakemap || "").trim();
          if (shakemap) {
            const mapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${shakemap}`;
            const mapResponse = await fetch(mapUrl, {
              method: "GET",
              headers: {
                "User-Agent": "Qubit/1.0",
              },
            });

            if (mapResponse.ok) {
              const mapBuffer = Buffer.from(await mapResponse.arrayBuffer());

              await socket.sendMessage(targetJid, {
                image: mapBuffer,
                mimetype: "image/jpeg",
                caption: text,
              });
              return;
            }
          }

          await socket.sendMessage(targetJid, { text });
        } catch (error) {
          await socket.sendMessage(targetJid, {
            text: "Gagal mengambil data gempa BMKG. Coba lagi beberapa saat.",
          });
        }
      },
    },
  ],
};
