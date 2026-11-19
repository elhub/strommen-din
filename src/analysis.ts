import price from "./data/price-areas.json";
import grid from "./data/grid-areas.json";
import weather from "./data/weather.json";
import spot from "./data/spot.json";

export const S = spot as Record<string, (number | null)[]>;

export type Area = "NO1" | "NO2" | "NO3" | "NO4" | "NO5";
export const AREAS: Area[] = ["NO1", "NO2", "NO3", "NO4", "NO5"];

type PriceData = {
  hours: string[];
  areas: Record<
    string,
    {
      cons: Record<string, number[]>;
      prod: Record<string, number[]>;
      exch: number[];
      np: Record<string, { kwhNp: number[]; kwhOther: number[]; cntNp: number[]; cntOther: number[] }>;
    }
  >;
};
type GridData = {
  hours: string[];
  grids: { name: string; eic: string; kwh: number[]; groupKwh: Record<string, number>; meteringPoints: number }[];
};
type WeatherData = {
  cities: Record<string, { name: string }>;
  history: Record<string, (number | null)[]>;
  wind: Record<string, (number | null)[]>;
  radiation: Record<string, (number | null)[]>;
  forecast: Record<string, { time: string; temp: number }[]>;
};

export const P = price as PriceData;
export const G = grid as GridData;
export const W = weather as WeatherData;

