import type { HassEntity } from "../../shared/types";

// Readers for the places chart data comes from. Each ends with the same thing: points (a time and a value, from history)
// or slots (a start, an end and a value, from rate lists and forecasts).

export interface Point { t: number; v: number }
export interface Slot { t0: number; t1: number; v: number }

const HOUR = 3600_000;
const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const timeOf = (v: unknown) => (typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : typeof v === "string" ? Date.parse(v) : v instanceof Date ? v.getTime() : NaN);

/**
 * Lists that integrations keep in an entity's attributes, and what they call things:
 * Octopus Energy (rates, in £ unless already pence), Nordpool (today and tomorrow on one entity),
 * Solcast (half-hourly kW estimates with no end time) and Amber.
 */
export const FORMATS = [
  { id: "octopus", attrs: ["rates", "all_rates"], start: ["start"], end: ["end"], value: ["value_inc_vat", "value"], pence: true },
  { id: "nordpool", attrs: ["raw_today", "raw_tomorrow"], start: ["start"], end: ["end"], value: ["value"] },
  { id: "solcast", attrs: ["detailedForecast", "detailedHourly"], start: ["period_start"], end: [], value: ["pv_estimate"], unit: "kW" },
  { id: "amber", attrs: ["forecasts"], start: ["start_time"], end: ["end_time"], value: ["per_kwh"] },
] as const;

/** Key names tried, in order, for a list nobody has a preset for. */
const START = ["start", "start_time", "period_start", "datetime", "from", "time"];
const END = ["end", "end_time", "period_end", "to", "till"];
const VALUE = ["value_inc_vat", "value", "price", "per_kwh", "pv_estimate", "total", "state"];

export interface ListOptions { attribute?: string; start_key?: string; end_key?: string; value_key?: string }

/** The list attribute an entity carries, if it is one we know or the one asked for. */
export function findList(e: HassEntity | undefined, o: ListOptions = {}): { format?: (typeof FORMATS)[number]; attrs: string[] } | undefined {
  if (!e?.attributes) return undefined;
  if (o.attribute) return Array.isArray(e.attributes[o.attribute]) ? { attrs: [o.attribute] } : undefined;
  for (const f of FORMATS) {
    const attrs = f.attrs.filter((a) => Array.isArray(e.attributes[a]));
    if (attrs.length) return { format: f, attrs };
  }
  return undefined;
}

const pick = (row: Record<string, unknown>, keys: readonly string[], own?: string) =>
  own ? row[own] : keys.map((k) => row[k]).find((v) => v !== undefined && v !== null);

/** Slots from an entity's list attribute, with the unit they are in. Rows without an end run to the next row's start. */
export function readList(e: HassEntity | undefined, o: ListOptions = {}): { slots: Slot[]; unit: string } {
  const found = findList(e, o);
  if (!found) return { slots: [], unit: "" };
  const f = found.format;
  const rows: { t0: number; t1: number; v: number }[] = [];
  for (const a of found.attrs) {
    for (const r of e!.attributes[a] as unknown[]) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const t0 = timeOf(pick(row, f?.start ?? START, o.start_key));
      const t1 = timeOf(pick(row, f?.end ?? END, o.end_key));
      const v = numOf(pick(row, f?.value ?? VALUE, o.value_key));
      if (Number.isFinite(t0) && v !== undefined) rows.push({ t0, t1, v });
    }
  }
  rows.sort((a, b) => a.t0 - b.t0);
  const step = rows.length > 1 ? rows[1].t0 - rows[0].t0 : HOUR;
  const slots = rows.map((r, i) => ({ t0: r.t0, t1: Number.isFinite(r.t1) && r.t1 > r.t0 ? r.t1 : rows[i + 1]?.t0 ?? r.t0 + step, v: r.v }));
  // Octopus reports pounds; if every rate is small, treat them as pounds and show pence (Agile never sits within a few pence of zero all day).
  if (f && "pence" in f && f.pence) {
    const pounds = slots.length > 0 && slots.every((s) => Math.abs(s.v) <= 3);
    return { slots: pounds ? slots.map((s) => ({ ...s, v: s.v * 100 })) : slots, unit: "p" };
  }
  const unit = (f && "unit" in f ? f.unit : undefined) ?? (e!.attributes.unit_of_measurement as string | undefined) ?? "";
  return { slots, unit };
}

/** Octopus rates as they were for the Agile card and the Today card: pence per kWh. */
export interface Rate { start: number; end: number; p: number }
export function parseRates(e: HassEntity | undefined): Rate[] {
  if (!e?.attributes || !Array.isArray(e.attributes.rates ?? e.attributes.all_rates)) return [];
  return readList(e).slots.map((s) => ({ start: s.t0, end: s.t1, p: s.v }));
}

/** What energy/solar_forecast returns: per config entry, Wh for each hour. */
export type RawForecast = Record<string, { wh_hours?: Record<string, number> }>;

/**
 * The Energy dashboard's solar forecast as hourly slots of average kW (Wh in an hour is the average W),
 * one entry or all of them added together. A zero slot is added either side of each run of hours so the area rises from zero.
 */
export function readForecast(raw: RawForecast | undefined, entry?: string): Slot[] {
  if (!raw) return [];
  const sum = new Map<number, number>();
  for (const [id, v] of Object.entries(raw)) {
    if (entry && id !== entry) continue;
    for (const [iso, wh] of Object.entries(v?.wh_hours ?? {})) {
      const t = Date.parse(iso);
      if (Number.isFinite(t) && typeof wh === "number" && Number.isFinite(wh)) sum.set(t, (sum.get(t) ?? 0) + wh);
    }
  }
  for (const t of [...sum.keys()]) {
    if (!sum.has(t - HOUR)) sum.set(t - HOUR, 0);
    if (!sum.has(t + HOUR)) sum.set(t + HOUR, 0);
  }
  return [...sum].sort((a, b) => a[0] - b[0]).map(([t, wh]) => ({ t0: t, t1: t + HOUR, v: wh / 1000 }));
}

/** Power to kW and energy to kWh, so a forecast and a sensor share an axis; anything else as it is. */
export function normalUnit(unit: string): { unit: string; k: number } {
  switch (unit.trim()) {
    case "W": return { unit: "kW", k: 0.001 };
    case "kW": return { unit: "kW", k: 1 };
    case "MW": return { unit: "kW", k: 1000 };
    case "Wh": return { unit: "kWh", k: 0.001 };
    case "kWh": return { unit: "kWh", k: 1 };
    case "MWh": return { unit: "kWh", k: 1000 };
    default: return { unit: unit.trim(), k: 1 };
  }
}
