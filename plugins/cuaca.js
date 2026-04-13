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

function weatherCodeToText(code) {
  const map = {
    0: "Cerah",
    1: "Cerah berawan",
    2: "Berawan",
    3: "Mendung",
    45: "Kabut",
    48: "Kabut tebal",
    51: "Gerimis ringan",
    53: "Gerimis sedang",
    55: "Gerimis lebat",
    56: "Gerimis beku ringan",
    57: "Gerimis beku lebat",
    61: "Hujan ringan",
    63: "Hujan sedang",
    65: "Hujan lebat",
    66: "Hujan beku ringan",
    67: "Hujan beku lebat",
    71: "Salju ringan",
    73: "Salju sedang",
    75: "Salju lebat",
    77: "Butiran salju",
    80: "Hujan lokal ringan",
    81: "Hujan lokal sedang",
    82: "Hujan lokal lebat",
    85: "Salju lokal ringan",
    86: "Salju lokal lebat",
    95: "Badai petir",
    96: "Badai petir + hujan es ringan",
    99: "Badai petir + hujan es lebat",
  };

  return map[code] || "Tidak diketahui";
}

module.exports = {
  name: "cuaca",
  commands: [
    {
      name: "cuaca",
      category: "Info",
      description: "Cek, cth. .cuaca Bandung",
      async execute({ socket, message, args }) {
        const targetJid = message.key.remoteJid;
        const city = (args.join(" ") || "Jakarta").trim();

        try {
          const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id&format=json`;
          const geoData = await fetchJson(geoUrl);
          const place = Array.isArray(geoData?.results)
            ? geoData.results[0]
            : null;

          if (!place) {
            await socket.sendMessage(targetJid, {
              text: `Kota "${city}" tidak ditemukan.`,
            });
            return;
          }

          const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
            `&daily=temperature_2m_max,temperature_2m_min` +
            `&timezone=Asia%2FJakarta`;
          const weatherData = await fetchJson(weatherUrl);

          const current = weatherData?.current;
          const daily = weatherData?.daily;

          if (!current || !daily) {
            await socket.sendMessage(targetJid, {
              text: "Data cuaca tidak tersedia saat ini.",
            });
            return;
          }

          const maxTemp = Array.isArray(daily.temperature_2m_max)
            ? daily.temperature_2m_max[0]
            : null;
          const minTemp = Array.isArray(daily.temperature_2m_min)
            ? daily.temperature_2m_min[0]
            : null;

          const text =
            `Cuaca - ${place.name}, ${place.country}\n` +
            `Kondisi: ${weatherCodeToText(current.weather_code)}\n` +
            `Suhu: ${current.temperature_2m}°C (terasa ${current.apparent_temperature}°C)\n` +
            `Kelembapan: ${current.relative_humidity_2m}%\n` +
            `Angin: ${current.wind_speed_10m} km/j\n` +
            `Min/Max hari ini: ${minTemp ?? "-"}°C / ${maxTemp ?? "-"}°C`;

          await socket.sendMessage(targetJid, { text });
        } catch (error) {
          await socket.sendMessage(targetJid, {
            text: "Gagal mengambil data cuaca. Coba lagi beberapa saat.",
          });
        }
      },
    },
  ],
};
