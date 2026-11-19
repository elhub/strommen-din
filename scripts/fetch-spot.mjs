// Fetches day-ahead spot prices (NOK/kWh) per price area from hvakosterstrommen.no, averaged to hourly.
import { readFile, writeFile } from "node:fs/promises";

const { hours } = JSON.parse(await readFile("src/data/price-areas.json", "utf8"));
const dates = [...new Set(hours.map((t) => t.slice(0, 10)))];
const AREAS = ["NO1", "NO2", "NO3", "NO4", "NO5"];

const out = {};
const jobs = AREAS.flatMap((a) => dates.map((d) => [a, d]));
const byKey = {};
const worker = async () => {
  while (jobs.length) {
    const [a, d] = jobs.shift();
    const [y, m, dd] = d.split("-");
    const res = await fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${dd}_${a}.json`);
    if (!res.ok) continue;
    for (const p of await res.json()) {
      const k = `${a}|${p.time_start.slice(0, 13)}`;
      (byKey[k] ??= []).push(p.NOK_per_kWh);
    }
  }
};
await Promise.all(Array.from({ length: 6 }, worker));
for (const a of AREAS) {
  out[a] = hours.map((t) => {
    const v = byKey[`${a}|${t.slice(0, 13)}`];
    return v ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10000) / 10000 : null;
  });
  console.log(a, out[a].filter((x) => x == null).length, "missing");
}
await writeFile("src/data/spot.json", JSON.stringify(out));
