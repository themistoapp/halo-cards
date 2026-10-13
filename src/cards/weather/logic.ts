import type { HassEntity, HomeAssistant } from "../../shared/types";
import { isAvailable } from "../../shared/util";
import { clock, language } from "../../shared/format";

export type Section = "current" | "hourly" | "weekly";
export const SECTIONS: Section[] = ["current", "hourly", "weekly"];
export const SECTION_LABELS: Record<Section, string> = { current: "Current", hourly: "Hourly forecast", weekly: "Weekly forecast" };
export const DEFAULT_SECTIONS: Section[] = ["current", "hourly"];
export const DETAIL_IDS = ["humidity", "wind", "pressure", "cloud", "dew_point", "visibility"] as const;
export type DetailId = (typeof DETAIL_IDS)[number];
export const DETAIL_LABELS: Record<DetailId, string> = { humidity: "Humidity", wind: "Wind", pressure: "Pressure", cloud: "Cloud", dew_point: "Dew point", visibility: "Visibility" };
export const DEFAULT_DETAILS: DetailId[] = ["humidity", "wind", "pressure"];

export interface HaloWeatherConfig {
  type: string;
  entity: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  /** Which parts to show: any of current, hourly, weekly. Default: current and hourly. More parts make a taller card. */
  sections?: Section[];
  /** Old setting: "week" meant current + weekly. Ignored when `sections` is set. */
  layout?: "today" | "week";
  /** Details under the current conditions (up to four). Default: humidity, wind, pressure. */
  details?: DetailId[];
}

/** One entry of a forecast, as Home Assistant sends it. */
export interface Fc {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  is_daytime?: boolean;
}
export interface Forecasts { hourly?: Fc[]; daily?: Fc[] }

export type IconKey = "sun" | "moon" | "pc" | "pcn" | "cloud" | "rain" | "pour" | "snow" | "bolt" | "fog" | "wind";

/** Home Assistant weather condition -> icon. */
export function iconFor(condition: string | undefined, night = false): IconKey {
  switch (condition) {
    case "sunny": return night ? "moon" : "sun";
    case "clear-night": return "moon";
    case "partlycloudy": return night ? "pcn" : "pc";
    case "cloudy": return "cloud";
    case "rainy": return "rain";
    case "pouring": case "hail": return "pour";
    case "snowy": case "snowy-rainy": return "snow";
    case "lightning": case "lightning-rainy": return "bolt";
    case "fog": return "fog";
    case "windy": case "windy-variant": return "wind";
    default: return "cloud";
  }
}

export const CONDITION_LABELS: Record<string, string> = {
  sunny: "Sunny", "clear-night": "Clear", partlycloudy: "Partly cloudy", cloudy: "Cloudy", rainy: "Rain", pouring: "Heavy rain", snowy: "Snow", "snowy-rainy": "Sleet",
  lightning: "Thunder", "lightning-rainy": "Thunderstorm", fog: "Fog", hail: "Hail", windy: "Windy", "windy-variant": "Windy", exceptional: "Exceptional",
};

/** Colour the background glows in, per icon. */
export const GLOW: Record<IconKey, string | undefined> = {
  sun: "#f0b24a", pc: "#f0b24a", moon: "#6b78e0", pcn: "#6b78e0", cloud: undefined, fog: undefined, wind: undefined,
  rain: "#2f86cf", pour: "#2f86cf", bolt: "#2f86cf", snow: "#7fb4d8",
};
const GLOW_K: Record<IconKey, number> = { sun: 1, pc: 0.75, moon: 1, pcn: 0.8, cloud: 1, fog: 1, wind: 1, rain: 1, pour: 1, bolt: 1, snow: 1 };

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Whole degrees, never "-0". */
export const roundTemp = (v: number) => { const r = Math.round(v); return r === 0 ? 0 : r; };

const numAttr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Night-time at `at`: the sun entity if there is one, otherwise a fixed 20:00 to 06:00. */
export function isNight(hass: HomeAssistant, at: Date, forecast?: Fc): boolean {
  if (forecast?.is_daytime !== undefined) return !forecast.is_daytime;
  if (forecast === undefined) {
    const sun = hass.states["sun.sun"];
    if (sun && isAvailable(sun)) return sun.state === "below_horizon";
  }
  const h = at.getHours();
  return h < 6 || h >= 20;
}

