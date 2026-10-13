import type { HassEntity, HomeAssistant } from "../../shared/types";
import { isAvailable, numState, unitOf } from "../../shared/util";
import { parseRates, type Rate } from "../graph/sources";
import { startOfDay } from "../../shared/util";
import { clock, fmtNum, hourLabel, language } from "../../shared/format";
import { phaseOf, position } from "../media/logic";
import { levelPercent, isCharging } from "../vehicle/logic";
import { buildWeather, iconFor, isNight, type Fc, type Forecasts, type IconKey } from "../weather/logic";
import type { CustomGreeting, Fired, Tone } from "./greetings";

export type BoxId = "calendar" | "weather" | "bins" | "vehicles" | "agile" | "media";
export const BOX_IDS: BoxId[] = ["calendar", "weather", "bins", "vehicles", "agile", "media"];
export const BOX_LABELS: Record<BoxId, string> = {
  calendar: "Calendar", weather: "Weather", bins: "Bins", vehicles: "Vehicles", agile: "Cheapest Agile slots", media: "Now playing",
};

export interface CalendarRow { entity: string; name?: string; colour?: string }
export interface BinRow { name: string; entity: string; colour?: string; /** For a bin calendar: words in the event title, e.g. "recycl". Defaults to the bin's name. */ match?: string }
export interface VehicleRow {
  name?: string; kind?: "ice" | "ev"; image_preset?: "none" | "m140i" | "e-vivaro"; image?: string;
  level: string; range?: string; charging?: string; tank_size?: number;
}

export interface HaloTodayConfig {
  type: string;
  shadow?: boolean;
  /** Title: a greeting, the date as a big number, or nothing. */
  header?: "greeting" | "date" | "none";
  /** Your name in the greetings. Defaults to the first name of whoever is signed in. */
  name?: string;
  greeting?: Tone;
  /** Rude only after `watershed_from` (default 21:00); cheeky before then. */
  watershed?: boolean;
  watershed_from?: string;
  greetings?: CustomGreeting[];
  /** Which boxes, in order of preference within each tier. Default: all. */
  boxes?: BoxId[];
  calendars?: (string | CalendarRow)[];
  /** Days ahead the calendar looks for the next events. */
  calendar_days?: number;
  weather?: string;
  weather_hours?: number;
  bins?: BinRow[];
  /** Hours before a collection the bins box appears. */
  bins_within?: number;
  /** When the evening reminder starts the day before a collection. */
  bins_out_from?: string;
  vehicles?: VehicleRow[];
  /** A vehicle appears when its fuel or battery is below this (%). */
  low_below?: number;
  rates_today?: string;
  rates_tomorrow?: string;
  agile_slots?: number;
  /** Pence per kWh: at or above this counts as peak (for the greetings). */
  peak_above?: number;
  media?: string[];
}

export const DEFAULTS = { calendar_days: 7, weather_hours: 8, bins_within: 48, bins_out_from: "17:00", low_below: 30, agile_slots: 3, peak_above: 30, watershed_from: "21:00" };

/** "17:00" or "17:00:00" -> minutes after midnight. */
export function minutesOf(s: string | undefined, fallback: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(s ?? "") ?? /^(\d{1,2}):(\d{2})/.exec(fallback)!;
  return Number(m[1]) * 60 + Number(m[2]);
}

export { startOfDay };
/** Whole calendar days from today to `ms` (0 today, 1 tomorrow). */
export const dayDiff = (ms: number, now: number) => Math.round((startOfDay(ms) - startOfDay(now)) / 86_400_000);
const dayLabel = (ms: number, locale: string) => new Date(ms).toLocaleDateString(locale, { weekday: "short", day: "numeric" });
const weekday = (ms: number, locale: string) => new Date(ms).toLocaleDateString(locale, { weekday: "long" });
export function duration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const PALETTE = ["#e0568a", "#2f7bff", "#1f9d63", "#e8742f", "#8a5cf6", "#d89a1b", "#2fc4b8"];
export const calendarsOf = (cfg: HaloTodayConfig): CalendarRow[] =>
  (cfg.calendars ?? []).map((c) => (typeof c === "string" ? { entity: c } : c)).filter((c) => c?.entity);
export const colourOf = (rows: CalendarRow[], i: number) => rows[i]?.colour || PALETTE[i % PALETTE.length];

/* ===================== Calendar ===================== */

