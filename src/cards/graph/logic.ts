import { clock, fmtNum } from "../../shared/format";
import { bucket, type Sample } from "../../shared/history";
import type { HassEntity, HomeAssistant } from "../../shared/types";
import { startOfDay } from "../../shared/util";
import { findList, normalUnit, readForecast, readList, type Point, type RawForecast, type Slot } from "./sources";

export type Source = "history" | "statistics" | "attribute" | "energy_forecast";
export type Style = "line" | "area" | "bars";
export type Period = "day" | "last" | "next" | "around";
export type Calc = "now" | "next" | "lowest" | "highest" | "average" | "total" | "remaining";
export type FigureWindow = "today" | "tomorrow" | "period" | "next";

/** Same format as the Entity card's colour rules: the first one the value meets wins. */
export interface ColourRule { above?: number; below?: number; colour: string }

export interface SeriesConfig {
  name?: string;
  /** One entity, or several joined end to end (Agile's today and tomorrow). */
  entity?: string;
  entities?: string[];
  /** Found from the entity if not set; energy_forecast needs no entity. */
  source?: Source;
  /** A list attribute nobody has a preset for, and the keys in its rows. */
  attribute?: string;
  start_key?: string;
  end_key?: string;
  value_key?: string;
  /** energy_forecast: one Forecast.Solar config entry (default: every forecast added together). */
  forecast_entry?: string;
  style?: Style;
  /** Palette name or any CSS colour. Lines default to the text colour; bars use this for values no rule matches. */
  colour?: string;
  colour_rules?: ColourRule[];
  /** Override the unit shown (the value is not converted). */
  unit?: string;
  decimals?: number;
  /** History drawn as bars: the length of each bar. */
  slot_minutes?: number;
}

export interface FigureConfig {
  label?: string;
  /** Series name, or its position from 0. Default: the first. */
  series?: string | number;
  calc?: Calc;
  window?: FigureWindow;
  /** For window: next. */
  hours?: number;
  /** Another series: the note shows this figure as a percentage of that one's total over the same time so far (generated against forecast). */
  compare?: string | number;
  /** A plain entity's state instead of a series. */
  entity?: string;
  /** The note under the figure (default on). */
  note?: boolean;
  decimals?: number;
  icon?: string;
  icon_svg?: string;
  icon_colour?: string;
}

export interface HaloGraphConfig {
  type: string;
  name?: string;
  shadow?: boolean;
  /** day: midnight to midnight, with a Tomorrow pill once there is data for it. last / next / around: hours before, after or either side of now. */
  period?: Period;
  /** 1 to 168, for last / next / around (default 24). */
  hours?: number;
  /** Trim hours at either end where every series is zero (night, for solar). */
  fit?: boolean;
  series: SeriesConfig[];
  /** Up to four figures across the top. */
  figures?: FigureConfig[];
}

const HOUR = 3600_000;
export const MAX_FIGURES = 4;

export interface Series {
  name: string;
  kind: "points" | "slots";
  points: Point[];
  slots: Slot[];
  style: Style;
  colour?: string;
  rules: ColourRule[];
  unit: string;
  decimals: number;
}

/** Everything the card has fetched. */
export interface Fetched { history: Record<string, Sample[]>; statistics: Record<string, Sample[]>; forecast?: RawForecast }

export const entitiesOf = (s: SeriesConfig) => [...(s.entities ?? []), ...(s.entity ? [s.entity] : [])].filter(Boolean);
export const hoursOf = (h?: number) => Math.min(Math.max(Math.round(Number(h) || 24), 1), 168);

/** Where a series reads from: as set, else the forecast with no entity, a known list attribute, or the entity's history. */
export function sourceOf(hass: HomeAssistant, s: SeriesConfig): Source {
  if (s.source) return s.source;
  const ids = entitiesOf(s);
  if (!ids.length) return "energy_forecast";
  if (s.attribute || ids.some((id) => findList(hass.states[id]))) return "attribute";
  return "history";
}

/** History over longer than a day comes from hourly statistics, for sensors that keep them. */
export const useStatistics = (hass: HomeAssistant, s: SeriesConfig, from: number, now: number) =>
  sourceOf(hass, s) === "statistics" || (sourceOf(hass, s) === "history" && now - from > 25 * HOUR && !!hass.states[entitiesOf(s)[0]]?.attributes?.state_class);

