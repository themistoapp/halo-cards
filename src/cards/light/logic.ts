import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable } from "../../shared/util";

export type LightType = "none" | "pendant" | "downlight" | "strip" | "pole";
export interface LightRow { entity: string; name?: string; type?: LightType; colour?: string }
export interface HaloLightConfig {
  type: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  lights: (string | LightRow)[];
  /** Show the "All off" button (default on). */
  show_all_off?: boolean;
  /** Colour for lights that report none of their own (plain white bulbs). Default warm white. */
  colour?: string;
}

export const WARM_WHITE = "#ffe3bd";

export interface LightTile {
  entity: string;
  name: string;
  type: LightType;
  available: boolean;
  on: boolean;
  dimmable: boolean;
  /** 0-100, 0 when off. */
  pct: number;
  /** CSS colour the light is giving out. */
  glow: string;
  /** Glow strength 0-1: 0 off, 0.4-1 with brightness. */
  intensity: number;
  status: string;
}
export interface LightsModel { name: string; tiles: LightTile[]; nOn: number; total: number }

/** Kelvin to approximate display colour (Tanner Helland's fit). */
export function kelvinToCss(k: number): string {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export function isDimmable(s?: HassEntity): boolean {
  const modes: string[] = s?.attributes.supported_color_modes ?? [];
  return modes.some((m) => m !== "onoff");
}

export const brightnessPct = (s?: HassEntity) =>
  s?.state === "on" ? Math.max(1, Math.round((Number(s.attributes.brightness ?? 255) / 255) * 100)) : 0;

/** The colour the light is actually giving out: its own RGB, else its colour temperature, else the fallback. */
export function glowColour(s: HassEntity | undefined, fallback?: string): string {
  const rgb = s?.attributes.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const k = Number(s?.attributes.color_temp_kelvin);
  if (k > 0) return kelvinToCss(k);
  return fallback || WARM_WHITE;
}

export const intensityOf = (on: boolean, dimmable: boolean, pct: number) => (!on ? 0 : dimmable ? 0.4 + 0.6 * (pct / 100) : 1);

function statusOf(s: HassEntity | undefined, on: boolean, dimmable: boolean, pct: number): string {
  if (!isAvailable(s)) return "Unavailable";
  if (!on) return "Off";
  return dimmable ? `${pct}%` : "On";
}

/** Every row, including one just added in the editor that has no entity yet. */
export const allRowsOf = (cfg: HaloLightConfig): LightRow[] =>
  (cfg.lights ?? []).map((r) => (typeof r === "string" ? { entity: r } : r)).filter((r) => r && typeof r === "object");

export const rowsOf = (cfg: HaloLightConfig): LightRow[] => allRowsOf(cfg).filter((r) => r.entity);

export const watchedLights = (cfg: HaloLightConfig) => rowsOf(cfg).map((r) => r.entity);

export function buildLights(hass: HomeAssistant, cfg: HaloLightConfig): LightsModel {
  const tiles = rowsOf(cfg).map((r): LightTile => {
    const s = hass.states[r.entity];
    const available = isAvailable(s);
    const dimmable = isDimmable(s);
    const on = available && s.state === "on";
    const pct = on ? clamp(brightnessPct(s), 1, 100) : 0;
    return {
      entity: r.entity,
      name: r.name || (s?.attributes.friendly_name as string | undefined) || r.entity.replace(/^light\./, "").replace(/_/g, " "),
      type: r.type ?? "none",
      available, on, dimmable, pct,
      glow: glowColour(s, r.colour || cfg.colour),
      intensity: intensityOf(on, dimmable, pct),
      status: statusOf(s, on, dimmable, pct),
    };
  });
  return { name: cfg.name ?? "Lights", tiles, nOn: tiles.filter((t) => t.on).length, total: tiles.filter((t) => t.available).length };
}