export interface CalEvent { cal: string; colour: string; calName: string; summary: string; start: number; end: number; allDay: boolean; location?: string }

/** A calendar API date: { dateTime } or { date }, or a plain string. All-day dates are local midnight. */
function when(v: unknown): { t: number; allDay: boolean } | undefined {
  const s = typeof v === "string" ? v : (v as { dateTime?: string; date?: string } | undefined)?.dateTime ?? (v as { date?: string } | undefined)?.date;
  if (!s) return undefined;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (d) return { t: new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])).getTime(), allDay: true };
  const t = Date.parse(s);
  return Number.isFinite(t) ? { t, allDay: false } : undefined;
}

export function parseEvents(raw: unknown, row: { entity: string; colour: string; name: string }): CalEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CalEvent[] = [];
  for (const e of raw) {
    const s = when(e?.start), en = when(e?.end);
    if (!s) continue;
    out.push({
      cal: row.entity, colour: row.colour, calName: row.name, summary: String(e.summary ?? e.message ?? "Event"),
      start: s.t, end: en?.t ?? s.t + (s.allDay ? 86_400_000 : 3_600_000), allDay: s.allDay, location: e.location ? String(e.location) : undefined,
    });
  }
  return out;
}

export interface CalItem { start: string; end: string; title: string; meta: string; colour: string; progress?: number }
export interface CalendarModel {
  header: string;
  pill?: { text: string; solid: boolean };
  events: CalItem[];
  more?: string;
  tier: number;
  entity: string;
  /** For the greetings. */
  now?: string;
  soon?: { title: string; mins: number };
  todayCount: number;
  birthday?: string;
}

/** "Mum's birthday", "Birthday: Mum", "Mum birthday" -> "Mum". */
export function birthdayOf(summary: string): string | undefined {
  if (!/birthday|\bbday\b/i.test(summary)) return undefined;
  const who = summary.replace(/['’]s\b/i, "").replace(/happy|birthday|\bbday\b|[:🎂🎉!-]/gi, " ").replace(/\s+/g, " ").trim();
  return who || undefined;
}

export function buildCalendar(events: CalEvent[], now: number, locale = language()): CalendarModel | undefined {
  const today0 = startOfDay(now), today1 = startOfDay(now, 1);
  const timed = events.filter((e) => !e.allDay && e.end > now).sort((a, b) => a.start - b.start || a.end - b.end);
  const allToday = events.filter((e) => e.allDay && e.start < today1 && e.end > today0);
  const todayCount = events.filter((e) => !e.allDay && e.start < today1 && e.end > today0).length;
  const birthday = allToday.map((e) => birthdayOf(e.summary)).find(Boolean);
  const shown = timed.slice(0, 2);
  if (!shown.length && !allToday.length) return undefined;
  const first = shown[0];
  const fmt = (ms: number) => clock(ms);
  let header = "Today", pill: CalendarModel["pill"], tier = 3, nowTitle: string | undefined, soon: CalendarModel["soon"];
  if (first) {
    const d = dayDiff(first.start, now);
    if (first.start <= now) {
      header = "Now"; tier = 0; nowTitle = first.summary;
      pill = { text: `${duration(Math.max(1, Math.round((first.end - now) / 60_000)))} left`, solid: true };
    } else if (d <= 0) {
      const mins = Math.round((first.start - now) / 60_000);
      header = "Next up"; pill = { text: `in ${duration(Math.max(1, mins))}`, solid: false };
      if (mins <= 60) { tier = 2; soon = { title: first.summary, mins }; }
    } else {
      header = d === 1 ? `Tomorrow · ${dayLabel(first.start, locale)}` : `${todayCount ? "Next up" : "Nothing today · next up"} · ${dayLabel(first.start, locale)}`;
      pill = { text: `from ${fmt(first.start)}`, solid: false };
    }
  }
  const headDay = first ? startOfDay(Math.max(first.start, now)) : today0;
  const items: CalItem[] = shown.map((e) => {
    const otherDay = startOfDay(Math.max(e.start, now)) !== headDay;
    const meta = [otherDay ? weekday(e.start, locale) : undefined, e.location || e.calName].filter(Boolean).join(" · ");
    const live = e.start <= now && e.end > now;
    return { start: fmt(e.start), end: fmt(e.end), title: e.summary, meta, colour: e.colour, progress: live ? Math.round(((now - e.start) / (e.end - e.start)) * 100) : undefined };
  });
  // Other events on the same day as the first, then today's all-day events.
  const sameDay = timed.slice(2).filter((e) => startOfDay(Math.max(e.start, now)) === headDay).length;
  const dayWord = headDay === today0 ? "today" : headDay === today1 ? "tomorrow" : "that day";
  const more = [sameDay ? `+${sameDay} more ${dayWord}` : undefined, ...allToday.slice(0, 2).map((e) => e.summary)].filter(Boolean).join(" · ") || undefined;
  if (!first) header = "Today";
  return { header, pill, events: items, more, tier, entity: (first ?? allToday[0]).cal, now: nowTitle, soon, todayCount, birthday };
}

/* ===================== Bins ===================== */

export const BIN_COLOURS: Record<string, [day: string, night: string]> = {
  black: ["#3a3d44", "#7d828e"], grey: ["#7a7f8a", "#9aa0ac"], blue: ["#2f6fd6", "#4f8df0"], green: ["#3f9a4f", "#5cc06d"],
  brown: ["#8a5a32", "#b07a4c"], purple: ["#7a4fc8", "#a07ef0"], red: ["#c2362b", "#ff7b72"], yellow: ["#d8a31b", "#f2c14e"], orange: ["#e0742f", "#ff9a5c"],
};
export function binColour(c: string | undefined, dark: boolean): string {
  const k = (c ?? "grey").toLowerCase().trim();
  return BIN_COLOURS[k]?.[dark ? 1 : 0] ?? (/^#[0-9a-f]{3,8}$/i.test(k) ? k : BIN_COLOURS.grey[dark ? 1 : 0]);
}

/** Local midnight of a date written as ISO, dd/mm/yyyy, or "today" / "tomorrow" / "in 3 days". */
export function parseBinDate(v: unknown, now: number): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 400) return startOfDay(now, Math.round(v));
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s === "today") return startOfDay(now);
  if (s === "tomorrow") return startOfDay(now, 1);
  const inDays = /^in (\d+) days?$/.exec(s);
  if (inDays) return startOfDay(now, Number(inDays[1]));
  if (/^\d{1,3}$/.test(s)) return startOfDay(now, Number(s));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (uk) return new Date(Number(uk[3]), Number(uk[2]) - 1, Number(uk[1])).getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? startOfDay(t) : undefined;
}