const DECIMALS: Record<string, number> = { p: 1, kW: 2, kWh: 1, "%": 0 };

export function buildSeries(hass: HomeAssistant, cfg: HaloGraphConfig, data: Fetched, now: number): Series[] {
  return (cfg.series ?? []).map((s, i) => {
    const source = sourceOf(hass, s), ids = entitiesOf(s);
    let points: Point[] = [], slots: Slot[] = [], unit = "";
    if (source === "energy_forecast") {
      slots = readForecast(data.forecast, s.forecast_entry || undefined);
      unit = "kW";
    } else if (source === "attribute") {
      for (const id of ids) {
        const r = readList(hass.states[id], s);
        slots.push(...r.slots);
        unit ||= r.unit;
      }
      const seen = new Map<number, Slot>();
      for (const x of slots) seen.set(x.t0, x);
      slots = [...seen.values()].sort((a, b) => a.t0 - b.t0);
      const n = normalUnit(unit);
      if (n.k !== 1) slots = slots.map((x) => ({ ...x, v: x.v * n.k }));
      unit = n.unit;
    } else {
      const id = ids[0], e = hass.states[id];
      const n = normalUnit(String(e?.attributes?.unit_of_measurement ?? ""));
      const raw = data.statistics[id]?.length ? data.statistics[id] : data.history[id] ?? [];
      points = raw.filter((x): x is { t: number; v: number } => x.v !== null).map((x) => ({ t: x.t, v: x.v * n.k })).sort((a, b) => a.t - b.t);
      // Carry the line on to now with the live state.
      const live = Number(e?.state);
      if (e && Number.isFinite(live) && e.state !== "" && points.length) points.push({ t: now, v: live * n.k });
      unit = n.unit;
    }
    const style = s.style ?? (source === "history" || source === "statistics" ? "line" : unit === "kW" ? "area" : "bars");
    if (style === "bars" && points.length) { slots = toSlots(points, (s.slot_minutes || 60) * 60_000); points = []; }
    return {
      name: s.name || (ids[0] && (hass.states[ids[0]]?.attributes?.friendly_name as string)) || (source === "energy_forecast" ? "Forecast" : `Series ${i + 1}`),
      kind: slots.length || source === "attribute" || source === "energy_forecast" ? "slots" : "points",
      points, slots, style, colour: s.colour, rules: s.colour_rules ?? [],
      unit: s.unit ?? unit, decimals: s.decimals ?? DECIMALS[unit] ?? 1,
    };
  });
}

/** Readings averaged into bars of a fixed length, on the clock (every hour on the hour). */
export function toSlots(points: Point[], len: number): Slot[] {
  if (!points.length) return [];
  const t0 = Math.floor(points[0].t / len) * len, t1 = Math.ceil(points[points.length - 1].t / len) * len;
  const n = Math.max(Math.round((t1 - t0) / len), 1);
  return bucket(points, t0, t1, n).flatMap((v, i) => (v === null ? [] : [{ t0: t0 + i * len, t1: t0 + (i + 1) * len, v }]));
}

// ---- time ----------------------------------------------------------------

export function chartWindow(cfg: HaloGraphConfig, now: number, day: "today" | "tomorrow"): [number, number] {
  const h = hoursOf(cfg.hours) * HOUR;
  switch (cfg.period ?? "day") {
    case "last": return [now - h, now];
    case "next": return [now, now + h];
    case "around": return [now - h / 2, now + h / 2];
    default: return day === "tomorrow" ? [startOfDay(now, 1), startOfDay(now, 2)] : [startOfDay(now), startOfDay(now, 1)];
  }
}

const inWindow = (s: Series, w: [number, number]) =>
  s.kind === "slots" ? s.slots.filter((x) => x.t1 > w[0] && x.t0 < w[1]) : s.points.filter((x) => x.t >= w[0] && x.t <= w[1]);