export interface Slot { label: string; icon: IconKey; temp?: number }
export interface Day { label: string; icon: IconKey; lo?: number; hi?: number; today: boolean }
export interface Detail { id: DetailId; label: string; value: string; unit?: string }

export interface WeatherModel {
  name: string;
  available: boolean;
  condition?: string;
  conditionLabel: string;
  icon: IconKey;
  night: boolean;
  temp?: number;
  feels?: number;
  hi?: number;
  lo?: number;
  details: Detail[];
  hours: Slot[];
  days: Day[];
  /** Range the day bars are drawn on. */
  scale: [number, number];
  glow?: string;
  k: number;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const watchedWeather = (cfg: HaloWeatherConfig) => [cfg.entity, "sun.sun"];

/** Entities report units as attributes; show them as sent. */
function detailsOf(a: HassEntity["attributes"], ids: DetailId[]): Detail[] {
  const out: Detail[] = [];
  for (const id of ids) {
    let d: Detail | undefined;
    if (id === "humidity") { const v = numAttr(a.humidity); if (v !== undefined) d = { id, label: DETAIL_LABELS[id], value: `${Math.round(v)}%` }; }
    else if (id === "wind") {
      const v = numAttr(a.wind_speed);
      if (v !== undefined) { const b = numAttr(a.wind_bearing); d = { id, label: DETAIL_LABELS[id], value: `${Math.round(v)}`, unit: [a.wind_speed_unit, b === undefined ? undefined : compass(b)].filter(Boolean).join(" ") }; }
    } else if (id === "pressure") { const v = numAttr(a.pressure); if (v !== undefined) d = { id, label: DETAIL_LABELS[id], value: `${Math.round(v)}`, unit: a.pressure_unit }; }
    else if (id === "cloud") { const v = numAttr(a.cloud_coverage); if (v !== undefined) d = { id, label: DETAIL_LABELS[id], value: `${Math.round(v)}%` }; }
    else if (id === "dew_point") { const v = numAttr(a.dew_point); if (v !== undefined) d = { id, label: DETAIL_LABELS[id], value: `${roundTemp(v)}°` }; }
    else if (id === "visibility") { const v = numAttr(a.visibility); if (v !== undefined) d = { id, label: DETAIL_LABELS[id], value: `${Math.round(v)}`, unit: a.visibility_unit }; }
    if (d) out.push(d);
  }
  return out;
}

export function buildWeather(hass: HomeAssistant, cfg: HaloWeatherConfig, fc: Forecasts = {}, opts: { hours?: number; days?: number; now?: Date; locale?: string } = {}): WeatherModel {
  const now = opts.now ?? new Date(), locale = opts.locale ?? language();
  const ent = hass.states[cfg.entity];
  const name = cfg.name ?? ent?.attributes?.friendly_name ?? "Weather";
  const available = isAvailable(ent);
  const a = available ? ent.attributes : {};
  const condition = available ? ent.state : undefined;
  const night = isNight(hass, now);
  const icon = iconFor(condition, night);
  const temp = numAttr(a.temperature);
  const feels = numAttr(a.apparent_temperature);

  // Today's high and low: the daily forecast if it has today, otherwise the hours left.
  const today = fc.daily?.find((d) => sameDay(new Date(d.datetime), now));
  let hi = numAttr(today?.temperature), lo = numAttr(today?.templow);
  if ((hi === undefined || lo === undefined) && fc.hourly?.length) {
    const ts = fc.hourly.filter((h) => sameDay(new Date(h.datetime), now)).map((h) => numAttr(h.temperature)).filter((t): t is number => t !== undefined);
    if (temp !== undefined) ts.push(temp);
    if (ts.length) { hi ??= Math.max(...ts); lo ??= Math.min(...ts); }
  }

  // Hours: "Now" from the entity, then the following hours from the hourly forecast.
  const hours: Slot[] = [];
  if (available) {
    hours.push({ label: "Now", icon, temp: temp === undefined ? undefined : roundTemp(temp) });
    const next = (fc.hourly ?? []).filter((h) => new Date(h.datetime).getTime() > now.getTime());
    for (const h of next.slice(0, Math.max((opts.hours ?? 6) - 1, 0))) {
      const d = new Date(h.datetime), t = numAttr(h.temperature);
      hours.push({ label: clock(d.getTime()), icon: iconFor(h.condition, isNight(hass, d, h)), temp: t === undefined ? undefined : roundTemp(t) });
    }
  }

  const rows = (fc.daily ?? []).filter((d) => new Date(d.datetime).getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  const days: Day[] = rows.slice(0, opts.days ?? 7).map((d) => {
    const dt = new Date(d.datetime), t = numAttr(d.temperature), l = numAttr(d.templow);
    const isToday = sameDay(dt, now);
    return { label: isToday ? "Today" : dt.toLocaleDateString(locale, { weekday: "short" }), icon: iconFor(d.condition), hi: t === undefined ? undefined : roundTemp(t), lo: l === undefined ? undefined : roundTemp(l), today: isToday };
  });
  const all = days.flatMap((d) => [d.lo, d.hi]).filter((v): v is number => v !== undefined);
  if (temp !== undefined && days.some((d) => d.today)) all.push(roundTemp(temp));
  const scale: [number, number] = all.length ? [Math.min(...all), Math.max(...all) === Math.min(...all) ? Math.min(...all) + 1 : Math.max(...all)] : [0, 1];

  return {
    name, available, condition, conditionLabel: available ? CONDITION_LABELS[condition!] ?? condition!.replace(/[-_]/g, " ") : "Unavailable", icon, night,
    temp: temp === undefined ? undefined : roundTemp(temp), feels: feels === undefined ? undefined : roundTemp(feels),
    hi: hi === undefined ? undefined : roundTemp(hi), lo: lo === undefined ? undefined : roundTemp(lo),
    details: available ? detailsOf(a, (cfg.details?.length ? cfg.details : DEFAULT_DETAILS).slice(0, 4)) : [],
    hours, days, scale, glow: GLOW[icon], k: GLOW_K[icon],
  };
}

/** Which forecast types an entity can provide (supported_features bits 1 = daily, 2 = hourly). */
export function forecastTypes(e?: HassEntity): ("daily" | "hourly")[] {
  const f = e?.attributes?.supported_features;
  if (typeof f !== "number") return ["hourly", "daily"];
  return [...(f & 2 ? ["hourly" as const] : []), ...(f & 1 ? ["daily" as const] : [])];
}

/** The parts to show, always in the order current, hourly, weekly. */
export function sectionsOf(cfg: HaloWeatherConfig): Section[] {
  const want = cfg.sections?.length ? cfg.sections : cfg.layout === "week" ? (["current", "weekly"] as Section[]) : DEFAULT_SECTIONS;
  return SECTIONS.filter((x) => want.includes(x));
}

/** Pixel heights used to size the card: padding, header, then each part with a 14px gap above it. */
export const WX = { pad: 32, head: 28, gap: 14, hero: 118, heroTight: 106, details: 56, hours: 78, dayRow: 40, dayBox: 4, days: 7 } as const;

/** Height the chosen parts need, with a full week and without trimming. */
export function neededHeight(sections: Section[], hasDetails = true, days: number = WX.days): number {
  const parts: number[] = [];
  if (sections.includes("current")) { parts.push(WX.hero); if (hasDetails) parts.push(WX.details); }
  if (sections.includes("hourly")) parts.push(WX.hours);
  if (sections.includes("weekly")) parts.push(WX.dayBox + WX.dayRow * days);
  return WX.pad + WX.head + parts.reduce((a, v) => a + v + WX.gap, 0);
}

/** Grid rows (64px each with its gap) the card needs. */
export const rowsFor = (px: number) => Math.max(Math.ceil((px + 8) / 64), 2);

/** How many day rows fit in the height left after the other parts (at least 2, at most `days`). */
export function weeklyRows(height: number, sections: Section[], hasDetails: boolean, tight: boolean, days: number = WX.days): number {
  const parts: number[] = [];
  if (sections.includes("current")) { parts.push(tight ? WX.heroTight : WX.hero); if (hasDetails) parts.push(WX.details); }
  if (sections.includes("hourly")) parts.push(WX.hours);
  const used = WX.pad + WX.head + parts.reduce((a, v) => a + v + WX.gap, 0) + WX.gap + WX.dayBox;
  return Math.min(Math.max(Math.floor((height - used) / WX.dayRow), 2), days);
}