// Elhub timestamps carry the local Norwegian offset, so the string's hour is local time.
export const localHour = (t: string) => Number(t.slice(11, 13));
export const localDate = (t: string) => t.slice(0, 10);
const osloFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
export function osloParts(utc: string) {
  const p = Object.fromEntries(osloFmt.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const isWeekend = (date: string) => [0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay());

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
export const MWh = (kwh: number) => kwh / 1000;

export function totalConsumption(area: Area) {
  const c = P.areas[area].cons;
  return P.hours.map((_, i) => sum(Object.values(c).map((s) => s[i])));
}
export function totalProduction(area: Area) {
  const c = P.areas[area].prod;
  return P.hours.map((_, i) => sum(Object.values(c).map((s) => s[i])));
}

/** Peak-shaving analysis for a single hourly load series. */
export function peakShaving(kwh: number[], shavePct: number) {
  const peak = Math.max(...kwh);
  const cap = peak * (1 - shavePct / 100);
  const excess = kwh.map((v) => Math.max(0, v - cap));
  const hoursOver = excess.filter((e) => e > 0).length;
  // Longest contiguous run above cap = battery/flex duration needed.
  let run = 0,
    longest = 0,
    runEnergy = 0,
    maxRunEnergy = 0;
  for (const e of excess) {
    if (e > 0) {
      run++;
      runEnergy += e;
      longest = Math.max(longest, run);
      maxRunEnergy = Math.max(maxRunEnergy, runEnergy);
    } else {
      run = 0;
      runEnergy = 0;
    }
  }
  const avg = mean(kwh);
  return {
    peak,
    avg,
    loadFactor: avg / peak,
    cap,
    hoursOver,
    energyToShift: sum(excess),
    longestEvent: longest,
    maxEventEnergy: maxRunEnergy,
    capacityFreed: peak - cap,
  };
}

/** Average 24h profile, normalised to the daily mean (1.0 = average hour). */
export function dailyProfile(kwh: number[], hours: string[]) {
  const acc = Array.from({ length: 24 }, () => [] as number[]);
  hours.forEach((t, i) => acc[localHour(t)].push(kwh[i]));
  const prof = acc.map(mean);
  const m = mean(prof);
  return prof.map((v) => v / m);
}

export function correlation(a: (number | null)[], b: (number | null)[]) {
  const pairs = a.map((x, i) => [x, b[i]]).filter(([x, y]) => x != null && y != null) as number[][];
  const ma = mean(pairs.map((p) => p[0]));
  const mb = mean(pairs.map((p) => p[1]));
  let cov = 0,
    va = 0,
    vb = 0;
  for (const [x, y] of pairs) {
    cov += (x - ma) * (y - mb);
    va += (x - ma) ** 2;
    vb += (y - mb) ** 2;
  }
  return cov / Math.sqrt(va * vb || 1);
}

/** Daily energy balance + weather for one price area. */
export function dailyNexus(area: Area) {
  const cons = totalConsumption(area);
  const prod = totalProduction(area);
  const a = P.areas[area];
  const days = new Map<string, Record<string, number[]>>();
  P.hours.forEach((t, i) => {
    const d = localDate(t);
    const r = days.get(d) ?? { cons: [], prod: [], exch: [], hydro: [], wind: [], solar: [], temp: [], ws: [], rad: [], price: [] };
    if (S[area][i] != null) r.price.push(S[area][i] as number);
    r.cons.push(cons[i]);
    r.prod.push(prod[i]);
    r.exch.push(a.exch[i]);
    r.hydro.push(a.prod.hydro?.[i] ?? 0);
    r.wind.push(a.prod.wind?.[i] ?? 0);
    r.solar.push(a.prod.solar?.[i] ?? 0);
    if (W.history[area][i] != null) r.temp.push(W.history[area][i] as number);
    if (W.wind[area][i] != null) r.ws.push(W.wind[area][i] as number);
    if (W.radiation[area][i] != null) r.rad.push(W.radiation[area][i] as number);
    days.set(d, r);
  });
  return [...days.entries()]
    .filter(([, r]) => r.cons.length >= 23)
    .map(([date, r]) => ({
      date,
      consumption: MWh(sum(r.cons)),
      production: MWh(sum(r.prod)),
      netExport: MWh(sum(r.exch)),
      hydro: MWh(sum(r.hydro)),
      wind: MWh(sum(r.wind)),
      solar: MWh(sum(r.solar)),
      temp: mean(r.temp),
      windSpeed: mean(r.ws),
      radiation: mean(r.rad),
      price: mean(r.price),
      spread: Math.max(...r.price) - Math.min(...r.price),
    }));
}

/** Norgespris vs spot-price households: adoption and hourly price responsiveness. */
export function norgespris(area: Area, group = "household") {
  const g = P.areas[area].np[group];
  const price = S[area];
  const perNp = g.kwhNp.map((v, i) => v / (g.cntNp[i] || 1));
  const perOther = g.kwhOther.map((v, i) => v / (g.cntOther[i] || 1));
  // Normalise each hour to its day's mean so we compare shape, not level.
  const norm = (xs: number[]) => {
    const byDay = new Map<string, number[]>();
    P.hours.forEach((t, i) => byDay.set(localDate(t), [...(byDay.get(localDate(t)) ?? []), xs[i]]));
    const m = new Map([...byDay].map(([d, v]) => [d, mean(v)]));
    return xs.map((x, i) => x / (m.get(localDate(P.hours[i])) || 1));
  };
  const nNp = norm(perNp);
  const nOther = norm(perOther);
  const nPrice = norm(price.map((p) => p ?? 0));
  // Peak-price hours: top 15% of daily-normalised price.
  const thr = quantile(nPrice, 0.85);
  const peakIdx = nPrice.map((p, i) => (p >= thr ? i : -1)).filter((i) => i >= 0);
  const daily = new Map<string, { np: number; other: number; kwhNp: number; kwhOther: number }>();
  P.hours.forEach((t, i) => {
    if (localHour(t) !== 12) return;
    daily.set(localDate(t), { np: g.cntNp[i], other: g.cntOther[i], kwhNp: 0, kwhOther: 0 });
  });
  const profile = (xs: number[]) => {
    const acc = Array.from({ length: 24 }, () => [] as number[]);
    P.hours.forEach((t, i) => acc[localHour(t)].push(xs[i]));
    return acc.map(mean);
  };
  return {
    adoption: [...daily].map(([date, d]) => ({ date, share: (100 * d.np) / (d.np + d.other), np: d.np, other: d.other })),
    peakLoadNp: mean(peakIdx.map((i) => nNp[i])),
    peakLoadOther: mean(peakIdx.map((i) => nOther[i])),
    corrNp: correlation(nPrice, nNp),
    corrOther: correlation(nPrice, nOther),
    avgKwhNp: mean(perNp) * 24,
    avgKwhOther: mean(perOther) * 24,
    profileNp: profile(nNp),
    profileOther: profile(nOther),
    profilePrice: profile(nPrice),
  };
}

/** Average household: kWh per home per hour, alongside spot price. */
export function household(area: Area) {
  const g = P.areas[area].np.household;
  const homes = g.cntNp.map((n, i) => n + g.cntOther[i]);
  const kwh = P.areas[area].cons.household.map((v, i) => v / (homes[i] || 1));
  const price = S[area].map((p) => p ?? 0);
  const prof = Array.from({ length: 24 }, () => ({ kwh: [] as number[], price: [] as number[] }));
  P.hours.forEach((t, i) => {
    prof[localHour(t)].kwh.push(kwh[i]);
    prof[localHour(t)].price.push(price[i]);
  });
  const profile = prof.map((p, h) => ({ h, kwh: mean(p.kwh), price: mean(p.price) }));
  const days = P.hours.length / 24;
  const cost = sum(kwh.map((k, i) => k * price[i]));
  return { homes: homes.at(-1) ?? 0, profile, kwhPerDay: sum(kwh) / days, costPerDay: cost / days, avgPrice: cost / sum(kwh) };
}

/** Day × hour grid of per-home consumption, spot price and temperature. */
export function heatmap(area: Area) {
  const g = P.areas[area].np.household;
  const cons = P.areas[area].cons.household;
  const days = new Map<string, { kwh: number[]; price: number[]; temp: number[] }>();
  P.hours.forEach((t, i) => {
    const d = days.get(localDate(t)) ?? { kwh: Array(24).fill(NaN), price: Array(24).fill(NaN), temp: Array(24).fill(NaN) };
    const h = localHour(t);
    d.kwh[h] = cons[i] / ((g.cntNp[i] + g.cntOther[i]) || 1);
    d.price[h] = S[area][i] ?? NaN;
    d.temp[h] = W.history[area][i] ?? NaN;
    days.set(localDate(t), d);
  });
  return [...days.entries()].map(([date, d]) => ({ date, ...d }));
}

/** Headline numbers for every price area, for the comparison strip. */
export function overview() {
  return AREAS.map((a) => {
    const h = household(a);
    const n = dailyNexus(a);
    const g = P.areas[a].np.household;
    const last = g.cntNp.length - 13;
    return {
      area: a,
      kwhPerDay: h.kwhPerDay,
      costPerDay: h.costPerDay,
      avgPrice: h.avgPrice,
      temp: mean(n.map((x) => x.temp)),
      selfSufficiency: (100 * sum(n.map((x) => x.production))) / sum(n.map((x) => x.consumption)),
      npShare: (100 * g.cntNp[last]) / (g.cntNp[last] + g.cntOther[last]),
      spark: n.map((x) => x.price),
    };
  });
}

// ---- Temperature-driven consumption model (OLS) ----

function features(temp: number, hour: number, weekend: boolean) {
  const f = new Array(2 + 24 + 1).fill(0);
  f[0] = temp;
  f[1] = Math.max(0, 15 - temp); // heating degrees: heating kicks in below ~15C
  f[2 + hour] = 1; // hour-of-day intercepts (replaces global intercept)
  f[26] = weekend ? 1 : 0;
  return f;
}

function solve(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / d;
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-9));
}

