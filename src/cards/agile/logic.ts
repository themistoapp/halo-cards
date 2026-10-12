import type { HassEntity, HomeAssistant } from "../../shared/types";
import { startOfDay } from "../solar/logic";

export type FigureId = "current" | "next" | "lowest" | "average" | "highest";
export const FIGURES: FigureId[] = ["current", "next", "lowest", "average", "highest"];
export const FIGURE_LABELS: Record<FigureId, string> = { current: "Current rate", next: "Next rate", lowest: "Lowest", average: "Average", highest: "Highest" };

export interface HaloAgileConfig {
  type: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  /** Today's rates: the Octopus Energy "current day rates" entity. */
  rates_today?: string;
  /** Tomorrow's rates: the "next day rates" entity (published from about 16:00). */
  rates_tomorrow?: string;
  /** Figures across the top, in this fixed order; as many as fit are shown. Default: all five. */
  figures?: FigureId[];
  /** Pence per kWh: at or below this a bar is green. */
  cheap_below?: number;
  /** Pence per kWh: above this a bar is red; in between, amber. */
  expensive_above?: number;
}

/** One half-hour: pence per kWh including VAT. */
export interface Rate { start: number; end: number; p: number }
export type Band = "low" | "mid" | "high";

const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Rates from an entity's `rates` attribute. The integration reports pounds per kWh; if every value is small we
 * treat them as pounds and convert to pence (Agile never sits within a few pence of zero all day).
 */
export function parseRates(e: HassEntity | undefined): Rate[] {
  if (!e || !e.attributes) return [];
  const raw = e.attributes.rates ?? e.attributes.all_rates;
  if (!Array.isArray(raw)) return [];
  const out: Rate[] = [];
  for (const r of raw) {
    const start = Date.parse(r?.start), end = Date.parse(r?.end), v = numOf(r?.value_inc_vat ?? r?.value);
    if (Number.isFinite(start) && Number.isFinite(end) && v !== undefined) out.push({ start, end, p: v });
  }
  const pounds = out.length > 0 && out.every((r) => Math.abs(r.p) <= 3);
  return out.map((r) => ({ ...r, p: pounds ? r.p * 100 : r.p })).sort((a, b) => a.start - b.start);
}

export const bandOf = (p: number, cheap: number, expensive: number): Band => (p <= cheap ? "low" : p > expensive ? "high" : "mid");

/** 24.567 -> "24.6", 105 -> "105", -1.25 -> "-1.3". */
export const fmtP = (p: number) => (Math.abs(p) >= 100 ? String(Math.round(p)) : p.toFixed(1)).replace("-0.0", "0.0");
export const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export interface Bar { x: number; w: number; p: number; band: Band; past: boolean; current: boolean }
export interface Figure { id: FigureId; label: string; value: string; note?: string; band?: Band }
export interface AgileModel {
  empty: boolean;
  bars: Bar[];
  ticks: number[];
  yMin: number;
  yMax: number;
  step: number;
  nowX?: number;
  figures: Figure[];
  hasTomorrow: boolean;
}

const STEPS = [2, 5, 10, 20, 25, 50, 100];
export function niceRange(min: number, max: number): { yMin: number; yMax: number; step: number; ticks: number[] } {
  const lo = Math.min(min, 0), hi = Math.max(max, 10);
  const step = STEPS.find((s) => (hi - lo) / s <= 4) ?? 100;
  const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(t);
  return { yMin, yMax, step, ticks };
}

export function buildAgile(opts: { hass: HomeAssistant; cfg: HaloAgileConfig; day: "today" | "tomorrow"; now: number }): AgileModel {
  const { hass, cfg, now } = opts;
  const cheap = cfg.cheap_below ?? 15, expensive = cfg.expensive_above ?? 30;
  const pool = new Map<number, Rate>();
  for (const id of [cfg.rates_today, cfg.rates_tomorrow]) if (id) for (const r of parseRates(hass.states[id])) pool.set(r.start, r);
  const all = [...pool.values()].sort((a, b) => a.start - b.start);

  const day0 = startOfDay(now, opts.day === "today" ? 0 : 1), day1 = startOfDay(now, opts.day === "today" ? 1 : 2);
  const tomorrow0 = startOfDay(now, 1), tomorrow1 = startOfDay(now, 2);
  const hasTomorrow = all.some((r) => r.start >= tomorrow0 && r.start < tomorrow1);
  const slots = all.filter((r) => r.start >= day0 && r.start < day1);

  const cur = all.find((r) => r.start <= now && now < r.end);
  const next = cur ? all.find((r) => r.start >= cur.end) : all.find((r) => r.start > now);
  const dayName = opts.day === "today" ? "today" : "tomorrow";

  const figs: Record<FigureId, Figure | undefined> = { current: undefined, next: undefined, lowest: undefined, average: undefined, highest: undefined };
  figs.current = { id: "current", label: FIGURE_LABELS.current, value: cur ? fmtP(cur.p) : "–", note: cur ? `until ${clock(cur.end)}` : undefined, band: cur ? bandOf(cur.p, cheap, expensive) : undefined };
  figs.next = { id: "next", label: FIGURE_LABELS.next, value: next ? fmtP(next.p) : "–", note: next ? `from ${clock(next.start)}` : undefined, band: next ? bandOf(next.p, cheap, expensive) : undefined };
  if (slots.length) {
    const lo = slots.reduce((a, r) => (r.p < a.p ? r : a)), hi = slots.reduce((a, r) => (r.p > a.p ? r : a));
    const avg = slots.reduce((a, r) => a + r.p, 0) / slots.length;
    figs.lowest = { id: "lowest", label: FIGURE_LABELS.lowest, value: fmtP(lo.p), note: `at ${clock(lo.start)}`, band: bandOf(lo.p, cheap, expensive) };
    figs.average = { id: "average", label: FIGURE_LABELS.average, value: fmtP(avg), note: dayName, band: bandOf(avg, cheap, expensive) };
    figs.highest = { id: "highest", label: FIGURE_LABELS.highest, value: fmtP(hi.p), note: `at ${clock(hi.start)}`, band: bandOf(hi.p, cheap, expensive) };
  } else {
    for (const id of ["lowest", "average", "highest"] as const) figs[id] = { id, label: FIGURE_LABELS[id], value: "–" };
  }
  const want = cfg.figures?.length ? cfg.figures : FIGURES;
  const figures = FIGURES.filter((f) => want.includes(f)).map((f) => figs[f]!);

  if (!slots.length) return { empty: true, bars: [], ticks: [0, 10, 20], yMin: 0, yMax: 20, step: 10, figures, hasTomorrow };
  const bars: Bar[] = slots.map((r) => ({
    x: (r.start - day0) / 3_600_000, w: (r.end - r.start) / 3_600_000, p: r.p, band: bandOf(r.p, cheap, expensive),
    past: opts.day === "today" && r.end <= now, current: r.start <= now && now < r.end,
  }));
  const range = niceRange(Math.min(...slots.map((r) => r.p)), Math.max(...slots.map((r) => r.p)));
  return { empty: false, bars, ...range, nowX: opts.day === "today" ? (now - day0) / 3_600_000 : undefined, figures, hasTomorrow };
}

export const watchedAgile = (cfg: HaloAgileConfig) => [cfg.rates_today, cfg.rates_tomorrow].filter((x): x is string => !!x);
