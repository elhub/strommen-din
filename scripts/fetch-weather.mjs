// Fetches hourly temperature history (Open-Meteo archive) and forecast (api.met.no) per price area.
import { readFile, writeFile } from "node:fs/promises";

const CITIES = {
  NO1: { name: "Oslo", lat: 59.91, lon: 10.75 },
  NO2: { name: "Kristiansand", lat: 58.15, lon: 8.0 },
  NO3: { name: "Trondheim", lat: 63.43, lon: 10.39 },
  NO4: { name: "Tromsø", lat: 69.65, lon: 18.96 },
  NO5: { name: "Bergen", lat: 60.39, lon: 5.32 },
};
const UA = "stromstad-gruppe-6-hackathon/0.1 github.com/elhub";

const { hours } = JSON.parse(await readFile("src/data/price-areas.json", "utf8"));
const start = hours[0].slice(0, 10);
const end = hours.at(-1).slice(0, 10);

const out = { cities: CITIES, history: {}, wind: {}, radiation: {}, forecast: {} };
for (const [area, c] of Object.entries(CITIES)) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lon}&start_date=${start}&end_date=${end}&hourly=temperature_2m,wind_speed_100m,shortwave_radiation&wind_speed_unit=ms&timezone=UTC`;
  const h = await (await fetch(url)).json();
  const idx = Object.fromEntries(h.hourly.time.map((t, i) => [t + ":00Z", i]));
  const pick = (key) =>
    hours.map((t) => h.hourly[key][idx[new Date(t).toISOString().slice(0, 17) + "00Z"]] ?? null);
  out.history[area] = pick("temperature_2m");
  out.wind[area] = pick("wind_speed_100m");
  out.radiation[area] = pick("shortwave_radiation");

  const f = await (
    await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c.lat}&lon=${c.lon}`, {
      headers: { "User-Agent": UA },
    })
  ).json();
  out.forecast[area] = f.properties.timeseries
    .slice(0, 72)
    .map((s) => ({ time: s.time, temp: s.data.instant.details.air_temperature }));
  console.log(area, c.name, "ok");
}
await writeFile("src/data/weather.json", JSON.stringify(out));
