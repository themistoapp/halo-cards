import type { ActionConfig, ActionSet, Gesture } from "../../shared/actions";
import { hexToHsl, hslToHex } from "../../shared/colour";
import { clock, fmtNum } from "../../shared/format";
import { isGradientName } from "../../shared/looks";
import { chartColour } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { canToggle, isAvailable, isOn, numState, unitOf } from "../../shared/util";
import { buildThermostat, fmtTemp, round05 } from "../thermostat/logic";
import { CONDITION_LABELS, iconFor, isNight, roundTemp, type IconKey } from "../weather/logic";

// Badges for the row at the top of a sections view: thermostat, gauge, weather and on/off.
// Each is Home Assistant's badge size (a 36px pill) in the Entity card's looks.

/** A colour by value. Unlike the Entity card's rules, a rule with neither bound matches anything, so it can end a list as "otherwise". */
export interface BadgeRule { above?: number; below?: number; colour: string }

export interface BadgeBase extends ActionSet {
  type: string;
  entity?: string;
  name?: string;
  /** The small name line (default on). */
  show_name?: boolean;
  /** plain (default), light (black on white), dark (white on black) or a gradient. */
  theme?: string;
  /** Soft drop shadow (default on). */
  shadow?: boolean;
}

export interface ThermostatBadgeConfig extends BadgeBase {
  /** With a climate entity: heat and cool as on the thermostat card (default), or the room temperature's band. */
  bloom_colour?: "action" | "temperature";
  colour_rules?: BadgeRule[];
  /** Dial range for a temperature sensor (a climate entity has its own). */
  min?: number;
  max?: number;
}
export interface GaugeBadgeConfig extends BadgeBase {
  attribute?: string;
  min?: number;
  max?: number;
  /** What sits in the ring: the value (default) or the icon. */
  inside?: "value" | "icon";
  icon?: string;
  /** Ring colour when no rule matches (default grey). */
  colour?: string;
  colour_rules?: BadgeRule[];
  decimals?: number;
}
export type WeatherShow = "now" | "sun" | "rain";
export interface WeatherBadgeConfig extends BadgeBase {
  /** now: temperature with the conditions as the icon; sun: the next sunrise or sunset; rain: today's chance of rain. */
  show?: WeatherShow;
}
export interface BooleanBadgeConfig extends BadgeBase {
  icon?: string;
  /** A colour or a look for each state: a palette name, a gradient name, or your own colour. */
  on_colour?: string;
  off_colour?: string;
}

export const THEMES = ["plain", "light", "dark"] as const;
export const themeOf = (t?: string) => (t && ((THEMES as readonly string[]).includes(t) || isGradientName(t)) ? t : "plain");

/** The first rule the value meets. A rule with no above or below matches anything. */
export function badgeRule(rules: BadgeRule[] | undefined, v: number): string | undefined {
  for (const r of rules ?? []) {
    if (!r?.colour) continue;
    if ((r.above === undefined || v > r.above) && (r.below === undefined || v < r.below)) return r.colour;
  }
  return undefined;
}

/** Bloom tints from one colour, as the thermostat card makes them, at about 60% of the saturation: badges are small and sit in a row. */
export function softBloom(hex: string, dark: boolean): { c0: string; c1: string } | undefined {
  const c = hexToHsl(hex);
  if (!c) return undefined;
  const s = Math.max(c.s, 0.35) * 0.6;
  return dark ? { c0: hslToHex(c.h, Math.min(s, 0.42), 0.3), c1: hslToHex(c.h, Math.min(s, 0.36), 0.17) }
    : { c0: hslToHex(c.h, Math.min(s * 1.1, 0.54), 0.6), c1: hslToHex(c.h, Math.min(s, 0.48), 0.85) };
}

/** Bloom ellipse as [width %, height %] of the badge: the compact thermostat's rest and active shapes. */
export const BADGE_BLOOM = { rest: [150, 70], active: [115, 150] } as const;

/** The thermostat card's heat and cool colours, [day, night]. */
export const HEAT = ["#e8742f", "#ff9a5c"] as const, COOL = ["#2f86cf", "#6cc3ec"] as const;

export const DEFAULT_TEMP_RULES: BadgeRule[] = [{ below: 18, colour: "blue" }, { below: 20, colour: "yellow" }, { below: 22, colour: "orange" }, { colour: "red" }];

export interface ThermostatBadge {
  name: string;
  available: boolean;
  climate: boolean;
  cur?: number;
  min: number;
  max: number;
  /** Target tick (single setpoint, on). */
  tgt?: number;
  /** Both setpoints in a heat/cool range. */
  low?: number;
  high?: number;
  /** Ticks from..to that light, and how: lit in the tone, or a band in the text colour (a range). */
  lit?: { from: number; to: number; band: boolean };
  /** Colour of lit ticks and the target tick. */
  tone?: string;
  bloom: "none" | "rest" | "active";
  bloomHex?: string;
  label: string;
}