/** The hours where any series is not zero, with an hour either side (and at least eight hours), inside the window. */
export function fitWindow(series: Series[], w: [number, number]): [number, number] {
  let a = Infinity, b = -Infinity;
  for (const s of series) for (const x of inWindow(s, w)) {
    if (Math.abs(x.v) < 1e-3) continue;
    const [t0, t1] = "t" in x ? [x.t, x.t] : [x.t0, x.t1];
    a = Math.min(a, t0); b = Math.max(b, t1);
  }
  if (!Number.isFinite(a)) return w;
  const lo = Math.max(w[0], Math.floor(a / HOUR) * HOUR - HOUR);
  const hi = Math.min(w[1], Math.max(Math.ceil(b / HOUR) * HOUR + HOUR, lo + 8 * HOUR));
  return [lo, hi];
}

/** Whether any series has something for tomorrow (Agile after about 16:00, a forecast). */
export const hasTomorrow = (series: Series[], now: number) => {
  const w: [number, number] = [startOfDay(now, 1), startOfDay(now, 2)];
  return series.some((s) => inWindow(s, w).length > 0);
};

// ---- reading ---------------------------------------------------------------

const slotAt = (s: Series, t: number) => s.slots.find((x) => x.t0 <= t && t < x.t1);
export function valueAt(s: Series, t: number): number | undefined {
  if (s.kind === "slots") return slotAt(s, t)?.v;
  const p = s.points;
  if (p.length < 1 || t < p[0].t || t > p[p.length - 1].t) return undefined;
  const i = p.findIndex((x) => x.t >= t);
  if (i <= 0) return p[0].v;
  const a = p[i - 1], b = p[i];
  return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
}
/** The slot under the pointer, for the readout's "16:30–17:00". */
export const slotFor = (series: Series[], t: number) => series.filter((s) => s.style === "bars").map((s) => slotAt(s, t)).find(Boolean);

/**
 * Total between two times. Power (kW) becomes energy (kWh); slots of anything else are added up;
 * a running total (points of kWh, £) is its rise.
 */
export function total(s: Series, t0: number, t1: number): { v: number; unit: string } | undefined {
  if (t1 <= t0) return { v: 0, unit: s.unit === "kW" ? "kWh" : s.unit };
  if (s.unit === "kW") {
    if (s.kind === "slots") return { v: s.slots.reduce((a, x) => a + (x.v * Math.max(0, Math.min(x.t1, t1) - Math.max(x.t0, t0))) / HOUR, 0), unit: "kWh" };
    const p = s.points.filter((x) => x.t >= t0 && x.t <= t1);
    if (p.length < 2) return undefined;
    let sum = 0;
    for (let i = 1; i < p.length; i++) sum += (((p[i].v + p[i - 1].v) / 2) * (p[i].t - p[i - 1].t)) / HOUR;
    return { v: sum, unit: "kWh" };
  }
  if (s.kind === "slots") return { v: s.slots.filter((x) => x.t0 >= t0 && x.t0 < t1).reduce((a, x) => a + x.v, 0), unit: s.unit };
  const a = valueAt(s, Math.max(t0, s.points[0]?.t ?? t0)), b = valueAt(s, Math.min(t1, s.points[s.points.length - 1]?.t ?? t1));
  return a === undefined || b === undefined ? undefined : { v: b - a, unit: s.unit };
}

// ---- figures ---------------------------------------------------------------

export interface Figure { label: string; value: string; unit: string; note?: string; good?: boolean; icon?: string; icon_svg?: string; icon_colour?: string }

const CALC_LABELS: Record<Calc, string> = { now: "Now", next: "Next", lowest: "Lowest", highest: "Highest", average: "Average", total: "Total", remaining: "Remaining" };
export const seriesFor = (series: Series[], cfg: HaloGraphConfig, ref: string | number | undefined) => {
  if (ref === undefined || ref === "") return series[0];
  const i = typeof ref === "number" ? ref : (cfg.series ?? []).findIndex((s, j) => (s.name || series[j]?.name) === ref);
  return series[i >= 0 ? i : Number(ref)] ?? undefined;
};

function figureWindow(f: FigureConfig, now: number, period: [number, number]): [number, number] {
  switch (f.window ?? "period") {
    case "today": return [startOfDay(now), startOfDay(now, 1)];
    case "tomorrow": return [startOfDay(now, 1), startOfDay(now, 2)];
    case "next": return [now, now + hoursOf(f.hours) * HOUR];
    default: return period;
  }
}

