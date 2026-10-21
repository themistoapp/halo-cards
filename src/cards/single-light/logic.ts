import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable } from "../../shared/util";
import { WARM_WHITE, brightnessPct } from "../light/logic";

export type Fitting = "none" | "downlight" | "pendant" | "lantern" | "path" | "bar" | "bloom" | "gem" | "chandelier" | "fairy" | "string";
export type Layout = "auto" | "full" | "compact" | "mini";
/** A preset: a white (kelvin) or a colour (hex). */
export interface Preset { name?: string; kelvin?: number; colour?: string }
export interface HaloSingleLightConfig {
  type: string;
  entity: string;
  name?: string;
  /** Picture of the fitting (top right, or the thumbnail on the small sizes). "none" uses the icon. */
  fitting?: Fitting;
  /** Any mdi icon, used when there's no fitting picture. Default: a bulb. */
  icon?: string;
  /** Glow for lights that report no colour of their own. Default warm white. */
  colour?: string;
  /** Swatches; an empty list hides them. Default: four whites and four colours. */
  presets?: Preset[];
  /** Default auto: mini under 240px wide, compact under 200px tall, else full. */
  layout?: Layout;
  shadow?: boolean;
}

export const FITTINGS: Fitting[] = ["none", "downlight", "pendant", "lantern", "path", "bar", "bloom", "gem", "chandelier", "fairy", "string"];
export const DEFAULT_PRESETS: Preset[] = [
  { name: "Candlelight", kelvin: 2200 }, { name: "Warm white", kelvin: 2700 }, { name: "Neutral white", kelvin: 4000 }, { name: "Daylight", kelvin: 6000 },
  { name: "Amber", colour: "#f59e47" }, { name: "Rose", colour: "#f54790" }, { name: "Violet", colour: "#9847f5" }, { name: "Ocean", colour: "#47adf5" },
];
const COLOUR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];

export type RGB = [number, number, number];

/** Kelvin to RGB (Tanner Helland's fit), the numbers behind light/logic's kelvinToCss. */
export function kelvinRgb(k: number): RGB {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => Math.round(clamp(v, 0, 255));
  return [c(r), c(g), c(b)];
}
export function hexRgb(hex: string): RGB | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
export function rgbHs([r, g, b]: RGB): [number, number] {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn;
  let h = 0;
  if (d) h = mx === r / 255 ? ((g - b) / 255 / d + 6) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  return [h * 60, mx ? d / mx : 0];
}
export function hsRgb(h: number, s: number): RGB {
  const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}
export const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export const kelvinName = (k: number) => (k < 2450 ? "Candlelight" : k < 3200 ? "Warm white" : k < 4600 ? "Neutral white" : k < 5600 ? "Cool white" : "Daylight");
export function hueName(h: number, s: number) {
  if (s < 0.18) return "White";
  return h < 15 || h >= 345 ? "Red" : h < 40 ? "Orange" : h < 70 ? "Yellow" : h < 160 ? "Green" : h < 190 ? "Teal" : h < 250 ? "Blue" : h < 290 ? "Violet" : "Pink";
}

export interface Caps { dimmable: boolean; temp: boolean; colour: boolean; kMin: number; kMax: number }
export function capsOf(s?: HassEntity): Caps {
  const modes: string[] = s?.attributes.supported_color_modes ?? [];
  const kMin = Number(s?.attributes.min_color_temp_kelvin) || 2000, kMax = Number(s?.attributes.max_color_temp_kelvin) || 6500;
  return { dimmable: modes.some((m) => m !== "onoff"), temp: modes.includes("color_temp"), colour: modes.some((m) => COLOUR_MODES.includes(m)), kMin, kMax: Math.max(kMax, kMin + 100) };
}

const presetRgb = (p: Preset): RGB | undefined => (p.kelvin ? kelvinRgb(p.kelvin) : p.colour ? hexRgb(p.colour) : undefined);
/** The presets this light can show: whites need colour temperature or colour, colours need colour. */
export function presetsFor(cfg: HaloSingleLightConfig, caps: Caps): Preset[] {
  return (cfg.presets ?? DEFAULT_PRESETS).filter((p) => (p.kelvin ? caps.temp || caps.colour : p.colour ? caps.colour && !!hexRgb(p.colour) : false));
}
/** Up to n presets, whites and colours in turn (each kind in list order), so a colour light gets some of both. */
export function pickPresets(list: Preset[], n: number): Preset[] {
  if (n >= list.length) return list;
  const whites = list.filter((p) => p.kelvin), colours = list.filter((p) => !p.kelvin), out: Preset[] = [];
  for (let i = 0; out.length < n; i++) {
    if (i < whites.length) out.push(whites[i]);
    if (out.length < n && i < colours.length) out.push(colours[i]);
  }
  return out;
}

