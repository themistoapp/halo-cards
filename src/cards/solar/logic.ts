import type { HassEntity } from "../../shared/types";
import { bucket, type Sample } from "../energy/logic";

export interface HaloSolarConfig {
  type: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  /** Your total PV power sensor (W or kW). Drawn over the forecast for today. */
  actual?: string;
  /** Forecast.Solar config entry to use. Default: every forecast in the Energy dashboard added together. */
  forecast_entry?: string;
}

/** What energy/solar_forecast returns: per config entry, Wh for each hour. */
export type RawForecast = Record<string, { wh_hours?: Record<string, number> }>;
export interface Hour { t: number; wh: number }

const HOUR = 3600_000;

/** Adds the chosen entries' hours together (one entry, or all of them) and sorts by time. */
export function parseForecast(raw: RawForecast | undefined, entry?: string): Hour[] {
  if (!raw) return [];
  const sum = new Map<number, number>();
  for (const [id, v] of Object.entries(raw)) {
    if (entry && id !== entry) continue;
    for (const [iso, wh] of Object.entries(v?.wh_hours ?? {})) {
      const t = Date.parse(iso);
      if (Number.isFinite(t) && typeof wh === "number" && Number.isFinite(wh)) sum.set(t, (sum.get(t) ?? 0) + wh);
    }
  }
  return [...sum].map(([t, wh]) => ({ t, wh })).sort((a, b) => a.t - b.t);
}

export const startOfDay = (ms: number, plusDays = 0) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + plusDays); return d.getTime(); };

/** Local midnight to midnight. */
export const hoursOn = (hours: Hour[], dayStart: number) => {
  const end = new Date(dayStart); end.setDate(end.getDate() + 1);
  return hours.filter((h) => h.t >= dayStart && h.t < end.getTime());
};

/** kW the entity reports, whatever its unit. */
export function toKw(e: HassEntity | undefined, v: number | null): number | null {
  if (v === null) return null;
  const unit = String(e?.attributes?.unit_of_measurement ?? "W").toLowerCase();
  return unit === "kw" ? v : unit === "mw" ? v * 1000 : unit === "w" ? v / 1000 : v / 1000;
}

const STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50];
/** Axis with three equal steps above zero and a little headroom over the highest value. */
export function niceAxis(maxKw: number): { step: number; max: number } {
  const need = Math.max(maxKw * 1.08, 0.3) / 3;
  const step = STEPS.find((s) => s >= need) ?? Math.ceil(need);
  return { step, max: Number((step * 3).toFixed(2)) };
}

export interface Pt { x: number; kw: number }
export interface SolarModel {
  /** Hours (decimals from local midnight) the chart covers. */
  x0: number; x1: number;
  ticks: number[];
  axis: { step: number; max: number };
  forecast: Pt[];
  actual: Pt[];
  forecastKwh: number;
  peak?: { kw: number; x: number };
  /** Today only. */
  generatedKwh?: number;
  /** Forecast still to come today (kWh). */
  remainingKwh?: number;
  pct?: number;
  nowX?: number;
  nowKw?: number;
  empty: boolean;
}

const hourOfDay = (ms: number, dayStart: number) => (ms - dayStart) / HOUR;

/**
 * One day of the chart. Forecast hours are Wh per hour, drawn as the average kW at the middle of the hour and tapered to zero at each end.
 * Actual is bucketed to 10 minutes and carried forward to now.
 */
export function buildSolar(opts: { hours: Hour[]; day: "today" | "tomorrow"; now: number; samples?: Sample[]; entity?: HassEntity }): SolarModel {
  const dayStart = startOfDay(opts.now, opts.day === "today" ? 0 : 1);
  const hrs = hoursOn(opts.hours, dayStart).filter((h) => h.wh > 0);
  if (!hrs.length) return { x0: 6, x1: 19, ticks: [6, 9, 12, 15, 18], axis: niceAxis(0), forecast: [], actual: [], forecastKwh: 0, empty: true };

  const first = hourOfDay(hrs[0].t, dayStart), last = hourOfDay(hrs[hrs.length - 1].t, dayStart) + 1;
  const forecast: Pt[] = [{ x: first, kw: 0 }, ...hrs.map((h) => ({ x: hourOfDay(h.t, dayStart) + 0.5, kw: h.wh / 1000 })), { x: last, kw: 0 }];
  const forecastKwh = hrs.reduce((a, h) => a + h.wh, 0) / 1000;
  const top = forecast.reduce((a, p) => (p.kw > a.kw ? p : a), forecast[0]);

  const soFar = opts.day === "today" ? hrs.reduce((a, h) => a + h.wh * Math.min(Math.max((opts.now - h.t) / HOUR, 0), 1), 0) / 1000 : undefined;
  const remainingKwh = soFar === undefined ? undefined : Math.max(forecastKwh - soFar, 0);
  let actual: Pt[] = [], generatedKwh: number | undefined, pct: number | undefined, nowX: number | undefined, nowKw: number | undefined;
  if (opts.day === "today" && opts.samples) {
    const start = dayStart + Math.max(Math.floor(first) - 1, 0) * HOUR;
    const n = Math.max(Math.floor((opts.now - start) / (10 * 60_000)), 0);
    if (n > 0) {
      const vals = bucket(opts.samples, start, start + n * 10 * 60_000, n).map((v) => toKw(opts.entity, v));
      vals.forEach((v, i) => { if (v !== null) actual.push({ x: hourOfDay(start + (i + 0.5) * 10 * 60_000, dayStart), kw: Math.max(v, 0) }); });
      generatedKwh = vals.reduce<number>((a, v) => a + Math.max(v ?? 0, 0) / 6, 0);
      const lit = actual.findIndex((p) => p.kw > 0.01);
      actual = lit < 0 ? [] : actual.slice(Math.max(lit - 1, 0));
      pct = soFar !== undefined && soFar > 0.05 ? Math.round((generatedKwh / soFar) * 100) : undefined;
      const lastP = actual[actual.length - 1];
      if (lastP) { nowX = hourOfDay(opts.now, dayStart); nowKw = lastP.kw; actual = [...actual, { x: nowX, kw: lastP.kw }]; }
    }
  }

  const maxKw = Math.max(...forecast.map((p) => p.kw), ...actual.map((p) => p.kw), 0);
  const x0 = Math.max(Math.floor(first) - 1, 0), x1 = Math.min(Math.max(Math.ceil(last) + 1, x0 + 8), 24);
  const ticks: number[] = [];
  for (let t = Math.ceil(x0 / 3) * 3; t <= x1; t += 3) ticks.push(t);
  return { x0, x1, ticks, axis: niceAxis(maxKw), forecast, actual, forecastKwh, peak: { kw: top.kw, x: top.x }, generatedKwh, remainingKwh, pct, nowX, nowKw, empty: false };
}

/** Smooth curve through the points (Catmull-Rom as cubic Beziers), never dipping below zero. */
export function smoothPath(pts: [number, number][], floor: number): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(p1[1] + (p2[1] - p0[1]) / 6, floor), c2y = Math.min(p2[1] - (p3[1] - p1[1]) / 6, floor);
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export const fmtKwh = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
export const fmtClock = (x: number) => { const m = Math.round(x * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