/** The thermostat badge: the thermostat card's model for a climate entity, or a plain reading for a temperature sensor. */
export function buildThermostatBadge(hass: HomeAssistant, cfg: ThermostatBadgeConfig): ThermostatBadge {
  const id = cfg.entity ?? "", s = hass.states[id], night = hass.themes?.darkMode ? 1 : 0;
  const rules = cfg.colour_rules?.length ? cfg.colour_rules : DEFAULT_TEMP_RULES;
  const band = (v?: number) => (v === undefined ? undefined : chartColour(badgeRule(rules, v), !!night));
  if (id.startsWith("climate.")) {
    const m = buildThermostat(hass, { type: "x", entity: id, name: cfg.name });
    const on = m.available && m.mode !== "off";
    const lo = m.range ? m.low : m.cur !== undefined && m.tgt !== undefined ? Math.min(m.cur, m.tgt) : undefined;
    const hi = m.range ? m.high : m.cur !== undefined && m.tgt !== undefined ? Math.max(m.cur, m.tgt) : undefined;
    const active = on && lo !== undefined && hi !== undefined && (m.range || m.tone === "heat" || m.tone === "cool");
    const tone = m.tone === "heat" || m.glow === "heat" ? HEAT[night] : m.tone === "cool" || m.glow === "cool" ? COOL[night] : undefined;
    const bloomHex = m.bloom === "none" ? undefined : cfg.bloom_colour === "temperature" ? band(m.cur) : m.glow === "heat" ? HEAT[night] : m.glow === "cool" ? COOL[night] : undefined;
    const what = !m.available ? "unavailable" : m.mode === "off" ? "off" : m.range ? `${fmtTemp(m.low!)} to ${fmtTemp(m.high!)}°` : m.tgt !== undefined ? `target ${fmtTemp(m.tgt)}°` : m.mode;
    return {
      name: cfg.name || m.name, available: m.available, climate: true, cur: m.cur, min: m.min, max: m.max,
      tgt: on && !m.range ? m.tgt : undefined, low: on && m.range ? m.low : undefined, high: on && m.range ? m.high : undefined,
      lit: active ? { from: lo!, to: hi!, band: m.range } : undefined, tone, bloom: bloomHex ? m.bloom : "none", bloomHex,
      label: `${m.cur === undefined ? "" : `${fmtTemp(m.cur)}°, `}${what}`,
    };
  }
  const v = numState(s);
  const cur = v === undefined ? undefined : round05(v);
  const min = cfg.min ?? 10, max = cfg.max ?? 30;
  const hex = band(cur);
  return {
    name: cfg.name || (s?.attributes.friendly_name as string | undefined) || "Temperature", available: cur !== undefined, climate: false, cur,
    min, max: max > min ? max : min + 1, tone: hex, bloom: hex ? "rest" : "none", bloomHex: hex, label: cur === undefined ? "unavailable" : `${fmtTemp(cur)}°`,
  };
}

export interface GaugeBadge { name: string; available: boolean; value: string; unit: string; frac: number; colour?: string; label: string }

/** A number between min and max (0 to 100 by default), coloured by the first rule it meets. */
export function buildGaugeBadge(hass: HomeAssistant, cfg: GaugeBadgeConfig): GaugeBadge {
  const s = hass.states[cfg.entity ?? ""];
  const name = cfg.name || (s?.attributes.friendly_name as string | undefined) || cfg.entity || "Gauge";
  const raw = !isAvailable(s) ? undefined : cfg.attribute ? s.attributes[cfg.attribute] : s.state;
  const n = raw === undefined || raw === null || raw === "" ? NaN : Number(raw);
  const unit = cfg.attribute ? "" : unitOf(s);
  if (!Number.isFinite(n)) return { name, available: false, value: "–", unit, frac: 0, label: "unavailable" };
  const min = cfg.min ?? (s?.attributes.min as number | undefined) ?? 0;
  const max0 = cfg.max ?? (s?.attributes.max as number | undefined) ?? 100, max = max0 > min ? max0 : min + 1;
  const value = cfg.decimals !== undefined ? fmtNum(n, cfg.decimals) : fmtNum(n, undefined, { max: Math.abs(n) >= 100 ? 0 : 1 });
  return { name, available: true, value, unit, frac: Math.min(Math.max((n - min) / (max - min), 0), 1), colour: badgeRule(cfg.colour_rules, n) ?? cfg.colour, label: `${value}${unit ? ` ${unit}` : ""}` };
}