/**
 * When a bin is next collected, from whatever the integration gives: a date or a number of days in the state, or in an
 * attribute (UK Bin Collection Data: next_collection, days; Waste Collection Schedule: daysTo). For a calendar, the first
 * event whose title matches.
 */
export function binDate(hass: HomeAssistant, row: BinRow, now: number, calEvents: CalEvent[] = []): number | undefined {
  const s = hass.states[row.entity];
  if (row.entity.startsWith("calendar.")) {
    const re = matcher(row.match || row.name);
    const ev = calEvents.filter((e) => e.cal === row.entity && re.test(e.summary) && e.end > startOfDay(now)).sort((a, b) => a.start - b.start)[0];
    if (ev) return startOfDay(ev.start);
    if (s && isAvailable(s) && re.test(String(s.attributes.message ?? ""))) return parseBinDate(s.attributes.start_time, now);
    return undefined;
  }
  if (!s || !isAvailable(s)) return undefined;
  const a = s.attributes;
  for (const v of [a.next_collection, a.next_date, a.collection_date, a.date, a.next_collection_date]) {
    const d = parseBinDate(v, now); if (d !== undefined) return d;
  }
  for (const v of [a.days, a.daysTo, a.days_until, a.days_to_collection]) {
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;
    if (n !== undefined) return startOfDay(now, n);
  }
  return parseBinDate(s.state, now);
}

