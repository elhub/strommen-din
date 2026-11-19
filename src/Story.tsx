import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area as RArea,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AREAS,
  Area,
  G,
  correlation,
  dailyNexus,
  forecastModel,
  heatmap,
  household,
  norgespris,
  osloParts,
  overview,
  peakShaving,
} from "./analysis";

const PLACES: Record<Area, { city: string; region: string; in: string }> = {
  NO1: { city: "Oslo", region: "Østlandet", in: "på Østlandet" },
  NO2: { city: "Kristiansand", region: "Sørlandet", in: "på Sørlandet" },
  NO3: { city: "Trondheim", region: "Midt-Norge", in: "i Midt-Norge" },
  NO4: { city: "Tromsø", region: "Nord-Norge", in: "i Nord-Norge" },
  NO5: { city: "Bergen", region: "Vestlandet", in: "på Vestlandet" },
};
const C = { cons: "#58a6ff", prod: "#3fb950", temp: "#f0883e", price: "#d2a8ff", wind: "#56d4dd", solar: "#e3b341", hydro: "#1f6feb", np: "#ff7b72", other: "#8b949e", cheap: "#3fb950", dear: "#f85149" };
const fmt = (n: number, d = 0) => n.toLocaleString("nb-NO", { maximumFractionDigits: d, minimumFractionDigits: d });
const kr = (n: number) => `${fmt(n, n < 10 ? 2 : 0)} kr`;
const f = (fn: (v: number) => string) => (v: unknown) => fn(Number(v));
const tip = { contentStyle: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 8 }, labelStyle: { color: "#e6edf3" } };
const axis = { stroke: "#8b949e", fontSize: 11 };
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
const strength = (r: number) => (Math.abs(r) > 0.7 ? "svært tydelig" : Math.abs(r) > 0.4 ? "tydelig" : Math.abs(r) > 0.2 ? "svak" : "nesten ingen");

export default function Story() {
  const [area, setArea] = useState<Area>("NO1");
  const p = PLACES[area];
  return (
    <>
      <div className="fx-progress" />
      <div className="fx-vignette" />
      <div className="fx-grain" />
      <header className="hero">
        <div className="aurora">
          <i />
          <i />
          <i />
        </div>
        <div className="eyebrow">Strømstad · Gruppe 6 · Åpne data fra Elhub</div>
        <h1>Strømmen din, forklart med ekte data</h1>
        <p>
          Hver time måles strømforbruket i over 3 millioner norske målere og samles i Elhub. Vi har koblet de siste 90 dagene
          med været fra yr og strømprisen — og her er hva vi fant.
        </p>
        <div className="picker">
          <span>Hvor bor du?</span>
          {AREAS.map((a) => (
            <button key={a} className={"pill big " + (a === area ? "active" : "")} onClick={() => setArea(a)}>
              {PLACES[a].city}
            </button>
          ))}
        </div>
        <div className="muted">
          Viser prisområde {area} · {p.region}. Klikk på et område under for å sammenligne.
        </div>
        <RegionStrip area={area} setArea={setArea} />
      </header>
      <main>
        <YourDay area={area} />
        <Cold area={area} />
        <Sources area={area} />
        <RushHour />
        <Norgespris area={area} />
        <Ideas />
      </main>
      <footer className="muted">
        Kilder: Elhub Energy Data API (CC BY 4.0) · Meteorologisk institutt / yr (Locationforecast, MET Nordic via Open-Meteo) ·
        Spotpriser fra Nord Pool via hvakosterstrommen.no. Priser er spotpris uten nettleie, avgifter og mva.
      </footer>
    </>
  );
}

function Section({ n, title, lead, children }: { n: number; title: string; lead: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.08 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} className={seen ? "reveal in" : "reveal"}>
      <div className="num">{n}</div>
      <h2>{title}</h2>
      <p className="lead">{lead}</p>
      {children}
    </section>
  );
}

