import { useMemo, useState } from "react";
import { Bar, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area as RArea } from "recharts";
import { ArrowRight, Car, Coins, Info, MapPin, ShowerHead, Snowflake, WashingMachine, Zap } from "lucide-react";
import { AREAS, Area, P, dailyNexus, forecastModel, household, norgespris, osloParts, overview } from "@/analysis";
import map from "@/data/norway.json";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CITY: Record<Area, { city: string; in: string }> = {
  NO1: { city: "Oslo", in: "på Østlandet" },
  NO2: { city: "Kristiansand", in: "på Sørlandet" },
  NO3: { city: "Trondheim", in: "i Midt-Norge" },
  NO4: { city: "Tromsø", in: "i Nord-Norge" },
  NO5: { city: "Bergen", in: "på Vestlandet" },
};
const C = { use: "#a1a1aa", cheap: "#34d399", dear: "#f87171", price: "#e4c590", temp: "#93c5fd", np: "#e4c590", spot: "#71717a" };
const fmt = (n: number, d = 0) => n.toLocaleString("nb-NO", { maximumFractionDigits: d, minimumFractionDigits: d });
const kr = (n: number) => `${fmt(n, n < 10 ? 2 : 0)} kr`;
const tip = { contentStyle: { background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 } };
const axis = { stroke: "#52525b", fontSize: 11, tickLine: false, axisLine: false };
const longDate = (t: string) => new Date(t.slice(0, 10) + "T12:00:00Z").toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const PERIOD = `${longDate(P.hours[0])} – ${longDate(P.hours.at(-1)!)}`;

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={i.line ? "h-0.5 w-3 rounded" : "size-2.5 rounded-sm"} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function KeyFindings({ area, best }: { area: Area; best: number }) {
  const h = useMemo(() => household(area), [area]);
  const m = useMemo(() => forecastModel(area, "household"), [area]);
  const sup = useMemo(() => overview().find((r) => r.area === area)!, [area]);
  const hh = (n: number) => String(n % 24).padStart(2, "0");
  const items = [
    { id: "billigst", text: `Billigst er strømmen kl. ${hh(best)}–${hh(best + 4)}. Dyrest er den om ettermiddagen, når vi bruker mest.` },
    { id: "kulde", text: `Hver grad kaldere gir rundt ${fmt((m.sensitivity * 24) / h.homes, 1)} kWh mer forbruk per hjem per døgn.` },
    { id: "forsyning", text: `${CITY[area].city}-regionen produserer ${fmt(sup.selfSufficiency)} % av strømmen den bruker.` },
    { id: "norgespris", text: sup.npShare < 1 ? "Nesten ingen her har valgt Norgespris – spotprisen var lav." : `${fmt(sup.npShare)} % har Norgespris. Vi ser ingen tydelig endring i når de bruker strøm.` },
  ];
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-normal">Kort fortalt</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {items.map((it, i) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="group flex gap-3 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground">
                <span className="mt-0.5 font-mono text-xs text-[#e4c590]">0{i + 1}</span>
                <span className="flex-1">{it.text}</span>
                <ArrowRight className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function Method() {
  const rows = [
    { q: "Hvor kommer tallene fra?", a: "Forbruk, produksjon og utveksling er timesverdier fra Elhub, summert per prisområde og kundegruppe. Værdata er fra Meteorologisk institutt, og spotprisene er fra Nord Pool." },
    { q: "Hva er «et vanlig hjem»?", a: "Samlet forbruk for alle husholdninger i området delt på antall husholdningsmålere. Det er et snitt, ikke ditt eget forbruk." },
    { q: "Hvorfor bare spotpris?", a: "Nettleie, avgifter og mva varierer mellom nettselskap og over tid. Vi viser derfor bare kraftprisen, som er lik for alle i området." },
    { q: "Hvordan lages prognosen?", a: "En regresjonsmodell som lærer sammenhengen mellom temperatur, tid på døgnet, helg og forbruk fra Elhub-data. Den får yr-varselet som input." },
    { q: "Hvor sikker er Norgespris-analysen?", a: "Den sammenligner to grupper i samme periode. De som valgte Norgespris kan ha andre hus og vaner, så resultatet er en pekepinn – ikke et bevis." },
  ];
  return (
    <section id="metode" className="scroll-mt-28">
      <Heading n="—" title="Om dataene" lead={`Analysen dekker ${PERIOD}. Alle tall er åpne og kan etterprøves.`} />
      <Card>
        <CardContent className="divide-y divide-border py-0">
          {rows.map((r) => (
            <details key={r.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm [&::-webkit-details-marker]:hidden">
                {r.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{r.a}</p>
            </details>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export default function App() {
  const [area, setArea] = useState<Area>("NO1");
  const h = useMemo(() => household(area), [area]);
  const win = (s: number) => [0, 1, 2, 3].reduce((a, k) => a + h.profile[(s + k) % 24].price, 0) / 4;
  const best = Array.from({ length: 24 }, (_, s) => s).reduce((a, b) => (win(b) < win(a) ? b : a));
  const hh = (n: number) => String(n % 24).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2 font-medium tracking-tight">
            <Zap className="size-4 text-[#e4c590]" /> Strømmen din
          </a>
          <div className="hidden gap-1 md:flex">
            {AREAS.map((a) => (
              <Button key={a} size="sm" variant={a === area ? "secondary" : "ghost"} onClick={() => setArea(a)}>
                {CITY[a].city}
              </Button>
            ))}
          </div>
          <Select value={area} onValueChange={(v) => v && setArea(v as Area)} items={AREAS.map((a) => ({ value: a, label: CITY[a].city }))}>
            <SelectTrigger className="h-9 min-w-36 md:hidden" aria-label="Velg region">
              <MapPin className="size-4 text-[#e4c590]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {AREAS.map((a) => (
                <SelectItem key={a} value={a} className="py-2">
                  {CITY[a].city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav aria-label="Seksjoner" className="mx-auto max-w-5xl [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)]">
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
            {[
              ["billigst", "Billigst"],
              ["kulde", "Kulde"],
              ["forsyning", "Forsyning"],
              ["norgespris", "Norgespris"],
              ["metode", "Om dataene"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-20 px-4 pb-24 sm:px-6">
        <section className="pt-16 sm:pt-24">
          <Badge variant="outline" className="mb-6 font-normal text-muted-foreground">
            Datarapport · {PERIOD}
          </Badge>
          <h1 className="max-w-3xl text-4xl font-light leading-[1.05] tracking-tight sm:text-6xl">
            Strømmen din, <span className="text-[#e4c590]">forklart</span> med ekte data.
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-light text-muted-foreground">
            Slik har en vanlig husholdning {CITY[area].in} brukt strøm de siste 90 dagene – basert på åpne data fra Elhub, yr og
            Nord Pool. Velg region øverst.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Stat label="Forbruk per hjem" value={`${fmt(h.kwhPerDay, 1)} kWh`} hint="per døgn" />
            <Stat label="Spotpris per måned" value={kr(h.costPerDay * 30)} hint="uten nettleie og mva" />
            <Stat label="Billigste tid" value={`${hh(best)}–${hh(best + 4)}`} hint="fire timer på rad" accent />
          </div>
          <KeyFindings area={area} best={best} />
        </section>

        <Cheapest area={area} best={best} win={win} />
        <Cold area={area} />
        <SelfSupply area={area} setArea={setArea} />
        <Norgespris area={area} />
        <Method />
      </main>

      <Separator />
      <footer className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-10 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-[#e4c590]" /> Strømmen din · Strømstad, gruppe 6
        </div>
        <div>
          Data: Elhub (CC BY 4.0) · Meteorologisk institutt · Nord Pool. Priser er spotpris eks. nettleie, avgifter og mva.
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={"text-3xl font-light tabular-nums tracking-tight " + (accent ? "text-[#34d399]" : "")}>{value}</CardTitle>
        {hint && <CardDescription className="text-xs">{hint}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

function Heading({ n, title, lead }: { n: string; title: string; lead: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className="mb-3 flex items-center gap-3 text-xs tracking-[0.2em] text-muted-foreground">
        <span className="text-[#e4c590]">{n}</span>
        <span className="h-px w-10 bg-border" />
      </div>
      <h2 className="text-3xl font-light tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base font-light text-muted-foreground sm:text-lg">{lead}</p>
    </div>
  );
}

function Cheapest({ area, best, win }: { area: Area; best: number; win: (s: number) => number }) {
  const h = useMemo(() => household(area), [area]);
  const cheap = [0, 1, 2, 3].map((k) => (best + k) % 24);
  const dear = [17, 18, 19, 20];
  const [ev, setEv] = useState(10);
  const [wash, setWash] = useState(2);
  const [water, setWater] = useState(3);
  const saving = (ev + wash + water) * 30 * (win(17) - win(best));
  const items = [
    { icon: Car, label: "Elbil", v: ev, set: setEv, max: 30 },
    { icon: WashingMachine, label: "Vask og oppvask", v: wash, set: setWash, max: 6 },
    { icon: ShowerHead, label: "Varmtvann", v: water, set: setWater, max: 8 },
  ];
  return (
    <section id="billigst" className="scroll-mt-28">
      <Heading n="01" title="Når er strømmen billigst?" lead="Vi bruker mest strøm når den er dyrest. Å flytte litt av forbruket til natta er den enkleste måten å spare på." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-normal">Ditt forbruk og prisen gjennom døgnet</CardTitle>
            <CardDescription>Gjennomsnitt per time, siste 90 dager</CardDescription>
          </CardHeader>
          <Legend
            items={[
              { label: "Billigste timer", color: C.cheap },
              { label: "Dyreste timer", color: C.dear },
              { label: "Forbruk (kWh)", color: C.use },
              { label: "Spotpris", color: C.price, line: true },
            ]}
          />
          <CardContent className="h-64 px-2 sm:h-72">
            <ResponsiveContainer>
              <ComposedChart data={h.profile}>
                <XAxis dataKey="h" {...axis} interval={2} />
                <YAxis {...axis} width={28} tickFormatter={(v) => fmt(v, 1)} />
                <YAxis yAxisId="p" orientation="right" hide />
                <Tooltip {...tip} labelFormatter={(v) => `kl. ${v}:00`} formatter={(v) => fmt(Number(v), 2)} />
                <Bar dataKey="kwh" name="kWh per hjem" radius={[3, 3, 0, 0]}>
                  {h.profile.map((x) => (
                    <Cell key={x.h} fill={cheap.includes(x.h) ? C.cheap : dear.includes(x.h) ? C.dear : C.use} fillOpacity={0.85} />
                  ))}
                </Bar>
                <Line yAxisId="p" dataKey="price" name="kr/kWh" stroke={C.price} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-normal">Flytt forbruket fra kl. 17–21</CardTitle>
            <CardDescription>Dra i sliderne – kWh per dag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map((it) => (
              <div key={it.label} className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <it.icon className="size-4" /> {it.label}
                  </span>
                  <span className="tabular-nums">{it.v} kWh</span>
                </div>
                <Slider value={[it.v]} min={0} max={it.max} onValueChange={(v) => it.set((v as number[])[0])} />
              </div>
            ))}
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground">Du sparer</div>
              <div className="text-4xl font-light tabular-nums tracking-tight text-[#34d399]">{kr(saving)}</div>
              <div className="text-sm text-muted-foreground">per måned · {kr(saving * 12)} per år</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Cold({ area }: { area: Area }) {
  const m = useMemo(() => forecastModel(area, "household"), [area]);
  const h = useMemo(() => household(area), [area]);
  const perDeg = (m.sensitivity * 24) / h.homes;
  const fc = m.forecast.map((x) => {
    const o = osloParts(x.t);
    const day = new Date(o.date + "T12:00:00Z").toLocaleDateString("nb-NO", { weekday: "short" });
    return { label: `${day} ${String(o.hour).padStart(2, "0")}:00`, temp: x.temp, kwh: x.predicted / h.homes };
  });
  return (
    <section id="kulde" className="scroll-mt-28">
      <Heading
        n="02"
        title="Kaldt vær gir høyere strømforbruk"
        lead={`For hver grad kaldere bruker et hjem ${CITY[area].in} ${fmt(perDeg, 1)} kWh mer per døgn — rundt ${kr(perDeg * h.avgPrice)}.`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <Snowflake className="size-4 text-[#93c5fd]" /> Neste 72 timer, basert på yr-varselet
          </CardTitle>
          <CardDescription>Modellen traff innenfor {fmt(m.mape, 1)} % på en uke den ikke hadde sett.</CardDescription>
        </CardHeader>
        <Legend
          items={[
            { label: "Forventet forbruk per hjem (kWh/time)", color: C.price },
            { label: "Temperatur (°C)", color: C.temp, line: true },
          ]}
        />
        <CardContent className="h-56 px-2 sm:h-64">
          <ResponsiveContainer>
            <ComposedChart data={fc}>
              <defs>
                <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={C.price} stopOpacity={0.35} />
                  <stop offset="1" stopColor={C.price} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...axis} interval={11} />
              <YAxis {...axis} width={28} tickFormatter={(v) => fmt(v, 1)} />
              <YAxis yAxisId="t" orientation="right" {...axis} width={28} unit="°" />
              <Tooltip {...tip} formatter={(v) => fmt(Number(v), 1)} />
              <RArea dataKey="kwh" name="kWh per hjem" stroke={C.price} fill="url(#g)" strokeWidth={2} />
              <Line yAxisId="t" dataKey="temp" name="°C" stroke={C.temp} dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}

const LABEL: Record<Area, [number, number]> = { NO1: [60.9, 11.0], NO2: [58.9, 7.6], NO3: [63.6, 11.0], NO4: [68.4, 18.0], NO5: [61.2, 6.2] };
// Same transverse Mercator as scripts/fetch-geo.mjs.
const project = (lat: number, lon: number) => {
  const φ = (lat * Math.PI) / 180;
  const dλ = ((lon - map.lon0) * Math.PI) / 180;
  const B = Math.cos(φ) * Math.sin(dλ);
  const x = 0.5 * Math.log((1 + B) / (1 - B));
  const y = Math.atan2(Math.tan(φ), Math.cos(dλ));
  return [(x - map.minX) * map.scale, (map.maxY - y) * map.scale] as [number, number];
};
const supplyColor = (pct: number) =>
  pct >= 100 ? `rgba(52,211,153,${Math.min(0.85, 0.25 + (pct - 100) / 150)})` : `rgba(248,113,113,${Math.min(0.85, 0.25 + (100 - pct) / 80)})`;

function SelfSupply({ area, setArea }: { area: Area; setArea: (a: Area) => void }) {
  const all = useMemo(() => overview(), []);
  const totals = useMemo(
    () =>
      Object.fromEntries(
        AREAS.map((a) => {
          const d = dailyNexus(a);
          return [a, { prod: d.reduce((s, x) => s + x.production, 0), cons: d.reduce((s, x) => s + x.consumption, 0) }];
        }),
      ),
    [],
  );
  const norway = (100 * AREAS.reduce((s, a) => s + totals[a].prod, 0)) / AREAS.reduce((s, a) => s + totals[a].cons, 0);
  const d = useMemo(() => dailyNexus(area), [area]);
  const daily = d.map((x) => ({ date: x.date.slice(5), pct: (100 * x.production) / x.consumption }));
  const deficitDays = daily.filter((x) => x.pct < 100).length;
  const sel = all.find((r) => r.area === area)!;
  const ranked = [...all].sort((a, b) => b.selfSufficiency - a.selfSufficiency);
  const maxPct = ranked[0].selfSufficiency;
  const prod = d.reduce((s, x) => s + x.production, 0);
  const share = (k: "hydro" | "wind" | "solar") => (100 * d.reduce((s, x) => s + x[k], 0)) / prod;
  return (
    <section id="forsyning" className="scroll-mt-28">
      <Heading
        n="03"
        title="Hvem forsyner hvem?"
        lead={`Norge produserte ${fmt(norway)} % av strømmen vi brukte. Men landet er delt: noen regioner har store overskudd, andre er avhengige av naboene.`}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-1 flex-col justify-center gap-4 py-2">
            <svg viewBox={`0 0 ${map.width} ${map.height}`} className="h-auto w-full" role="img" aria-label="Kart over Norges prisområder farget etter selvforsyning">
              {AREAS.map((a) => {
                const r = all.find((x) => x.area === a)!;
                return (
                  <path
                    key={a}
                    d={(map.paths as Record<string, string>)[a]}
                    fill={supplyColor(r.selfSufficiency)}
                    stroke={a === area ? "#fafafa" : "#09090b"}
                    strokeWidth={a === area ? 2.5 : 1}
                    className="cursor-pointer transition-all duration-300 hover:brightness-125"
                    onClick={() => setArea(a)}
                  >
                    <title>{`${CITY[a].city}: ${fmt(r.selfSufficiency)} %`}</title>
                  </path>
                );
              })}
              {AREAS.map((a) => {
                const [x, y] = project(...LABEL[a]);
                const r = all.find((v) => v.area === a)!;
                return (
                  <g key={a} className="pointer-events-none" textAnchor="middle">
                    <text x={x} y={y} fill="#fafafa" fontSize={15} fontWeight={300}>
                      {fmt(r.selfSufficiency)} %
                    </text>
                    <text x={x} y={y + 11} fill="#d4d4d8" fontSize={7.5} letterSpacing={0.8}>
                      {CITY[a].city.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="px-2">
              <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${supplyColor(30)}, ${supplyColor(99)}, ${supplyColor(101)}, ${supplyColor(200)})` }} />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Underskudd</span>
                <span>100 %</span>
                <span>Overskudd</span>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Klikk på en region for å velge den</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardDescription>{CITY[area].city}-regionen produserer</CardDescription>
              <CardTitle className="text-5xl font-light tabular-nums tracking-tight" style={{ color: sel.selfSufficiency >= 100 ? "#34d399" : "#f87171" }}>
                {fmt(sel.selfSufficiency)} %
              </CardTitle>
              <CardDescription>
                {sel.selfSufficiency >= 100
                  ? `av det den bruker – overskuddet sendes til naboregionene og utlandet.`
                  : `av det den bruker. Resten – ${fmt(100 - sel.selfSufficiency)} % – må hentes fra naboene.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ranked.map((r) => (
                <button key={r.area} onClick={() => setArea(r.area)} className="block w-full text-left">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={r.area === area ? "text-foreground" : "text-muted-foreground"}>{CITY[r.area].city}</span>
                    <span className="tabular-nums">{fmt(r.selfSufficiency)} %</span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(r.selfSufficiency / maxPct) * 100}%`, background: supplyColor(r.selfSufficiency) }} />
                    <div className="absolute top-[-3px] h-3 w-px bg-zinc-400" style={{ left: `${(100 / maxPct) * 100}%` }} />
                  </div>
                </button>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">Streken markerer 100 % – akkurat nok til seg selv.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-normal">Dag for dag</CardTitle>
              <CardDescription>
                {deficitDays === 0
                  ? "Overskudd hver eneste dag de siste 90 dagene."
                  : deficitDays === daily.length
                    ? "Underskudd hver eneste dag de siste 90 dagene."
                    : `Underskudd ${deficitDays} av ${daily.length} dager.`}{" "}
                Vann {fmt(share("hydro"))} % · vind {fmt(share("wind"), 1)} % · sol {fmt(share("solar"), 1)} %.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-40 px-2">
              <ResponsiveContainer>
                <ComposedChart data={daily}>
                  <XAxis dataKey="date" {...axis} interval={14} />
                  <YAxis {...axis} width={34} unit="%" />
                  <ReferenceLine y={100} stroke="#a1a1aa" strokeDasharray="3 3" />
                  <Tooltip {...tip} formatter={(v) => `${fmt(Number(v))} %`} />
                  <Bar dataKey="pct" name="Selvforsyning" radius={[2, 2, 0, 0]}>
                    {daily.map((x) => (
                      <Cell key={x.date} fill={supplyColor(x.pct)} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Norgespris({ area }: { area: Area }) {
  const n = useMemo(() => norgespris(area), [area]);
  const h = useMemo(() => household(area), [area]);
  const share = n.adoption.at(-1)!.share;
  const spot = h.avgPrice * n.avgKwhNp * 30;
  const fixed = 0.4 * n.avgKwhNp * 30;
  const diff = (n.peakLoadNp - n.peakLoadOther) * 100;
  const max = Math.max(spot, fixed) || 1;
  return (
    <section id="norgespris" className="scroll-mt-28">
      <Heading
        n="04"
        title="Norgespris – lønte det seg, og endret det vanene?"
        lead={`${fmt(share)} % av husholdningene ${CITY[area].in} har valgt fastpris.`}
      />
      {share < 1 ? (
        <Alert>
          <Coins />
          <AlertTitle>Nesten ingen valgte Norgespris her</AlertTitle>
          <AlertDescription>Spotprisen var i snitt {fmt(h.avgPrice * 100)} øre/kWh – billigere enn fastprisen.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-normal">Typisk Norgespris-hjem, per måned</CardTitle>
              <CardDescription>{fmt(n.avgKwhNp)} kWh per døgn · eks. mva</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Med spotpris", v: spot, c: C.spot },
                { label: "Med Norgespris", v: fixed, c: C.np },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="tabular-nums">{kr(r.v)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Alert className="h-full">
            <Info />
            <AlertTitle>{Math.abs(diff) < 3 ? "Ingen tydelig endring i vaner" : diff > 0 ? "Litt mindre fleksible" : "Like fleksible"}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                I de dyreste timene bruker Norgespris-hjem {fmt(n.peakLoadNp * 100)} % av sitt vanlige forbruk, mot{" "}
                {fmt(n.peakLoadOther * 100)} % for spotkunder.
              </p>
              <p>
                Begge grupper bruker mest når folk er hjemme – spotkundene flyttet lite fra før. Gruppene er ikke like, så dette er
                en pekepinn, ikke et bevis.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </section>
  );
}