export function buildFigure(hass: HomeAssistant, cfg: HaloGraphConfig, series: Series[], f: FigureConfig, now: number, period: [number, number]): Figure {
  const base = { icon: f.icon, icon_svg: f.icon_svg, icon_colour: f.icon_colour };
  if (f.entity) {
    const e: HassEntity | undefined = hass.states[f.entity];
    const n = Number(e?.state), unit = String(e?.attributes?.unit_of_measurement ?? "");
    const value = !e || e.state === "unavailable" || e.state === "unknown" ? "–" : Number.isFinite(n) && e.state !== "" ? fmtNum(n, f.decimals ?? 1) : hass.formatEntityState?.(e) ?? e.state;
    return { ...base, label: f.label ?? ((e?.attributes?.friendly_name as string) || f.entity), value, unit };
  }
  const s = seriesFor(series, cfg, f.series);
  const calc = f.calc ?? "now";
  const label = f.label ?? CALC_LABELS[calc];
  if (!s) return { ...base, label, value: "–", unit: "" };
  const w = figureWindow(f, now, period);
  const dp = f.decimals ?? s.decimals;
  const out = (v: number | undefined, unit = s.unit, note?: string, d = dp): Figure =>
    ({ ...base, label, value: v === undefined ? "–" : fmtNum(v, d), unit, note: f.note === false || v === undefined ? undefined : note });
  const inW = (t0: number) => t0 >= w[0] && t0 < w[1];
  switch (calc) {
    case "now": {
      if (s.kind === "slots") { const x = slotAt(s, now); return out(x?.v, s.unit, x ? `until ${clock(x.t1)}` : undefined); }
      return out(s.points.length ? s.points[s.points.length - 1].v : undefined);
    }
    case "next": {
      const cur = slotAt(s, now), x = s.slots.find((y) => y.t0 >= (cur?.t1 ?? now));
      return out(x?.v, s.unit, x ? `from ${clock(x.t0)}` : undefined);
    }
    case "lowest": case "highest": {
      const c = s.kind === "slots" ? s.slots.filter((x) => inW(x.t0)).map((x) => ({ t: x.t0, v: x.v })) : s.points.filter((x) => inW(x.t));
      if (!c.length) return out(undefined);
      const x = c.reduce((a, b) => (calc === "lowest" ? (b.v < a.v ? b : a) : b.v > a.v ? b : a));
      return out(x.v, s.unit, `at ${clock(x.t)}`);
    }
    case "average": {
      const c = s.kind === "slots" ? s.slots.filter((x) => inW(x.t0)) : s.points.filter((x) => inW(x.t));
      const note = f.window === "today" ? "today" : f.window === "tomorrow" ? "tomorrow" : undefined;
      return out(c.length ? c.reduce((a, x) => a + x.v, 0) / c.length : undefined, s.unit, note);
    }
    case "total": case "remaining": {
      const from = calc === "remaining" ? Math.max(now, w[0]) : w[0];
      const t = total(s, from, w[1]);
      if (!t) return out(undefined);
      const d = f.decimals ?? DECIMALS[t.unit] ?? 1;
      const other = f.compare !== undefined && f.compare !== "" ? seriesFor(series, cfg, f.compare) : undefined;
      if (other) {
        // Against the other series over the same time so far: generated against forecast up to now.
        const ref = total(other, from, Math.min(now, w[1]));
        if (ref && ref.v > 0.05) {
          const pct = Math.round((t.v / ref.v) * 100);
          return { ...out(t.v, t.unit, `${pct}%`, d), good: pct >= 90 };
        }
      }
      return out(t.v, t.unit, undefined, d);
    }
  }
}

// ---- drawing helpers -------------------------------------------------------

/** Units in the order series use them: the first on the left axis, the second on the right. More than two share the right. */
export function axesOf(series: Series[]): string[] {
  const units: string[] = [];
  for (const s of series) if (!units.includes(s.unit)) units.push(s.unit);
  return units.slice(0, 2);
}
export const sideOf = (series: Series[], s: Series) => (axesOf(series)[0] === s.unit ? "L" : "R");