/** Where the swatches go: a row of their own, beside the name (compact), or nowhere; and how many fit. */
export interface Slots { where: "row" | "inline" | "none"; n: number }
const fit = (room: number, size: number, gap: number) => Math.max(0, Math.floor((room + gap) / (size + gap)));
/** Tall enough (a 12 × 3 bar or a 6 × 3 mini) for a row of swatches under everything else. */
export const ROW_FROM = 168;
export function presetSlots(layout: Exclude<Layout, "auto">, w: number, h: number): Slots {
  // Full and tall rows: 30px swatches, 6px apart, less the padding and the white | colour divider.
  if (layout === "full") return { where: "row", n: w > 0 ? fit(w - 39, 30, 6) : Infinity };
  if (layout === "compact") {
    if (h >= ROW_FROM) return { where: "row", n: w > 0 ? fit(w - 31, 30, 6) : Infinity };
    // Beside the name: 24px swatches, 8px apart, after the thumbnail and at least 110px for the name.
    const n = w > 0 ? fit(w - 198, 24, 8) : 3;
    return n >= 2 ? { where: "inline", n } : { where: "none", n: 0 };
  }
  return h >= ROW_FROM && w > 0 ? { where: "row", n: fit(w - 28, 24, 6) } : { where: "none", n: 0 };
}
export const presetName = (p: Preset) => p.name || (p.kelvin ? kelvinName(p.kelvin) : p.colour ?? "");
export const presetCss = (p: Preset) => css(presetRgb(p) ?? [255, 227, 189]);

/** What a preset sends: a white as colour temperature when the light has it, else as a colour. */
export function presetService(p: Preset, caps: Caps): Record<string, unknown> {
  if (p.kelvin) return caps.temp ? { color_temp_kelvin: clamp(p.kelvin, caps.kMin, caps.kMax) } : { rgb_color: kelvinRgb(p.kelvin) };
  return { rgb_color: hexRgb(p.colour!) };
}

export interface LightState {
  available: boolean; on: boolean; pct: number;
  /** "temp", "colour", or "plain" (the light gives no colour). */
  mode: "temp" | "colour" | "plain";
  kelvin: number; hue: number; sat: number;
  glow: RGB;
}

export function readLight(s: HassEntity | undefined, cfg: HaloSingleLightConfig): LightState {
  const caps = capsOf(s), available = isAvailable(s), on = available && s.state === "on";
  const a = s?.attributes ?? {};
  const fallback = hexRgb(cfg.colour ?? "") ?? hexRgb(WARM_WHITE)!;
  const k = Number(a.color_temp_kelvin);
  const rgb: RGB | undefined = Array.isArray(a.rgb_color) && a.rgb_color.length >= 3 ? [a.rgb_color[0], a.rgb_color[1], a.rgb_color[2]] : undefined;
  const hsAttr: [number, number] | undefined = Array.isArray(a.hs_color) ? [Number(a.hs_color[0]), Number(a.hs_color[1]) / 100] : undefined;
  let mode: LightState["mode"] = "plain", glow = fallback;
  if ((a.color_mode === "color_temp" || (!caps.colour && caps.temp)) && k > 0) { mode = "temp"; glow = kelvinRgb(k); }
  else if (rgb && caps.colour) { mode = "colour"; glow = rgb; }
  else if (k > 0) { mode = "temp"; glow = kelvinRgb(k); }
  const [hue, sat] = hsAttr ?? rgbHs(glow);
  return { available, on, pct: on ? clamp(brightnessPct(s), 1, 100) : 0, mode, kelvin: k > 0 ? k : 2700, hue, sat, glow };
}

/** The headline: what the light is doing, in words (no numbers). */
export function headline(l: LightState, presets: Preset[]): string {
  if (!l.available) return "Unavailable";
  if (!l.on) return "Off";
  if (l.mode === "temp") {
    const p = presets.find((x) => x.kelvin && Math.abs(x.kelvin - l.kelvin) < 60);
    return p?.name || kelvinName(l.kelvin);
  }
  if (l.mode === "colour") {
    const p = presets.find((x) => isSelected(x, l));
    return p?.name || hueName(l.hue, l.sat);
  }
  return "On";
}

export function isSelected(p: Preset, l: LightState): boolean {
  if (!l.on) return false;
  if (p.kelvin) return l.mode === "temp" && Math.abs(p.kelvin - l.kelvin) < 60;
  const rgb = p.colour ? hexRgb(p.colour) : undefined;
  if (!rgb || l.mode !== "colour") return false;
  const [h, s] = rgbHs(rgb), dh = Math.abs(h - l.hue);
  return Math.min(dh, 360 - dh) < 8 && Math.abs(s - l.sat) < 0.25;
}

export function pickLayout(cfg: HaloSingleLightConfig, w: number, h: number): Exclude<Layout, "auto"> {
  if (cfg.layout && cfg.layout !== "auto") return cfg.layout;
  if (w > 0 && w < 240) return "mini";
  if (h > 0 && h < 200) return "compact";
  return "full";
}

export const nameOf = (hass: HomeAssistant, cfg: HaloSingleLightConfig) =>
  cfg.name || (hass.states[cfg.entity]?.attributes.friendly_name as string | undefined) || cfg.entity.replace(/^light\./, "").replace(/_/g, " ");

/** Glow strength 0-1: 0 off, 0.4-1 with brightness (as on the Lights card). */
export const intensity = (on: boolean, dimmable: boolean, pct: number) => (!on ? 0 : dimmable ? 0.4 + 0.6 * (pct / 100) : 1);
