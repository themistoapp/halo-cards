import type { HassEntity, HaloEnergyConfig, HomeAssistant } from "../../shared/types";

export type Key = "solar" | "battery" | "grid" | "house";

export interface Tile {
  key: Key;
  figure: string;
  unit: string;
  detail?: string;
  /** Entity opened (history graph) when the tile is tapped. */
  entity?: string;
  /** Entity whose history is drawn, and how its numbers become graph values. */
  history?: { entity: string; scale: "kw" | "percent" };
}

export interface Model {
  tiles: Tile[];
  /** Per-source bloom size targets (0 = no bloom). */
  bloom: { solar: number; battery: number; grid: number };
  /** Battery state of charge 0-100 for the light bar, or undefined to hide it. */
  soc?: number;
  reserve?: { entity: string; value: number; min: number; max: number; step: number };
  mode?: { entity: string; self: string; ai: string; selected: "self" | "ai" | undefined };
  updated?: Date;
}

export const isAvailable = (e?: HassEntity): e is HassEntity =>
  !!e && e.state !== "unavailable" && e.state !== "unknown" && e.state !== "";

export function num(e?: HassEntity): number | undefined {
  if (!isAvailable(e)) return undefined;
  const v = Number(e.state);
  return Number.isFinite(v) ? v : undefined;
}

/** Reads a power entity in kW. Entities without a unit are taken to be watts. */
export function kw(e?: HassEntity): number | undefined {
  const v = num(e);
  if (v === undefined) return undefined;
  return String(e!.attributes?.unit_of_measurement ?? "W").toLowerCase() === "kw" ? v : v / 1000;
}

export function kwh(e?: HassEntity): number | undefined {
  const v = num(e);
  if (v === undefined) return undefined;
  return String(e!.attributes?.unit_of_measurement ?? "kWh").toLowerCase() === "wh" ? v / 1000 : v;
}

export const fmtKw = (v: number) => Math.abs(v).toFixed(2);
const fmtKwh = (v: number) => v.toFixed(1);

function cost(e?: HassEntity): string | undefined {
  const v = num(e);
  if (v === undefined) return undefined;
  const u = String(e!.attributes?.unit_of_measurement ?? "£");
  const amount = v.toFixed(2);
  return u === "£" || u === "GBP" ? `£${amount}` : u === "$" || u === "USD" ? `$${amount}` : u === "€" || u === "EUR" ? `€${amount}` : `${amount} ${u}`;
}

/** Tile count -> grid shape. Four is 2x2, three spans the last tile, two stack, one is a single tall tile. */
export function layoutFor(n: number): { cols: number; rows: number; spanLast: boolean } {
  if (n >= 4) return { cols: 2, rows: 2, spanLast: false };
  if (n === 3) return { cols: 2, rows: 2, spanLast: true };
  if (n === 2) return { cols: 1, rows: 2, spanLast: false };
  return { cols: 1, rows: 1, spanLast: false };
}

/** Bloom size for a source's share of current supply: share x 1.6, capped. */
export const bloomSize = (share: number, total: number) => (total > 0 ? Math.min((share / total) * 1.6, 1.1) : 0);