// Animates the first number found in a formatted nb-NO string, e.g. "1 585 kr".
function CountUp({ text }: { text: string }) {
  const m = text.match(/^()(−?-?\d(?:[\d\u00a0\u202f ]*\d)?(?:,\d+)?)(.*)$/);
  const target = m ? Number(m[2].replace(/[\s\u00a0\u202f]/g, "").replace(",", ".").replace("−", "-")) : 0;
  const decimals = m?.[2].split(",")[1]?.length ?? 0;
  const [v, setV] = useState(target);
  useEffect(() => {
    if (!m) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      {fmt(v, decimals)}
      {m[3]}
    </>
  );
}

function Big({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="big">
      <b style={{ color }}>
        <CountUp text={value} />
      </b>
      <span>{label}</span>
    </div>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RegionStrip({ area, setArea }: { area: Area; setArea: (a: Area) => void }) {
  const o = useMemo(() => overview(), []);
  return (
    <div className="regions">
      {o.map((r) => (
        <button key={r.area} className={"region " + (r.area === area ? "active" : "")} onClick={() => setArea(r.area)}>
          <div className="rh">
            <b>{PLACES[r.area].city}</b>
            <span>{r.area}</span>
          </div>
          <div className="rk">
            <b>{fmt(r.kwhPerDay, 0)}</b> kWh/dag per hjem
          </div>
          <div className="rk">
            <b>{fmt(r.avgPrice * 100, 0)}</b> øre/kWh snittpris
          </div>
          <div className="rk">
            <b>{fmt(r.temp, 1)}°</b> snittemp · <b>{fmt(r.npShare)} %</b> Norgespris
          </div>
          <Spark data={r.spark} color={C.price} />
          <div className="meter">
            <div style={{ width: `${Math.min(100, r.selfSufficiency / 2)}%`, background: r.selfSufficiency >= 100 ? C.prod : C.temp }} />
          </div>
          <div className="rk small">{fmt(r.selfSufficiency)} % selvforsynt</div>
        </button>
      ))}
    </div>
  );
}

function lerpColor(stops: string[], t: number) {
  if (!isFinite(t)) return "#161b22";
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const a = stops[i].match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const b = stops[i + 1].match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const k = x - i;
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(",")})`;
}
const SCALES = {
  kwh: ["0d1b2a", "1f6feb", "56d4dd", "e6edf3"],
  price: ["0d2a1b", "3fb950", "e3b341", "f85149"],
  temp: ["4c6ef5", "74c0fc", "f1f3f5", "f0883e", "e03131"],
};

function Heatmap({ area }: { area: Area }) {
  const data = useMemo(() => heatmap(area), [area]);
  const [mode, setMode] = useState<"kwh" | "price" | "temp">("kwh");
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const all = data.flatMap((d) => d[mode]).filter(isFinite);
  const lo = Math.min(...all);
  const hi = mode === "price" ? [...all].sort((a, b) => a - b)[Math.floor(all.length * 0.98)] : Math.max(...all);
  const cw = 10;
  const ch = 12;
  const unit = { kwh: "kWh per hjem", price: "kr/kWh", temp: "°C" }[mode];
  const hv = hover && data[hover.d];
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Fingeravtrykket: hver rute er én time de siste 90 dagene</h3>
        <div className="row" style={{ margin: 0 }}>
          {(["kwh", "price", "temp"] as const).map((k) => (
            <button key={k} className={"pill " + (k === mode ? "active" : "")} onClick={() => setMode(k)}>
              {{ kwh: "⚡ Forbruk", price: "💰 Pris", temp: "🌡️ Temperatur" }[k]}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${data.length * cw + 30} ${24 * ch + 20}`} className="heat" onMouseLeave={() => setHover(null)}>
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={0} y={h * ch + 10} className="hl">
            {String(h).padStart(2, "0")}
          </text>
        ))}
        {data.map((d, i) =>
          d[mode].map((v, h) => (
            <rect
              key={`${i}-${h}`}
              x={30 + i * cw}
              y={h * ch}
              width={cw - 1}
              height={ch - 1}
              rx={2}
              fill={lerpColor(SCALES[mode], (v - lo) / (hi - lo))}
              onMouseEnter={() => setHover({ d: i, h })}
            />
          )),
        )}
        {data.map((d, i) =>
          d.date.endsWith("-01") ? (
            <text key={d.date} x={30 + i * cw} y={24 * ch + 14} className="hl">
              {dayLabel(d.date)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="heatinfo">
        {hv ? (
          <>
            <b>
              {dayLabel(hv.date)} kl. {hover!.h}:00
            </b>{" "}
            · ⚡ {fmt(hv.kwh[hover!.h], 2)} kWh per hjem · 💰 {fmt(hv.price[hover!.h], 2)} kr/kWh · 🌡️{" "}
            {fmt(hv.temp[hover!.h], 1)}°
          </>
        ) : (
          <span className="muted">
            Hold musa over en rute. Fargeskala: {unit}. Legg merke til hvordan forbruket «varmes opp» mot høsten, og de røde
            pristoppene morgen og ettermiddag.
          </span>
        )}
      </div>
    </div>
  );
}

function Calculator({ profile }: { profile: { h: number; price: number }[] }) {
  const [ev, setEv] = useState(10);
  const [wash, setWash] = useState(2);
  const [water, setWater] = useState(3);
  const win = (s: number, n: number) => Array.from({ length: n }, (_, k) => profile[(s + k) % 24].price).reduce((a, b) => a + b, 0) / n;
  const best = (n: number) => Array.from({ length: 24 }, (_, s) => s).reduce((a, b) => (win(b, n) < win(a, n) ? b : a));
  const peak = win(17, 4);
  const items = [
    { label: "🚗 Elbillading", kwh: ev, set: setEv, max: 30 },
    { label: "🧺 Vask & oppvask", kwh: wash, set: setWash, max: 6 },
    { label: "🚿 Varmtvannsbereder", kwh: water, set: setWater, max: 8 },
  ];
  const saving = items.reduce((s, it) => s + it.kwh * 30 * (peak - win(best(4), 4)), 0);
  return (
    <div className="card calc">
      <h3>🧮 Hva sparer du på å flytte forbruket ditt fra kl. 17–21 til de billigste timene?</h3>
      <div className="calcgrid">
        <div>
          {items.map((it) => (
            <label key={it.label} className="slider">
              <span>
                {it.label} <b>{it.kwh} kWh/dag</b>
              </span>
              <input type="range" min={0} max={it.max} value={it.kwh} onChange={(e) => it.set(+e.target.value)} />
            </label>
          ))}
        </div>
        <div className="saving">
          <span>Du kan spare</span>
          <b>{kr(saving)}</b>
          <span>per måned · {kr(saving * 12)} per år</span>
        </div>
      </div>
    </div>
  );
}

function YourDay({ area }: { area: Area }) {
  const h = useMemo(() => household(area), [area]);
  const sorted = [...h.profile].sort((a, b) => a.price - b.price);
  const dear = sorted.slice(-4).map((x) => x.h);
  const windowPrice = (s: number) => [0, 1, 2, 3].reduce((acc, k) => acc + h.profile[(s + k) % 24].price, 0) / 4;
  const start = Array.from({ length: 24 }, (_, s) => s).reduce((a, b) => (windowPrice(b) < windowPrice(a) ? b : a));
  const cheap = [0, 1, 2, 3].map((k) => (start + k) % 24);
  const evSaving = 10 * 30 * (windowPrice(17) - windowPrice(start));
  const range = () => `kl. ${String(start).padStart(2, "0")}–${String((start + 4) % 24).padStart(2, "0")}`;
  return (
    <Section
      n={1}
      title="Din strømdag"
      lead={
        <>
          En vanlig husholdning {PLACES[area].in} har brukt <b>{fmt(h.kwhPerDay, 1)} kWh i døgnet</b> — det er som å
          koke {fmt(h.kwhPerDay / 0.1)} kanner med vann. Med spotpris ble det i snitt <b>{kr(h.costPerDay)} per dag</b>.
        </>
      }
    >
      <div className="bigs">
        <Big value={`${fmt(h.kwhPerDay, 1)} kWh`} label="per hjem per døgn" />
        <Big value={kr(h.costPerDay * 30)} label="spotpris per måned" />
        <Big value={range()} label="billigste 4 timer på rad i snitt" color={C.cheap} />
        <Big value={kr(evSaving)} label="spart per måned ved å lade elbilen om natta i stedet for kl. 17–21 (10 kWh/dag)" color={C.cheap} />
      </div>
      <div className="card">
        <h3>Når bruker vi strøm — og når er den dyrest?</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={h.profile}>
            <CartesianGrid stroke="#21262d" vertical={false} />
            <XAxis dataKey="h" {...axis} tickFormatter={(v) => `${v}`} label={{ value: "klokkeslett", fill: "#8b949e", position: "insideBottom", offset: -2 }} />
            <YAxis {...axis} tickFormatter={(v) => fmt(v, 1)} label={{ value: "kWh per hjem", angle: -90, fill: "#8b949e", position: "insideLeft" }} />
            <YAxis yAxisId="p" orientation="right" {...axis} tickFormatter={(v) => fmt(v, 2)} label={{ value: "kr/kWh", angle: 90, fill: "#8b949e", position: "insideRight" }} />
            <Tooltip {...tip} labelFormatter={(v) => `kl. ${v}:00`} formatter={f((v) => fmt(v, 2))} />
            <Legend />
            <Bar dataKey="kwh" name="Ditt forbruk (kWh)" radius={[4, 4, 0, 0]}>
              {h.profile.map((x) => (
                <Cell key={x.h} fill={cheap.includes(x.h) ? C.cheap : dear.includes(x.h) ? C.dear : C.cons} />
              ))}
            </Bar>
            <Line yAxisId="p" dataKey="price" name="Strømpris (kr/kWh)" stroke={C.price} strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="insight">
          🟢 Grønne søyler = de billigste timene. 🔴 Røde = de dyreste. Vi bruker mest strøm akkurat når den koster mest — morgen
          og ettermiddag. Å flytte oppvaskmaskin, vaskemaskin og elbillading til grønne timer er den enkleste sparingen som finnes.
        </div>
      </div>
      <Calculator profile={h.profile} />
      <Heatmap area={area} />
    </Section>
  );
}

function Cold({ area }: { area: Area }) {
  const m = useMemo(() => forecastModel(area, "household"), [area]);
  const h = useMemo(() => household(area), [area]);
  const perHomePerDegree = (m.sensitivity * 24) / h.homes;
  const fc = m.forecast.map((x) => {
    const o = osloParts(x.t);
    return { ...x, label: `${dayLabel(o.date)} ${o.hour}:00`, perHome: x.predicted / h.homes };
  });
  const coldest = fc.reduce((a, b) => (b.temp < a.temp ? b : a));
  return (
    <Section
      n={2}
      title="Når det blir kaldt, går strømmen"
      lead={
        <>
          For hver grad kaldere ute bruker et hjem {PLACES[area].in} rundt <b>{fmt(perHomePerDegree, 1)} kWh mer per døgn</b>{" "}
          — omtrent <b>{kr(perHomePerDegree * h.avgPrice)}</b> ekstra per dag. Vi har lært dette fra Elhub-data og bruker yr-varselet
          til å spå de neste tre dagene.
        </>
      }
    >
      <div className="grid2">
        <div className="card">
          <h3>Hver prikk er én dag: temperatur mot forbruk</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid stroke="#21262d" />
              <XAxis dataKey="temp" type="number" unit="°" {...axis} name="Temperatur" />
              <YAxis dataKey="mwh" {...axis} name="Forbruk" tickFormatter={(v) => fmt(v / 1000)} label={{ value: "GWh/døgn", angle: -90, fill: "#8b949e", position: "insideLeft" }} />
              <Tooltip {...tip} formatter={f((v) => fmt(v, 1))} />
              <Scatter data={m.scatter} fill={C.temp} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>🌤️ yr-varselet → strømforbruk neste 72 timer</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={fc}>
              <CartesianGrid stroke="#21262d" vertical={false} />
              <XAxis dataKey="label" {...axis} interval={11} />
              <YAxis {...axis} tickFormatter={(v) => fmt(v, 1)} label={{ value: "kWh per hjem/time", angle: -90, fill: "#8b949e", position: "insideLeft" }} />
              <YAxis yAxisId="t" orientation="right" {...axis} unit="°" />
              <Tooltip {...tip} formatter={f((v) => fmt(v, 1))} />
              <Legend />
              <RArea dataKey="perHome" name="Forventet forbruk per hjem" stroke={C.cons} fill={C.cons} fillOpacity={0.3} />
              <Line yAxisId="t" dataKey="temp" name="Temperatur (yr)" stroke={C.temp} dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="insight">
        Kaldeste time i varselet: <b>{fmt(coldest.temp, 1)}°</b> ({coldest.label}). Modellen bommet med bare{" "}
        <b>{fmt(m.mape, 1)} %</b> i gjennomsnitt da vi testet den på siste uke den ikke hadde sett.
      </div>
    </Section>
  );
}

function Sources({ area }: { area: Area }) {
  const d = useMemo(() => dailyNexus(area), [area]).map((x) => ({ ...x, label: dayLabel(x.date) }));
  const cons = d.reduce((s, x) => s + x.consumption, 0);
  const prod = d.reduce((s, x) => s + x.production, 0);
  const share = (k: "hydro" | "wind" | "solar") => (100 * d.reduce((s, x) => s + x[k], 0)) / prod;
  const rWind = correlation(d.map((x) => x.windSpeed), d.map((x) => x.wind));
  const rPriceExp = correlation(d.map((x) => x.price), d.map((x) => x.netExport));
  const rTemp = correlation(d.map((x) => x.temp), d.map((x) => x.consumption));
  const selfSuff = (100 * prod) / cons;
  return (
    <Section
      n={3}
      title="Hvor kommer strømmen fra?"
      lead={
        <>
          {PLACES[area].region} produserte <b>{fmt(selfSuff)} %</b> av det regionen selv brukte —{" "}
          {selfSuff > 100 ? "resten ble sendt til naboene." : "resten måtte hentes fra naboområdene."} Vannkraft sto for{" "}
          <b>{fmt(share("hydro"))} %</b>, vind <b>{fmt(share("wind"), 1)} %</b> og sol <b>{fmt(share("solar"), 1)} %</b>.
        </>
      }
    >
      <div className="card">
        <h3>Forbruk, produksjon, temperatur og pris — dag for dag</h3>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={d}>
            <CartesianGrid stroke="#21262d" vertical={false} />
            <XAxis dataKey="label" {...axis} interval={9} />
            <YAxis {...axis} tickFormatter={(v) => fmt(v / 1000)} label={{ value: "GWh/døgn", angle: -90, fill: "#8b949e", position: "insideLeft" }} />
            <YAxis yAxisId="t" orientation="right" {...axis} unit="°" />
            <YAxis yAxisId="p" hide domain={[0, "auto"]} />
            <Tooltip {...tip} formatter={f((v) => fmt(v, 1))} />
            <Legend />
            <RArea dataKey="production" name="Produksjon (MWh)" stroke={C.prod} fill={C.prod} fillOpacity={0.15} />
            <RArea dataKey="consumption" name="Forbruk (MWh)" stroke={C.cons} fill={C.cons} fillOpacity={0.35} />
            <Line yAxisId="t" dataKey="temp" name="Temperatur °C" stroke={C.temp} dot={false} strokeWidth={2} />
            <Line yAxisId="p" dataKey="price" name="Strømpris kr/kWh" stroke={C.price} dot={false} strokeDasharray="5 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid3">
        <div className="fact">
          <b>🌡️ Kulde og forbruk</b>
          Sammenhengen er <i>{strength(rTemp)}</i> (r = {fmt(rTemp, 2)}). Høsten kommer, ovnene skrus på.
        </div>
        <div className="fact">
          <b>💨 Vind og vindkraft</b>
          Når det blåser mer, produserer vindmøllene mer — sammenhengen er <i>{strength(rWind)}</i> (r = {fmt(rWind, 2)}).
        </div>
        <div className="fact">
          <b>💰 Pris og eksport</b>
          {rPriceExp > 0.2
            ? "Når prisen er høy, sender regionen mer strøm ut. Vannkraftprodusentene sparer vannet til det lønner seg."
            : rPriceExp < -0.2
              ? "Når prisen er høy, må regionen hente mer strøm utenfra. Underskudd gir høyere pris."
              : "Prisen og eksporten henger svakt sammen her — prisen styres mer av naboene."}{" "}
          (r = {fmt(rPriceExp, 2)})
        </div>
      </div>
      <div className="card">
        <h3>Produksjonsmiks per dag</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={d}>
            <CartesianGrid stroke="#21262d" vertical={false} />
            <XAxis dataKey="label" {...axis} interval={9} />
            <YAxis {...axis} tickFormatter={(v) => fmt(v / 1000)} />
            <Tooltip {...tip} formatter={f((v) => `${fmt(v)} MWh`)} />
            <Legend />
            <Bar dataKey="hydro" stackId="p" fill={C.hydro} name="💧 Vann" />
            <Bar dataKey="wind" stackId="p" fill={C.wind} name="💨 Vind" />
            <Bar dataKey="solar" stackId="p" fill={C.solar} name="☀️ Sol" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function RushHour() {
  const shave = 10;
  const rows = useMemo(
    () =>
      G.grids
        .map((g) => ({ ...g, ...peakShaving(g.kwh, shave) }))
        .filter((g) => g.peak > 0 && g.meteringPoints > 1000)
        .sort((a, b) => b.capacityFreed - a.capacityFreed),
    [],
  );
  const [sel, setSel] = useState(rows[0]?.eic);
  const g = rows.find((r) => r.eic === sel) ?? rows[0];
  const series = G.hours.map((t, i) => ({ t: dayLabel(t.slice(0, 10)), kwh: g.kwh[i] / 1000, cap: g.cap / 1000 }));
  const totalFreed = rows.reduce((s, r) => s + r.capacityFreed, 0) / 1000;
  const avgHours = rows.reduce((s, r) => s + r.hoursOver, 0) / rows.length;
  return (
    <Section
      n={4}
      title="Rushtid i strømnettet"
      lead={
        <>
          Strømnettet må bygges for den travleste timen — akkurat som veiene for rushtrafikken. Hvis vi kuttet toppen med bare 10 %,
          ville det frigjort <b>{fmt(totalFreed)} MW</b> kapasitet i nettområdene vi så på. Det krever i snitt kun{" "}
          <b>{fmt(avgHours)} timer</b> med litt mindre bruk i løpet av en måned.
        </>
      }
    >
      <div className="row">
        <span className="muted">Velg nettområde:</span>
        <select value={g.eic} onChange={(e) => setSel(e.target.value)}>
          {rows.map((r) => (
            <option key={r.eic} value={r.eic}>
              {r.name} ({fmt(r.meteringPoints)} målere)
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        <h3>{g.name}: siste 30 dager. Alt over den røde streken er «rushtid»</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={series}>
            <CartesianGrid stroke="#21262d" vertical={false} />
            <XAxis dataKey="t" {...axis} interval={71} />
            <YAxis {...axis} tickFormatter={(v) => fmt(v)} label={{ value: "MW", angle: -90, fill: "#8b949e", position: "insideLeft" }} />
            <Tooltip {...tip} formatter={f((v) => `${fmt(v, 1)} MW`)} />
            <RArea dataKey="kwh" name="Belastning" stroke={C.cons} fill={C.cons} fillOpacity={0.3} />
            <Line dataKey="cap" name="10 % lavere topp" stroke={C.dear} dot={false} strokeDasharray="6 3" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="insight">
          Bare <b>{g.hoursOver} av {G.hours.length} timer</b> var over streken. Å flytte {fmt(g.energyToShift / 1000, 1)} MWh fra disse
          timene tilsvarer at hver måler i {g.name} flytter {fmt((g.energyToShift / g.meteringPoints), 1)} kWh — omtrent én
          oppvaskmaskin — i løpet av en hel måned. Lavere topper gir mindre behov for nye nettutbygginger og dermed lavere nettleie.
        </div>
      </div>
    </Section>
  );
}

function Norgespris({ area }: { area: Area }) {
  const n = useMemo(() => norgespris(area), [area]);
  const prof = n.profileNp.map((v, h) => ({ h, np: v * 100, other: n.profileOther[h] * 100, price: n.profilePrice[h] * 100 }));
  const last = n.adoption.at(-1)!;
  const first = n.adoption[0];
  return (
    <Section
      n={5}
      title="Norgespris: hvem valgte fastpris — og endret det vanene?"
      lead={
        <>
          Nå har <b>{fmt(last.share)} %</b> av husholdningene {PLACES[area].in} Norgespris (fast 50 øre/kWh inkl. mva)
          {last.share - first.share > 1 ? `, opp fra ${fmt(first.share)} % for 90 dager siden` : ""}. Når strømmen koster det samme
          hele døgnet, er det mindre grunn til å flytte forbruket bort fra de dyre timene.
        </>
      }
    >
      <div className="bigs">
        <Big value={`${fmt(n.avgKwhNp, 1)} kWh`} label="per døgn — hjem med Norgespris" color={C.np} />
        <Big value={`${fmt(n.avgKwhOther, 1)} kWh`} label="per døgn — hjem med spotpris" color={C.other} />
        <Big value={`${fmt(n.peakLoadNp * 100)} %`} label="av vanlig forbruk i de dyreste timene — Norgespris" color={C.np} />
        <Big value={`${fmt(n.peakLoadOther * 100)} %`} label="av vanlig forbruk i de dyreste timene — spotpris" color={C.other} />
      </div>
      <NorgesprisVerdict area={area} kwhNp={n.avgKwhNp} />
      <div className="grid2">
        <div className="card">
          <h3>Andel husholdninger med Norgespris</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={n.adoption.map((x) => ({ ...x, label: dayLabel(x.date) }))}>
              <CartesianGrid stroke="#21262d" vertical={false} />
              <XAxis dataKey="label" {...axis} interval={14} />
              <YAxis {...axis} unit=" %" domain={["auto", "auto"]} />
              <Tooltip {...tip} formatter={f((v) => `${fmt(v, 1)} %`)} />
              <Line dataKey="share" stroke={C.np} dot={false} strokeWidth={3} name="Andel" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Døgnrytme (100 = snittet for dagen)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={prof}>
              <CartesianGrid stroke="#21262d" vertical={false} />
              <XAxis dataKey="h" {...axis} />
              <YAxis {...axis} domain={["auto", "auto"]} />
              <Tooltip {...tip} labelFormatter={(v) => `kl. ${v}:00`} formatter={f((v) => fmt(v))} />
              <Legend />
              <Line dataKey="np" stroke={C.np} dot={false} strokeWidth={2} name="Norgespris-hjem" />
              <Line dataKey="other" stroke={C.other} dot={false} strokeWidth={2} name="Spotpris-hjem" />
              <Line dataKey="price" stroke={C.price} dot={false} strokeDasharray="5 3" name="Strømpris" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <NorgesprisConclusion np={n.peakLoadNp} other={n.peakLoadOther} share={last.share} />
    </Section>
  );
}

function NorgesprisConclusion({ np, other, share }: { np: number; other: number; share: number }) {
  if (share < 1 || !isFinite(np)) return null;
  const diff = (np - other) * 100;
  const verdict =
    Math.abs(diff) < 3
      ? "Vi ser ingen tydelig forskjell. Norgespris ser foreløpig ikke ut til å ha gjort folk mindre fleksible."
      : diff > 0
        ? "Norgespris-hjem bruker litt mer i de dyre timene enn spotkunder. Det kan tyde på at fastpris gir mindre grunn til å flytte forbruk."
        : "Norgespris-hjem bruker faktisk mindre i de dyre timene enn spotkunder. Vi ser ingen tegn til tapt fleksibilitet.";
  return (
    <div className="card conclusion">
      <h3>🔎 Konklusjon</h3>
      <p className="verdict-text">{verdict}</p>
      <ul>
        <li>
          <b>Hva vi målte:</b> hvor mye hjemmene bruker i de 15 % dyreste timene, sammenlignet med sitt eget snitt samme dag.
          Da sammenligner vi <i>vaner</i>, ikke hvor mye strøm hjemmene bruker totalt.
        </li>
        <li>
          <b>Hva vi fant:</b> Norgespris-hjem {fmt(np * 100)} %, spotpris-hjem {fmt(other * 100)} %. Forskjellen er{" "}
          {fmt(Math.abs(diff), 1)} prosentpoeng.
        </li>
        <li>
          <b>Hvorfor:</b> begge gruppene bruker <i>mer</i> enn vanlig når strømmen er dyrest, fordi de dyre timene er når folk er
          hjemme (morgen og ettermiddag). Spotkundene flyttet lite fra før, så det var lite fleksibilitet å miste.
        </li>
        <li>
          <b>Forbehold:</b> de som valgte Norgespris er ikke like dem som lot være (f.eks. større hus, mer elektrisk oppvarming), og
          vi sammenligner to grupper i samme periode — ikke de samme hjemmene før og etter. Dette er en pekepinn, ikke et bevis.
        </li>
      </ul>
    </div>
  );
}

function NorgesprisVerdict({ area, kwhNp }: { area: Area; kwhNp: number }) {
  const h = useMemo(() => household(area), [area]);
  // Norgespris is 40 øre/kWh ex. VAT; spot prices here are also ex. VAT.
  const spot = h.avgPrice * kwhNp * 30;
  const fixed = 0.4 * kwhNp * 30;
  const diff = spot - fixed;
  const max = Math.max(spot, fixed);
  if (kwhNp < 1)
    return (
      <div className="insight">
        Nesten ingen {PLACES[area].in} har valgt Norgespris — med en snittpris på {fmt(h.avgPrice * 100)} øre/kWh var spotprisen
        billigere enn fastprisen.
      </div>
    );
  return (
    <div className="card verdict">
      <h3>⚖️ Lønte det seg? Et typisk Norgespris-hjem ({fmt(kwhNp)} kWh/dag), per måned, eks. mva</h3>
      <div className="vs">
        <div>
          <span>Spotpris</span>
          <div className="vbar" style={{ width: `${(spot / max) * 100}%`, background: C.price }}>
            {kr(spot)}
          </div>
        </div>
        <div>
          <span>Norgespris</span>
          <div className="vbar" style={{ width: `${(fixed / max) * 100}%`, background: C.np }}>
            {kr(fixed)}
          </div>
        </div>
      </div>
      <div className="insight">
        {diff > 0
          ? `Norgespris ga ${kr(diff)} lavere regning per måned de siste 90 dagene ${PLACES[area].in}. Mellomlegget betales av staten.`
          : `Spotpris hadde faktisk vært ${kr(-diff)} billigere per måned ${PLACES[area].in} de siste 90 dagene — Norgespris er en forsikring mot dyre vintre.`}
      </div>
    </div>
  );
}

function Ideas() {
  return (
    <section>
      <div className="num">→</div>
      <h2>Hva kan dette bli?</h2>
      <div className="grid3">
        <div className="fact"><b>📱 «Beste tid å lade» for alle</b>Elhub-data + yr + pris → et enkelt varsel om når strømmen er billigst og nettet minst belastet der du bor.</div>
        <div className="fact"><b>❄️ Kuldevarsel for nettet</b>yr-varsel + forbruksmodell per nettområde varsler nettselskap og folk før rekordtopper.</div>
        <div className="fact"><b>📊 Norgespris-monitor</b>Følg hvordan fastpris påvirker forbruksmønster — viktig for politikere, RME og offentligheten.</div>
        <div className="fact"><b>⚡ Fleksibilitetskart</b>Vis hvor i Norge litt flytting av forbruk sparer mest nettutbygging.</div>
        <div className="fact"><b>☀️ Solkraft-tracker</b>Følg solcelleboomen kommune for kommune, og hvor mye som brukes selv.</div>
        <div className="fact"><b>🏠 «Hjem som ditt»</b>Sammenlign ditt eget forbruk (via Elhub-innsyn) med snittet i ditt område og din forbruksgruppe.</div>
      </div>
    </section>
  );
}