function fit(X: number[][], y: number[]) {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k).fill(1e-6));
  const b = new Array(k).fill(0);
  X.forEach((x, n) => {
    for (let i = 0; i < k; i++) {
      b[i] += x[i] * y[n];
      for (let j = 0; j < k; j++) A[i][j] += x[i] * x[j];
    }
  });
  const w = solve(A, b);
  return (x: number[]) => x.reduce((s, v, i) => s + v * w[i], 0);
}

export function forecastModel(area: Area, group: string, testDays = 7) {
  const y = group === "total" ? totalConsumption(area) : P.areas[area].cons[group];
  const temps = W.history[area];
  const rows = P.hours
    .map((t, i) => ({ t, i, temp: temps[i], y: y[i] }))
    .filter((r) => r.temp != null && r.y > 0)
    .map((r) => ({ ...r, x: features(r.temp as number, localHour(r.t), isWeekend(localDate(r.t))) }));
  const split = rows.length - testDays * 24;
  const train = rows.slice(0, split);
  const test = rows.slice(split);
  const predict = fit(
    train.map((r) => r.x),
    train.map((r) => r.y),
  );
  const backtest = test.map((r) => ({ t: r.t, actual: r.y, predicted: predict(r.x), temp: r.temp as number }));
  const mape = mean(backtest.map((b) => Math.abs(b.actual - b.predicted) / b.actual)) * 100;

  // Refit on everything for the forward forecast.
  const full = fit(
    rows.map((r) => r.x),
    rows.map((r) => r.y),
  );
  const forecast = W.forecast[area].map((f) => {
    const { date, hour } = osloParts(f.time);
    return { t: f.time, temp: f.temp, predicted: full(features(f.temp, hour, isWeekend(date))) };
  });

  // Sensitivity: extra kWh per hour per 1C colder, at a typical winter temp of 0C.
  const at = (temp: number) => mean(Array.from({ length: 24 }, (_, h) => full(features(temp, h, false))));
  const sensitivity = at(-1) - at(0);

  const daily = new Map<string, { kwh: number; temps: number[] }>();
  rows.forEach((r) => {
    const d = daily.get(localDate(r.t)) ?? { kwh: 0, temps: [] };
    d.kwh += r.y;
    d.temps.push(r.temp as number);
    daily.set(localDate(r.t), d);
  });
  const scatter = [...daily.entries()]
    .filter(([, d]) => d.temps.length >= 23)
    .map(([date, d]) => ({ date, temp: mean(d.temps), mwh: MWh(d.kwh) }));

  return { backtest, mape, forecast, sensitivity, scatter };
}