export interface WeatherBadge { name: string; available: boolean; value: string; icon: IconKey | "sunrise" | "sunset" | "drop"; rain?: number; label: string }

/** Today's chance of rain: today's entry in the daily forecast, else the highest of today's remaining hours. */
export function rainToday(fc: { daily?: RainFc[]; hourly?: RainFc[] }, now = new Date()): number | undefined {
  const today = (f: RainFc) => { const d = new Date(f.datetime); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); };
  const p = (f?: RainFc) => (typeof f?.precipitation_probability === "number" ? f.precipitation_probability : undefined);
  const day = p(fc.daily?.find(today));
  if (day !== undefined) return Math.round(day);
  const hours = (fc.hourly ?? []).filter((f) => today(f) && Date.parse(f.datetime) >= now.getTime() - 3600e3).map(p).filter((x): x is number => x !== undefined);
  return hours.length ? Math.round(Math.max(...hours)) : undefined;
}
export interface RainFc { datetime: string; precipitation_probability?: number }

export function buildWeatherBadge(hass: HomeAssistant, cfg: WeatherBadgeConfig, fc: { daily?: RainFc[]; hourly?: RainFc[] } = {}, now = new Date()): WeatherBadge {
  const show = cfg.show ?? "now";
  if (show === "sun") {
    const s = hass.states["sun.sun"];
    const rise = Date.parse(s?.attributes.next_rising), set = Date.parse(s?.attributes.next_setting);
    if (!Number.isFinite(rise) && !Number.isFinite(set)) return { name: cfg.name || "Sun", available: false, value: "–", icon: "sunset", label: "unavailable" };
    const setting = Number.isFinite(set) && (!Number.isFinite(rise) || set < rise);
    const t = clock(setting ? set : rise), name = cfg.name || (setting ? "Sunset" : "Sunrise");
    return { name, available: true, value: t, icon: setting ? "sunset" : "sunrise", label: `${setting ? "Sunset" : "Sunrise"} ${t}` };
  }
  const s = hass.states[cfg.entity ?? ""];
  if (show === "rain") {
    const r = rainToday(fc, now);
    return { name: cfg.name || "Rain today", available: r !== undefined, value: r === undefined ? "–" : `${r}%`, icon: "drop", rain: r, label: r === undefined ? "no forecast" : `${r}% chance of rain` };
  }
  const t = Number(s?.attributes.temperature);
  if (!isAvailable(s) || !Number.isFinite(t)) return { name: cfg.name || "Weather", available: false, value: "–", icon: "cloud", label: "unavailable" };
  const cond = s.state;
  return {
    name: cfg.name || (s.attributes.friendly_name as string | undefined) || "Weather", available: true, value: `${roundTemp(t)}°`,
    icon: iconFor(cond, isNight(hass, now)), label: `${roundTemp(t)}°, ${CONDITION_LABELS[cond] ?? cond}`,
  };
}

export { canToggle, isOn };

export interface BooleanBadge { name: string; available: boolean; on: boolean; state: string; label: string }

export function buildBooleanBadge(hass: HomeAssistant, cfg: BooleanBadgeConfig): BooleanBadge {
  const s = hass.states[cfg.entity ?? ""];
  const name = cfg.name || (s?.attributes.friendly_name as string | undefined) || cfg.entity || "Switch";
  if (!isAvailable(s)) return { name, available: false, on: false, state: "Unavailable", label: "unavailable" };
  const own = hass.formatEntityState?.(s);
  const state = own || s.state.charAt(0).toUpperCase() + s.state.slice(1).replace(/_/g, " ");
  return { name, available: true, on: isOn(s), state, label: state };
}

/** A state's colour: a gradient look, a palette colour (by its graph colours), your own colour, or nothing. */
export function stateColour(c: string | undefined): { look?: string; colour?: string } {
  const v = c?.trim();
  if (!v || v === "none") return {};
  if (isGradientName(v)) return { look: v };
  return { colour: v };
}

/** Badge actions. Tap opens more-info (on/off: toggles what can be toggled), hold opens more-info, double tap does nothing. */
export function badgeAction(cfg: ActionSet, g: Gesture, tapToggles = false): ActionConfig {
  const a = g === "tap" ? cfg.tap_action : g === "hold" ? cfg.hold_action : cfg.double_tap_action;
  if (a?.action) return a;
  return { action: g === "tap" ? (tapToggles ? "toggle" : "more-info") : g === "hold" ? "more-info" : "none" };
}

export const showName = (cfg: BadgeBase) => cfg.show_name !== false;
export { fmtTemp };