function matcher(text: string): RegExp {
  try { return new RegExp(text, "i"); } catch { return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
}

export interface BinItem { name: string; colour: string; count: string; unit: string; line: string; out: boolean; later: boolean; entity: string }
export interface BinsModel { bins: BinItem[]; pill?: string; tier: number; tint: string; entity: string; first?: { name: string; days: number; out: boolean } }

export function buildBins(rows: BinRow[], dates: (number | undefined)[], now: number, opts: { within: number; outFrom: number; dark: boolean; locale?: string }): BinsModel | undefined {
  const mins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const window = Math.max(1, Math.ceil(opts.within / 24));
  // A collection today counts until midday; after that it's done.
  const list = rows.map((r, i) => {
    const d = dates[i];
    let days = d === undefined ? undefined : dayDiff(d, now);
    if (days !== undefined && (days < 0 || (days === 0 && mins >= 720))) days = undefined;
    return { r, d, days };
  });
  const due = list.filter((x) => x.days !== undefined && x.days <= window);
  if (!due.length) return undefined;
  due.sort((a, b) => a.days! - b.days!);
  const soonest = due[0].days!;
  const outTonight = soonest === 1 && mins >= opts.outFrom;
  const ordered = [...list].sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  const bins: BinItem[] = ordered.map(({ r, d, days }) => {
    const first = days === soonest;
    const out = first && (outTonight || days === 0);
    const line = days === 0 && first ? "Collected today" : outTonight && first ? "Out tonight" : d !== undefined ? dayLabel(d, opts.locale ?? language()) : "No date";
    return {
      name: r.name, colour: binColour(r.colour, opts.dark), entity: r.entity, out, later: !first,
      count: days === undefined ? "–" : days === 0 ? "Today" : String(days), unit: days === undefined || days === 0 ? "" : days === 1 ? "day" : "days", line,
    };
  });
  const names = due.filter((x) => x.days === soonest).map((x) => x.r.name);
  return {
    bins, pill: soonest === 0 ? "Today" : outTonight ? "Out tonight" : undefined, tier: soonest === 0 || outTonight ? 1 : 2,
    tint: binColour(due[0].r.colour, opts.dark), entity: due[0].r.entity,
    first: { name: names.join(" and "), days: soonest, out: outTonight },
  };
}

/* ===================== Vehicles ===================== */

export interface VehicleModel { name: string; kind: "ice" | "ev"; pct: number; range?: string; image?: string; preset?: string; entity: string }

/** A vehicle shows only when it's below the low level and not charging. */
export function buildVehicleBox(hass: HomeAssistant, row: VehicleRow, low: number): VehicleModel | undefined {
  const le = hass.states[row.level];
  const raw = numState(le);
  if (raw === undefined) return undefined;
  const pct = levelPercent(raw, unitOf(le), row.tank_size);
  if (pct === undefined || pct >= low) return undefined;
  const kind = row.kind ?? (row.charging ? "ev" : "ice");
  if (row.charging && isCharging(hass.states[row.charging])) return undefined;
  const r = numState(hass.states[row.range ?? ""]);
  const name = row.name || String(le?.attributes.friendly_name ?? "Vehicle");
  return { name, kind, pct: Math.round(pct), range: r === undefined ? undefined : `${Math.round(r)} ${unitOf(hass.states[row.range!]) || "mi"}`, image: row.image, preset: row.image_preset, entity: row.level };
}

/* ===================== Agile ===================== */

export interface SlotItem { start: string; end: string; price: string; pill?: string; negative: boolean }
export interface AgileModel {
  title: string;
  slots: SlotItem[];
  /** Upcoming half-hours for the little chart: height 0..1, and whether it's one of the picks. */
  bars: { h: number; pick: boolean; neg: boolean }[];
  tier: number;
  entity: string;
  /** For the greetings. */
  cheapSoon?: string;
  plunge?: string;
  peak: boolean;
}

const pence = (p: number) => `${fmtNum(Math.abs(p) >= 100 ? Math.round(p) : p, Math.abs(p) >= 100 ? 0 : 1).replace("-", "−")}p`;

export function buildAgile(hass: HomeAssistant, cfg: HaloTodayConfig, now: number): AgileModel | undefined {
  if (!cfg.rates_today) return undefined;
  const pool = new Map<number, Rate>();
  for (const id of [cfg.rates_today, cfg.rates_tomorrow]) if (id) for (const r of parseRates(hass.states[id])) pool.set(r.start, r);
  const future = [...pool.values()].filter((r) => r.end > now).sort((a, b) => a.start - b.start).slice(0, 48);
  if (!future.length) return undefined;
  const n = Math.min(Math.max(cfg.agile_slots ?? DEFAULTS.agile_slots, 1), 6);
  const picks = [...future].sort((a, b) => a.p - b.p || a.start - b.start).slice(0, n).sort((a, b) => a.start - b.start);
  const ids = new Set(picks.map((p) => p.start));
  const tomorrow0 = startOfDay(now, 1);
  const hour = new Date(now).getHours();
  const title = picks.every((p) => p.start < tomorrow0) ? "Cheapest today"
    : hour >= 16 && picks.every((p) => p.start < tomorrow0 + 9 * 3_600_000) ? "Cheapest tonight" : "Cheapest coming up";
  const cur = future.find((r) => r.start <= now && now < r.end);
  let marked = false;
  const slots: SlotItem[] = picks.map((r) => {
    let pill: string | undefined;
    if (r.start <= now && now < r.end) pill = "Now";
    else if (r.p < 0) pill = "Plunge";
    else if (!marked && r.start - now <= 3_600_000) pill = "Next";
    if (pill === "Now" || pill === "Next") marked = true;
    return { start: clock(r.start), end: clock(r.end), price: pence(r.p), pill, negative: r.p < 0 };
  });
  const lo = Math.min(0, ...future.map((r) => r.p)), hi = Math.max(...future.map((r) => r.p), lo + 1);
  const bars = future.map((r) => ({ h: Math.max(ids.has(r.start) ? 0.2 : 0.06, (r.p - lo) / (hi - lo)), pick: ids.has(r.start), neg: r.p < 0 }));
  const firstPick = picks[0];
  const inNow = !!cur && ids.has(cur.start);
  const tier = inNow ? 0 : firstPick.start - now <= 2 * 3_600_000 ? 2 : 3;
  const neg = picks.find((p) => p.p < 0 && p.start < tomorrow0);
  return {
    title, slots, bars, tier, entity: cfg.rates_today,
    cheapSoon: !inNow && firstPick.p >= 0 && firstPick.start - now <= 2 * 3_600_000 ? clock(firstPick.start) : undefined,
    plunge: neg ? clock(neg.start) : undefined,
    peak: !!cur && cur.p >= (cfg.peak_above ?? DEFAULTS.peak_above),
  };
}

/* ===================== Weather ===================== */

export interface HourItem { label: string; icon: IconKey; temp?: number; /** Bar height 0..1 */ rain: number; note?: string }
export interface WeatherModel {
  icon: IconKey; temp?: number; cond: string; hilo?: string; pill: string; hours: HourItem[]; tier: number; entity: string;
  rainNow: boolean; rainAt?: string; dryAt?: string; sunny: boolean; windKmh?: number; available: boolean;
}

const WET = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"]);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
/** Wet if the chance is 50% or more, or (with no chance given) a rainy condition or at least 0.2 mm. */
export function isWet(f: Fc & { precipitation_probability?: number; precipitation?: number }): boolean {
  const p = num(f.precipitation_probability);
  if (p !== undefined) return p >= 50;
  return WET.has(f.condition ?? "") || (num(f.precipitation) ?? 0) >= 0.2;
}
function kmh(v: number | undefined, unit: unknown): number | undefined {
  if (v === undefined) return undefined;
  const u = String(unit ?? "km/h").toLowerCase();
  return u.includes("mph") ? v * 1.609 : u.includes("m/s") ? v * 3.6 : u.includes("kn") ? v * 1.852 : v;
}

export function buildTodayWeather(hass: HomeAssistant, entity: string, fc: Forecasts, now: Date, hoursN = 8): WeatherModel | undefined {
  const s = hass.states[entity];
  if (!s) return undefined;
  const m = buildWeather(hass, { type: "x", entity }, fc, { now, hours: 1 });
  const hourly = (fc.hourly ?? []).filter((h) => Date.parse(h.datetime) > now.getTime() - 3_600_000).slice(0, Math.max(hoursN, 4)) as (Fc & { precipitation_probability?: number; precipitation?: number })[];
  const rainNow = WET.has(s.state);
  const start = hourly[0] && Date.parse(hourly[0].datetime) <= now.getTime() ? 1 : 0;
  const ahead = hourly.slice(start);
  const firstWet = ahead.find(isWet), firstDry = ahead.find((h) => !isWet(h));
  const hh = (f?: Fc) => (f ? clock(Date.parse(f.datetime)) : undefined);
  const rainAt = !rainNow ? hh(firstWet) : undefined, dryAt = rainNow ? hh(firstDry) : undefined;
  const pill = rainNow ? (dryAt ? `Dry from ${dryAt}` : "Rain all day") : rainAt ? `Rain from ${rainAt}` : "Dry";
  const hours: HourItem[] = [];
  if (m.available) {
    const p0 = num((hourly[0] as { precipitation_probability?: number } | undefined)?.precipitation_probability);
    hours.push({ label: "Now", icon: m.icon, temp: m.temp, rain: p0 !== undefined ? p0 / 100 : rainNow ? 0.6 : 0, note: p0 !== undefined && p0 >= 30 ? `${Math.round(p0)}%` : undefined });
    for (const h of ahead.slice(0, hoursN - 1)) {
      const d = new Date(h.datetime), p = num(h.precipitation_probability), mm = num(h.precipitation);
      hours.push({
        label: hourLabel(d.getHours()), icon: iconFor(h.condition, isNight(hass, d, h)), temp: num(h.temperature) === undefined ? undefined : Math.round(num(h.temperature)!),
        rain: p !== undefined ? p / 100 : mm !== undefined ? Math.min(mm / 2, 1) : isWet(h) ? 0.6 : 0,
        note: p !== undefined ? (p >= 30 ? `${Math.round(p)}%` : undefined) : mm !== undefined && mm >= 0.1 ? fmtNum(mm, 1) : undefined,
      });
    }
  }
  const soonMs = firstWet && !rainNow ? Date.parse(firstWet.datetime) - now.getTime() : Infinity;
  return {
    icon: m.icon, temp: m.temp, cond: m.conditionLabel, hilo: m.hi !== undefined && m.lo !== undefined ? `H ${m.hi}° · L ${m.lo}°` : undefined,
    pill, hours, tier: soonMs <= 2 * 3_600_000 ? 2 : 3, entity, rainNow, rainAt, dryAt, available: m.available,
    sunny: m.available && (s.state === "sunny" || s.state === "partlycloudy") && !firstWet && !m.night,
    windKmh: kmh(num(s.attributes.wind_speed), s.attributes.wind_speed_unit),
  };
}

/* ===================== Now playing ===================== */

export interface MediaModel { entity: string; title: string; artist: string; room: string; art?: string; progress?: number }

/** The player that's playing; if several, the one that started last. */
export function buildMediaBox(hass: HomeAssistant, players: string[] = [], now = Date.now()): MediaModel | undefined {
  const playing = players.map((id) => hass.states[id]).filter((s): s is HassEntity => !!s && phaseOf(s) === "playing" && !!(s.attributes.media_title || s.attributes.media_content_id))
    .sort((a, b) => Date.parse(b.last_changed) - Date.parse(a.last_changed));
  const s = playing[0];
  if (!s) return undefined;
  const a = s.attributes, dur = Number(a.media_duration) || 0;
  return {
    entity: s.entity_id, title: String(a.media_title ?? a.media_content_id), artist: String(a.media_artist ?? a.media_album_name ?? a.app_name ?? ""),
    room: String(a.friendly_name ?? s.entity_id.split(".")[1]), art: (a.entity_picture_local ?? a.entity_picture) as string | undefined,
    progress: dur ? Math.min(100, Math.round((position(s, now) / dur) * 100)) : undefined,
  };
}

/* ===================== Ranking ===================== */

export const TIERS = ["Now", "Needs doing", "Soon", "Later"] as const;
export interface Ranked<T> { key: string; box: BoxId; half: boolean; tier: number; order: number; data: T; solo?: boolean }

/**
 * Happening now first, then anything to do, then soon, then the rest; within a tier, in the order chosen in the editor.
 * Half-width boxes pair up: the next half box is pulled up beside one, and a half box left alone goes full width.
 */
export function rank<T>(items: Ranked<T>[]): Ranked<T>[] {
  const rest = [...items].sort((a, b) => a.tier - b.tier || a.order - b.order);
  const out: Ranked<T>[] = [];
  while (rest.length) {
    const x = { ...rest.shift()! };
    if (x.half) {
      const j = rest.findIndex((y) => y.half);
      if (j >= 0) { out.push(x, { ...rest.splice(j, 1)[0] }); continue; }
      x.solo = true;
    }
    out.push(x);
  }
  return out;
}

/* ===================== Greeting triggers ===================== */

export interface Facts {
  now: Date;
  calendar?: CalendarModel;
  weather?: WeatherModel;
  bins?: BinsModel;
  agile?: AgileModel;
  vehicles: VehicleModel[];
  media?: MediaModel;
  repeat?: string;
  /** Calendars are set up, so "nothing booked" means something. */
  hasCalendars: boolean;
}

/** Everything that's true right now, most pressing first. The time of day is always last. */
export function triggersOf(f: Facts): Fired[] {
  const out: Fired[] = [];
  const h = f.now.getHours(), m = h * 60 + f.now.getMinutes(), dow = f.now.getDay();
  const b = f.bins?.first;
  if (b?.days === 0 && h < 12) out.push({ id: "binsToday", vars: { bin: b.name } });
  if (b?.out) out.push({ id: "binsTonight", vars: { bin: b.name } });
  else if (b?.days === 1) out.push({ id: "binsTomorrow", vars: { bin: b.name } });
  if (f.calendar?.now) out.push({ id: "eventNow", vars: { event: f.calendar.now } });
  if (f.calendar?.soon) out.push({ id: "eventSoon", vars: { event: f.calendar.soon.title, mins: f.calendar.soon.mins } });
  for (const v of f.vehicles) out.push({ id: v.kind === "ev" ? "evLow" : "fuelLow", vars: { car: v.name, pct: v.pct } });
  if (f.calendar?.birthday) out.push({ id: "birthday", vars: { who: f.calendar.birthday } });
  const w = f.weather;
  if (w?.rainNow) { out.push({ id: "rainNow" }); if (w.dryAt) out.push({ id: "dryLater", vars: { time: w.dryAt } }); }
  else if (w?.rainAt) out.push({ id: "rainSoon", vars: { time: w.rainAt } });
  if (f.agile?.plunge) out.push({ id: "plunge", vars: { cheap: f.agile.plunge } });
  else if (f.agile?.cheapSoon) out.push({ id: "cheapSoon", vars: { cheap: f.agile.cheapSoon } });
  if (f.agile?.peak) out.push({ id: "peak" });
  if (f.hasCalendars && f.calendar && f.calendar.todayCount >= 5) out.push({ id: "busy", vars: { n: f.calendar.todayCount } });
  if (f.hasCalendars && (!f.calendar || f.calendar.todayCount === 0) && h < 18) out.push({ id: "nothing" });
  if (w?.temp !== undefined && w.temp < 3) out.push({ id: "cold", vars: { temp: w.temp } });
  if (w?.temp !== undefined && w.temp > 25) out.push({ id: "hot", vars: { temp: w.temp } });
  if (w?.windKmh !== undefined && w.windKmh >= 40) out.push({ id: "windy" });
  if (w?.sunny) out.push({ id: "sunny" });
  if (f.repeat) out.push({ id: "repeat", vars: { track: f.repeat } });
  if (f.media) out.push({ id: "music", vars: { artist: f.media.artist || f.media.title, track: f.media.title } });
  if (m >= 23 * 60 + 30 || h < 4) out.push({ id: "late" });
  else if (h < 6) out.push({ id: "early" });
  if (dow === 1 && h >= 6 && h < 12) out.push({ id: "monday" });
  if (dow === 5 && h >= 16) out.push({ id: "friday" });
  if ((dow === 0 || dow === 6) && h >= 6 && h < 12) out.push({ id: "weekend" });
  out.push({ id: h < 12 && h >= 4 ? "morning" : h < 18 && h >= 4 ? "afternoon" : "evening" });
  return out;
}

/** Part of the day, for the header's glow. */
export function partOfDay(now: Date): "morning" | "midday" | "evening" | "night" {
  const h = now.getHours();
  return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "midday" : h >= 17 && h < 21 ? "evening" : "night";
}

export function watchedToday(cfg: HaloTodayConfig): string[] {
  return [
    ...calendarsOf(cfg).map((c) => c.entity), cfg.weather, ...(cfg.bins ?? []).map((b) => b.entity),
    ...(cfg.vehicles ?? []).flatMap((v) => [v.level, v.range, v.charging]), cfg.rates_today, cfg.rates_tomorrow, ...(cfg.media ?? []), "sun.sun",
  ].filter((x): x is string => !!x);
}

/** Boxes in the chosen order. No list means all of them; an empty list means none. */
export const boxesOf = (cfg: HaloTodayConfig): BoxId[] => (Array.isArray(cfg.boxes) ? cfg.boxes.filter((b) => BOX_IDS.includes(b)) : BOX_IDS);