export function buildModel(hass: HomeAssistant, cfg: HaloEnergyConfig): Model {
  const st = (id?: string) => (id ? hass.states[id] : undefined);
  const idle = (cfg.idle_watts ?? 10) / 1000;
  const tiles: Tile[] = [];

  // Solar
  const solarKw = kw(st(cfg.solar_power));
  if (solarKw !== undefined) {
    const today = kwh(st(cfg.solar_energy));
    const forecast = kwh(st(cfg.solar_forecast));
    const detail =
      today !== undefined && forecast !== undefined ? `${fmtKwh(today)} of ${fmtKwh(forecast)} kWh forecast`
      : today !== undefined ? `${fmtKwh(today)} kWh today`
      : forecast !== undefined ? `${fmtKwh(forecast)} kWh forecast` : undefined;
    tiles.push({ key: "solar", figure: fmtKw(solarKw), unit: "kW", detail, entity: cfg.solar_power, history: { entity: cfg.solar_power!, scale: "kw" } });
  }

  // Battery: power is the headline, with the charge level and direction beneath. Either one is enough to show the tile.
  const soc = num(st(cfg.battery_soc));
  const batRaw = kw(st(cfg.battery_power));
  // Positive = discharging (supplying the house) unless inverted.
  const batKw = batRaw === undefined ? undefined : cfg.battery_invert ? -batRaw : batRaw;
  if (batKw !== undefined) {
    const word = Math.abs(batKw) < idle ? "Idle" : batKw > 0 ? "Discharging" : "Charging";
    const detail = [soc !== undefined ? `${Math.round(soc)}%` : undefined, word].filter(Boolean).join(" · ");
    tiles.push({ key: "battery", figure: fmtKw(batKw), unit: "kW", detail, entity: cfg.battery_power, history: { entity: cfg.battery_power!, scale: "kw" } });
  } else if (soc !== undefined) {
    tiles.push({ key: "battery", figure: String(Math.round(soc)), unit: "%", entity: cfg.battery_soc, history: { entity: cfg.battery_soc!, scale: "percent" } });
  }

  // Grid: positive = importing unless inverted.
  const gridRaw = kw(st(cfg.grid_power));
  const gridKw = gridRaw === undefined ? undefined : cfg.grid_invert ? -gridRaw : gridRaw;
  if (gridKw !== undefined) {
    const word = Math.abs(gridKw) < idle ? "Idle" : gridKw > 0 ? "Importing" : "Exporting";
    const c = cost(st(cfg.grid_cost));
    const detail = [word, c ? `${c} today` : undefined].filter(Boolean).join(" · ");
    tiles.push({ key: "grid", figure: fmtKw(gridKw), unit: "kW", detail, entity: cfg.grid_power, history: { entity: cfg.grid_power!, scale: "kw" } });
  }

  // House
  const homeKw = kw(st(cfg.home_power));
  if (homeKw !== undefined) {
    tiles.push({ key: "house", figure: fmtKw(homeKw), unit: "kW", entity: cfg.home_power, history: { entity: cfg.home_power!, scale: "kw" } });
  }

  // Blooms: each source with a power entity gets a share of what is being supplied right now.
  const sSolar = Math.max(solarKw ?? 0, 0);
  const sBat = Math.max(batKw ?? 0, 0);
  const sGrid = Math.max(gridKw ?? 0, 0);
  const total = sSolar + sBat + sGrid;
  const bloom = {
    solar: solarKw === undefined ? 0 : bloomSize(sSolar, total),
    battery: batKw === undefined ? 0 : bloomSize(sBat, total),
    grid: gridKw === undefined ? 0 : bloomSize(sGrid, total),
  };

  // Controls
  let reserve: Model["reserve"];
  const re = st(cfg.reserve_entity);
  const rv = num(re);
  if (rv !== undefined) {
    reserve = {
      entity: cfg.reserve_entity!, value: rv,
      min: Number(re!.attributes.min ?? 0), max: Number(re!.attributes.max ?? 100), step: Number(re!.attributes.step ?? 1),
    };
  }
  let mode: Model["mode"];
  const me = st(cfg.mode_entity);
  if (isAvailable(me)) {
    const opts: string[] = Array.isArray(me.attributes.options) ? me.attributes.options : [];
    const find = (want: string | undefined, fallback: number) =>
      opts.find((o) => want && o.toLowerCase() === want.toLowerCase()) ?? opts[fallback];
    const self = find(cfg.mode_self ?? "Self-powered", 0);
    const ai = find(cfg.mode_ai ?? "AI", 1);
    if (self && ai) {
      mode = { entity: cfg.mode_entity!, self, ai, selected: me.state === self ? "self" : me.state === ai ? "ai" : undefined };
    }
  }

  // Updated: the picked entity, otherwise the newest of everything the card uses.
  const watched = [cfg.solar_power, cfg.solar_energy, cfg.solar_forecast, cfg.battery_soc, cfg.battery_power, cfg.grid_power, cfg.grid_cost, cfg.home_power];
  const ids = cfg.updated_entity ? [cfg.updated_entity] : watched;
  const times = ids.map((id) => st(id)).filter(isAvailable).map((e) => Date.parse(e.last_updated)).filter(Number.isFinite);
  const updated = times.length ? new Date(Math.max(...times)) : undefined;

  return { tiles, bloom, soc: soc === undefined ? undefined : Math.min(Math.max(soc, 0), 100), reserve, mode, updated };
}

