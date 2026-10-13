import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable } from "../../shared/util";
import { fmtNum } from "../../shared/format";

export type Tone = "heat" | "cool" | "idle" | "off";
export interface HaloThermostatConfig {
  type: string;
  entity: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  /** Modes to offer. Empty or missing = every mode the thermostat supports. */
  hvac_modes?: string[];
  /** Humidity sensor, if the thermostat does not report its own. */
  humidity?: string;
}

export const MODE_LABELS: Record<string, string> = { heat: "Heat", cool: "Cool", heat_cool: "Heat/Cool", auto: "Auto", dry: "Dry", fan_only: "Fan", off: "Off" };
export const MODE_ORDER = ["heat", "cool", "heat_cool", "auto", "dry", "fan_only", "off"];

/** Nearest half degree. */
export const round05 = (v: number) => Math.round(v * 2) / 2;
/** 22 -> "22", 19.5 -> "19.5". */
export const fmtTemp = (v: number) => fmtNum(v, Number.isInteger(v) ? 0 : 1);

export interface ThermoModel {
  name: string;
  available: boolean;
  mode: string;
  tone: Tone;
  cur?: number;
  /** Single target, or undefined in heat/cool range mode. */
  tgt?: number;
  low?: number;
  high?: number;
  range: boolean;
  min: number;
  max: number;
  step: number;
  humidity?: number;
  modes: { id: string; label: string }[];
  /** Bloom colour: what it is doing, or (on but at target) the mode it is waiting in. None when off. */
  glow?: "heat" | "cool";
  /** Background bloom: rising while heating or cooling, wide and low when on but at target. */
  bloom: Bloom;
  unit: string;
}

const num = (v: unknown) => { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? undefined : n; };

export function toneOf(s: HassEntity, cur?: number, tgt?: number, low?: number, high?: number): Tone {
  const mode = s.state, action = s.attributes.hvac_action as string | undefined;
  if (mode === "off") return "off";
  if (action === "heating" || action === "preheating") return "heat";
  if (action === "cooling") return "cool";
  if (action) return "idle";
  // No action reported: work it out from the temperatures.
  if (cur === undefined) return "idle";
  if (low !== undefined && high !== undefined) return cur < low ? "heat" : cur > high ? "cool" : "idle";
  if (tgt === undefined) return "idle";
  if ((mode === "heat" || mode === "auto") && cur < tgt - 0.25) return "heat";
  if ((mode === "cool" || mode === "auto") && cur > tgt + 0.25) return "cool";
  return "idle";
}

export type Bloom = "none" | "rest" | "active";

/** Rising bloom while heating or cooling; a wide, low one in the mode's colour when on but at target; none otherwise. */
export function bloomOf(tone: Tone, mode: string): { glow?: "heat" | "cool"; bloom: Bloom } {
  if (tone === "heat" || tone === "cool") return { glow: tone, bloom: "active" };
  if (tone === "idle" && (mode === "heat" || mode === "cool")) return { glow: mode, bloom: "rest" };
  return { bloom: "none" };
}

/** Bloom ellipse as [width %, height %] of the card: wide and low at rest, taller than wide while active. */
export const BLOOM_SHAPE: Record<"dial" | "compact", Record<Bloom, [number, number]>> = {
  dial: { none: [0, 0], rest: [170, 42], active: [125, 112] },
  compact: { none: [0, 0], rest: [150, 70], active: [115, 150] },
};

/** The mode the heat/off toggle turns back on to: the last one used, else Heat, else the first the thermostat offers. */
export function turnOnMode(modes: string[], last?: string): string | undefined {
  const on = modes.filter((m) => m !== "off");
  if (last && on.includes(last)) return last;
  return on.includes("heat") ? "heat" : on[0];
}

export function buildThermostat(hass: HomeAssistant, cfg: HaloThermostatConfig): ThermoModel {
  const s = hass.states[cfg.entity];
  const unit = hass.config?.unit_system?.temperature ?? "°C";
  const empty: ThermoModel = { name: cfg.name ?? "Thermostat", available: false, mode: "off", tone: "off", range: false, min: 7, max: 35, step: 0.5, modes: [], bloom: "none", unit };
  if (!s) return empty;
  const a = s.attributes;
  const available = isAvailable(s);
  const cur = num(a.current_temperature), low = num(a.target_temp_low), high = num(a.target_temp_high);
  const range = low !== undefined && high !== undefined && num(a.temperature) === undefined;
  const tgt = range ? undefined : num(a.temperature);
  const supported: string[] = Array.isArray(a.hvac_modes) ? a.hvac_modes : [];
  const wanted = cfg.hvac_modes?.length ? cfg.hvac_modes : supported;
  const ids = MODE_ORDER.filter((m) => wanted.includes(m) && (supported.length === 0 || supported.includes(m)));
  const tone = available ? toneOf(s, cur, tgt, low, high) : "off";
  const hum = num(a.current_humidity) ?? (cfg.humidity ? num(hass.states[cfg.humidity]?.state) : undefined);
  return {
    name: cfg.name || (a.friendly_name as string | undefined) || "Thermostat",
    available, mode: s.state, tone,
    cur: cur === undefined ? undefined : round05(cur),
    tgt: tgt === undefined ? undefined : round05(tgt),
    low: low === undefined ? undefined : round05(low), high: high === undefined ? undefined : round05(high),
    range,
    min: num(a.min_temp) ?? 7, max: num(a.max_temp) ?? 35,
    step: Math.max(0.5, num(a.target_temp_step) ?? 0.5),
    humidity: hum === undefined ? undefined : Math.round(hum),
    modes: ids.map((id) => ({ id, label: MODE_LABELS[id] ?? id })),
    ...bloomOf(tone, s.state),
    unit,
  };
}

/** One press of + or -: a step, kept on a half degree and inside the thermostat's range. */
export function stepTarget(value: number, dir: 1 | -1, step: number, min: number, max: number) {
  return clamp(round05(value + dir * step), min, max);
}

export const watchedThermostat = (cfg: HaloThermostatConfig) => [cfg.entity, ...(cfg.humidity ? [cfg.humidity] : [])];

/** Angle (degrees, 0 = top, clockwise) of a temperature on the dial ring, which sweeps 270 degrees from -135. */
export const dialAngle = (v: number, min: number, max: number) => -135 + (270 * clamp(v, min, max) - 270 * min) / (max - min || 1);
