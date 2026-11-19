// Downloads Norwegian price-area boundaries and writes simplified SVG paths to src/data/norway.json.
import { writeFile } from "node:fs/promises";

const url = (i) => `https://raw.githubusercontent.com/EnergieID/entsoe-py/master/entsoe/geo/geojson/NO_${i}.geojson`;
const W = 400;
const LON0 = 15; // UTM zone 33 central meridian, as used on Norwegian maps

// Spherical transverse Mercator: true shape, no inflated north.
const tm = (lon, lat) => {
  const φ = (lat * Math.PI) / 180;
  const dλ = ((lon - LON0) * Math.PI) / 180;
  const B = Math.cos(φ) * Math.sin(dλ);
  return [0.5 * Math.log((1 + B) / (1 - B)), Math.atan2(Math.tan(φ), Math.cos(dλ))];
};

const polysByArea = {};
for (const i of [1, 2, 3, 4, 5]) {
  const res = await fetch(url(i), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} for NO${i}`);
  const gj = await res.json();
  const geoms = (gj.features ?? [gj]).map((f) => f.geometry ?? f);
  polysByArea[`NO${i}`] = geoms.flatMap((g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates)).map((p) => p[0].map(([lon, lat]) => tm(lon, lat)));
}

const all = Object.values(polysByArea).flat(2);
const minX = Math.min(...all.map((p) => p[0]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const maxY = Math.max(...all.map((p) => p[1]));
const scale = W / (maxX - minX);
const H = Math.round((maxY - minY) * scale);

function ringToPath(ring) {
  const pts = [];
  let last = null;
  for (const [x, y] of ring) {
    const p = [Math.round((x - minX) * scale * 10) / 10, Math.round((maxY - y) * scale * 10) / 10];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.8) continue;
    pts.push(p);
    last = p;
  }
  if (pts.length < 4) return "";
  return "M" + pts.map((p) => p.join(",")).join("L") + "Z";
}

const paths = Object.fromEntries(Object.entries(polysByArea).map(([a, rings]) => [a, rings.map(ringToPath).filter(Boolean).join("")]));
await writeFile("src/data/norway.json", JSON.stringify({ width: W, height: H, lon0: LON0, minX, maxY, scale, paths }));
console.log(`map ${W}x${H}`);