/** Entities the card reads, so it only re-renders when one of them changes. */
export function watchedEntities(cfg: HaloEnergyConfig): string[] {
  return [cfg.solar_power, cfg.solar_energy, cfg.solar_forecast, cfg.battery_soc, cfg.battery_power, cfg.grid_power, cfg.grid_cost, cfg.home_power, cfg.reserve_entity, cfg.mode_entity, cfg.updated_entity].filter((x): x is string => !!x);
}

// ---- history ---------------------------------------------------------------

export interface Sample { t: number; v: number | null }

/** Puts samples on n buckets between start and end; empty buckets carry the last value forward. */
export function bucket(samples: Sample[], start: number, end: number, n: number): (number | null)[] {
  const out: (number | null)[] = new Array(n).fill(null);
  const width = (end - start) / n;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  let i = 0;
  let last: number | null = null;
  while (i < sorted.length && sorted[i].t < start) last = sorted[i++].v;
  for (let b = 0; b < n; b++) {
    const bEnd = start + (b + 1) * width;
    let sum = 0, count = 0;
    while (i < sorted.length && sorted[i].t < bEnd) {
      const v = sorted[i++].v;
      if (v !== null) { sum += v; count++; }
      last = v;
    }
    out[b] = count ? sum / count : last;
  }
  return out;
}

/** Graph window: today from the start hour to now; early in the day, the last six hours instead. */
export function historyWindow(now: number, startHour: number): [number, number] {
  const d = new Date(now);
  d.setHours(startHour, 0, 0, 0);
  const start = d.getTime();
  return now - start < 30 * 60_000 ? [now - 6 * 3600_000, now] : [start, now];
}

/** Smooth path through points (Catmull-Rom as cubic Beziers) in a 100 x 60 box. */
export function graphPath(values: (number | null)[], max: number): { line: string; area: string } | undefined {
  const pts: [number, number][] = [];
  const n = values.length;
  values.forEach((v, i) => {
    if (v === null) return;
    pts.push([(i / (n - 1)) * 100, 56 - Math.min(Math.max(v / max, 0), 1) * 48]);
  });
  if (pts.length < 2) return undefined;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  const last = pts[pts.length - 1], first = pts[0];
  return { line: d, area: `${d} L${last[0].toFixed(2)},60 L${first[0].toFixed(2)},60 Z` };
}

/** Value that maps to the top of the graph. */
export function graphMax(scale: "kw" | "percent", values: (number | null)[]): number {
  if (scale === "percent") return 100;
  const m = Math.max(0, ...values.filter((v): v is number => v !== null));
  return Math.max(m * 1.15, 1);
}

/** Random start point on one of the four edges, slightly outside it. */
export function randomOrigin(rand: () => number = Math.random): [string, string] {
  const side = Math.floor(rand() * 4), along = 8 + rand() * 84, out = -6 + rand() * 12;
  const [x, y] = side === 0 ? [along, out] : side === 1 ? [100 - out, along] : side === 2 ? [along, 100 - out] : [out, along];
  return [x.toFixed(1) + "%", y.toFixed(1) + "%"];
}