/** An axis from zero (or below, for negative prices) to just over the top, in 2 to 4 round steps. */
export function niceAxis(lo: number, hi: number): { min: number; max: number; ticks: number[] } {
  lo = Math.min(lo, 0);
  hi = Math.max(hi * 1.08, lo + 0.3);
  let step = 1;
  outer: for (let k = -3; k <= 7; k++) for (const m of [1, 2, 2.5, 5]) { step = m * 10 ** k; if ((hi - lo) / step <= 4) break outer; }
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(6)));
  return { min, max, ticks };
}

export function rangeOf(series: Series[], w: [number, number]): [number, number] {
  let lo = 0, hi = 0;
  for (const s of series) for (const x of inWindow(s, w)) { lo = Math.min(lo, x.v); hi = Math.max(hi, x.v); }
  return [lo, hi];
}

/** A bar's colour: the first rule its value meets, else the series colour. */
export function barColour(s: Series, v: number): string | undefined {
  for (const r of s.rules) {
    if (!r?.colour || (r.above === undefined && r.below === undefined)) continue;
    if ((r.above === undefined || v > r.above) && (r.below === undefined || v < r.below)) return r.colour;
  }
  return s.colour;
}

export { inWindow };

// ---- presets ---------------------------------------------------------------

const OCTOPUS = `<svg viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M12 2.5c-4.3 0-7.2 3-7.2 6.9 0 2.1.8 3.6 2 4.7-.2 1.7-1.2 2.6-2.7 3.2-.9.4-.7 1.7.3 1.7 2.6 0 4.4-1.2 5.2-3 .5-.1 1-.1 1.4-.1v.1c.1 1.6-.4 2.9-1.6 3.9-.8.7-.3 1.9.7 1.7 2.2-.4 3.6-2.1 3.8-5.1.4 0 .7 0 1 .1.7 1.8 2.6 3 5.2 3 1 0 1.2-1.3.3-1.7-1.5-.6-2.5-1.5-2.7-3.2 1.2-1.1 2-2.6 2-4.7 0-3.9-2.9-6.9-7.2-6.9zM9.3 9.2a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM12.5 9.2a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z"/></svg>`;

/** The old Solar Forecast card: the Energy dashboard's forecast as a yellow area, your PV power as a line. */
export function solarPreset(hass?: HomeAssistant): Omit<HaloGraphConfig, "type"> {
  const pv = Object.keys(hass?.states ?? {}).find((e) => e.startsWith("sensor.") && /solar|pv/.test(e) && hass?.states[e].attributes.device_class === "power");
  return {
    name: "Solar forecast", period: "day", fit: true,
    series: [{ name: "Forecast", source: "energy_forecast", style: "area", colour: "yellow" }, ...(pv ? [{ name: "Actual", entity: pv, style: "line" as const }] : [])],
    figures: [
      ...(pv ? [{ label: "Generated", series: "Actual", calc: "total" as const, window: "today" as const, compare: "Forecast" }] : []),
      { label: "Remaining", series: "Forecast", calc: "remaining", window: "today" },
      { label: "Today", series: "Forecast", calc: "total", window: "today" },
      { label: "Tomorrow", series: "Forecast", calc: "total", window: "tomorrow" },
    ],
  };
}

/** The old Agile card: half-hourly rates as bars, green when cheap and red when dear. */
export function agilePreset(hass?: HomeAssistant): Omit<HaloGraphConfig, "type"> {
  const ids = Object.keys(hass?.states ?? {});
  const entities = [ids.find((e) => /^(event|sensor)\..*current_day_rates$/.test(e)), ids.find((e) => /^(event|sensor)\..*next_day_rates$/.test(e))].filter((x): x is string => !!x);
  return {
    name: "Agile rates", period: "day",
    series: [{ name: "Rate", entities, style: "bars", colour: "yellow", colour_rules: [{ below: 15, colour: "green" }, { above: 30, colour: "red" }] }],
    figures: [
      { label: "Current", calc: "now", icon_svg: OCTOPUS, icon_colour: "purple" },
      { label: "Next", calc: "next" },
      { label: "Lowest", calc: "lowest", window: "today", icon: "mdi:arrow-down", icon_colour: "green" },
      { label: "Highest", calc: "highest", window: "today", icon: "mdi:arrow-up", icon_colour: "red" },
    ],
  };
}
