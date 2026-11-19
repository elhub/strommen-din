// Fetches public Elhub Energy Data API datasets and writes compact JSON to src/data/.
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://api.elhub.no/energy-data/v0";
const END = process.env.END ?? "2026-11-18"; // exclusive-ish; API data ends ~3 days behind
const DAYS = Number(process.env.DAYS ?? 90);
const GRID_DAYS = Number(process.env.GRID_DAYS ?? 30);
const CHUNK_DAYS = 7;

const day = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const endT = Date.parse(END);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(entity, dataset, start, end) {
  const url = `${BASE}/${entity}?dataset=${dataset}&startDate=${start}&endDate=${end}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    console.warn(`  ${res.status} for ${url}, retrying`);
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`Failed: ${url}`);
}

// Calls fn(row, entityId) for every row of the dataset across the chunked range.
async function forEachRow(entity, dataset, days, fn) {
  const key = dataset.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  for (let t = endT - days * day; t < endT; t += CHUNK_DAYS * day) {
    const s = iso(t);
    const e = iso(Math.min(t + CHUNK_DAYS * day, endT));
    console.log(`${dataset} ${s} -> ${e}`);
    const json = await get(entity, dataset, s, e);
    for (const d of json.data) for (const r of d.attributes[key] ?? []) fn(r, d);
    await sleep(250);
  }
}

const round = (n) => Math.round(n * 10) / 10;
const hourKeys = new Set();
const areas = {};
const area = (id) => (areas[id] ??= { cons: {}, prod: {}, exch: {}, np: {} });
const add = (obj, k, h, v) => ((obj[k] ??= {})[h] = (obj[k][h] ?? 0) + v);

await forEachRow("price-areas", "CONSUMPTION_PER_GROUP_MBA_HOUR", DAYS, (r) => {
  hourKeys.add(r.startTime);
  area(r.priceArea).cons[r.consumptionGroup] ??= {};
  area(r.priceArea).cons[r.consumptionGroup][r.startTime] = r.quantityKwh;
  (area(r.priceArea).cnt ??= {})[r.consumptionGroup] = r.meteringPointCount;
});

await forEachRow("price-areas", "PRODUCTION_PER_GROUP_MBA_HOUR", DAYS, (r) => {
  hourKeys.add(r.startTime);
  (area(r.priceArea).prod[r.productionGroup] ??= {})[r.startTime] = r.quantityKwh;
});

await forEachRow("price-areas", "EXCHANGE_PER_MBA_HOUR", DAYS, (r) => {
  const a = area(r.priceArea).exch;
  a[r.startTime] = (a[r.startTime] ?? 0) + r.exchangeOutQuantityKwh - r.exchangeInQuantityKwh;
});

// Norgespris: sum EAC ranges. Metering point counts are per hour, so sum over ranges too.
await forEachRow("price-areas", "NORGESPRIS_CONSUMPTION_PER_GROUP_EAC_MBA", DAYS, (r, d) => {
  const id = d.id;
  const np = area(id).np;
  const g = (np[r.consumptionGroup] ??= { kwhNp: {}, kwhOther: {}, cntNp: {}, cntOther: {} });
  const h = r.startTime;
  g.kwhNp[h] = (g.kwhNp[h] ?? 0) + r.quantityKwhNorwayPrice;
  g.kwhOther[h] = (g.kwhOther[h] ?? 0) + r.quantityKwhNotNorwayPrice;
  g.cntNp[h] = (g.cntNp[h] ?? 0) + r.meteringPointCountNorwayPrice;
  g.cntOther[h] = (g.cntOther[h] ?? 0) + r.meteringPointCountNotNorwayPrice;
});

const hours = [...hourKeys].sort();
const series = (m) => hours.map((h) => round(m?.[h] ?? 0));
const intSeries = (m) => hours.map((h) => m?.[h] ?? 0);

const out = { hours, areas: {} };
for (const [id, a] of Object.entries(areas)) {
  if (id === "*") continue;
  out.areas[id] = {
    cons: Object.fromEntries(Object.entries(a.cons).map(([g, m]) => [g, series(m)])),
    prod: Object.fromEntries(Object.entries(a.prod).map(([g, m]) => [g, series(m)])),
    exch: series(a.exch),
    np: Object.fromEntries(
      Object.entries(a.np).map(([g, v]) => [
        g,
        { kwhNp: series(v.kwhNp), kwhOther: series(v.kwhOther), cntNp: intSeries(v.cntNp), cntOther: intSeries(v.cntOther) },
      ]),
    ),
  };
}

await mkdir("src/data", { recursive: true });
await writeFile("src/data/price-areas.json", JSON.stringify(out));
console.log(`price-areas.json: ${hours.length} hours, ${Object.keys(out.areas).join(",")}`);

// Grid areas (DSOs): hourly consumption summed over groups, plus metering point counts.
const grids = {};
const gridHours = new Set();
await forEachRow("grid-areas", "CONSUMPTION_PER_GROUP_MGA_HOUR", GRID_DAYS, (r, d) => {
  gridHours.add(r.startTime);
  const g = (grids[d.id] ??= { name: d.attributes.name, eic: d.attributes.eic, kwh: {}, cnt: {}, groupKwh: {} });
  g.kwh[r.startTime] = (g.kwh[r.startTime] ?? 0) + r.quantityKwh;
  g.groupKwh[r.consumptionGroup] = (g.groupKwh[r.consumptionGroup] ?? 0) + r.quantityKwh;
  (g.cnt[r.startTime] ??= {})[r.consumptionGroup] = r.meteringPointCount;
});
const gh = [...gridHours].sort();
const gridOut = {
  hours: gh,
  grids: Object.values(grids)
    .filter((g) => Object.keys(g.kwh).length > 0)
    .map((g) => ({
      name: g.name,
      eic: g.eic,
      kwh: gh.map((h) => Math.round(g.kwh[h] ?? 0)),
      groupKwh: Object.fromEntries(Object.entries(g.groupKwh).map(([k, v]) => [k, Math.round(v)])),
      meteringPoints: Object.values(g.cnt.hasOwnProperty(gh[0]) ? g.cnt[gh[0]] : g.cnt[Object.keys(g.cnt)[0]]).reduce((a, b) => a + b, 0),
    })),
};
await writeFile("src/data/grid-areas.json", JSON.stringify(gridOut));
console.log(`grid-areas.json: ${gridOut.grids.length} grids, ${gh.length} hours`);
