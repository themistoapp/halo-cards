import type { HassEntity } from "../../shared/types";
import { hexToHsl, hslToHex } from "../../shared/colour";
import { clamp } from "../../shared/util";

// The Backdrop card's sky: nine stages placed around sunrise and sunset, blended minute by minute. A warm glow is the sun
// (rising bottom left, over the top, setting bottom right), a cooler one sits on the horizon, and at night an aurora drifts across the top.

export interface HaloBackdropConfig {
  type: string;
  /** tile: a daylight tile (time to sunset, time since sunrise); hidden: no tile, only the background. */
  show?: "tile" | "hidden";
  /** The sun entity (default sun.sun). */
  entity?: string;
  name?: string;
  /** How big and strong the glows are, 0.4 to 1.5 (default 1). */
  strength?: number;
  /** moves: the sun's glow follows the sun (default); fixed: it stays top left. */
  sun?: "moves" | "fixed";
  grain?: boolean;
  shadow?: boolean;
}

export type Stage = "night" | "predawn" | "sunrise" | "morning" | "midday" | "afternoon" | "golden" | "sunset" | "dusk";
/** b the base, a the sun's glow, c the glow on the horizon. */
export interface SkyColours { b: string; a: string; c: string }

const RAW_SKY: Record<"light" | "dark", Record<Stage, SkyColours>> = {
  light: {
    night:     { b: "#e2ecec", a: "#c4e6dc", c: "#bcd2ee" },
    predawn:   { b: "#e9e4ef", a: "#c4b3e6", c: "#f1c3cd" },
    sunrise:   { b: "#f3d3c2", a: "#ff8f3d", c: "#ec6f95" },
    morning:   { b: "#edf3fa", a: "#ffd98a", c: "#a9d0f5" },
    midday:    { b: "#eff5fa", a: "#fff0bf", c: "#a3d2f2" },
    afternoon: { b: "#f5f0e7", a: "#ffd27a", c: "#b1ccef" },
    golden:    { b: "#f4d6b4", a: "#ff8a24", c: "#ef6f9c" },
    sunset:    { b: "#ecbdb3", a: "#f2643a", c: "#8f74f0" },
    dusk:      { b: "#dfe3ee", a: "#b7a6dc", c: "#9fb8e6" },
  },
  dark: {
    night:     { b: "#05090e", a: "#0c3a3a", c: "#122a52" },
    predawn:   { b: "#0e0f1c", a: "#3d306e", c: "#6c3551" },
    sunrise:   { b: "#1a0f10", a: "#b4521a", c: "#93264f" },
    morning:   { b: "#0d1117", a: "#6b5520", c: "#1d4f8a" },
    midday:    { b: "#0d1218", a: "#5f5a2e", c: "#1d5a8a" },
    afternoon: { b: "#121110", a: "#7a5a1a", c: "#2a4a7a" },
    golden:    { b: "#1a110a", a: "#b8601a", c: "#8f2550" },
    sunset:    { b: "#180c0f", a: "#a8341f", c: "#5a46d8" },
    dusk:      { b: "#0a0c16", a: "#3d2a5c", c: "#1f3f7a" },
  },
};
/** The aurora's two bands: green over blue. */
const RAW_AURORA = { light: { g: "#9fe3c9", b: "#a9c8f0" }, dark: { g: "#127a62", b: "#1b4a8a" } };

/** How much of each colour's saturation the sky keeps: the same hues and lightness, a little calmer. */
export const SATURATION = 0.72;
const calm = (c: string) => { const h = hexToHsl(c); return h ? hslToHex(h.h, h.s * SATURATION, h.l) : c; };
const calmAll = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(Object.entries(v as Record<string, string>).map(([n, c]) => [n, calm(c)]))])) as T;
export const SKY = { light: calmAll(RAW_SKY.light), dark: calmAll(RAW_SKY.dark) };
export const AURORA = calmAll(RAW_AURORA);

const DAY_MS = 86_400_000;
const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

export interface SunTimes {
  /** Today's sunrise and sunset, minutes after midnight (local). */
  rise: number;
  set: number;
  up: boolean;
  /** From the sun entity; false means the 06:00 and 18:00 stand-ins. */
  known: boolean;
  nextRise?: number;
  nextSet?: number;
}

/** Sunrise and sunset from sun.sun's next_rising and next_setting (they move a minute or two a day, so the next ones stand in for today's). */
export function sunTimes(s: HassEntity | undefined, now: Date): SunTimes {
  const nr = Date.parse(String(s?.attributes.next_rising ?? "")), ns = Date.parse(String(s?.attributes.next_setting ?? ""));
  const m = minuteOf(now);
  if (!Number.isFinite(nr) || !Number.isFinite(ns)) return { rise: 360, set: 1080, up: m >= 360 && m < 1080, known: false };
  const rise = minuteOf(new Date(nr)), set = minuteOf(new Date(ns));
  // Polar day or night, or a clock that puts sunset before sunrise: fall back to a plain day.
  if (set - rise < 60) return { rise: 360, set: 1080, up: s?.state === "above_horizon", known: false };
  return { rise, set, up: s?.state === "above_horizon", known: true, nextRise: nr, nextSet: ns };
}

/** The stages' times around sunrise R and sunset S, in order (short days squeeze the middle). */
export function frames(R: number, S: number): [number, Stage][] {
  const len = S - R, M = (R + S) / 2;
  const f: [number, Stage][] = [[R - 110, "night"], [R - 40, "predawn"], [R, "sunrise"], [R + Math.min(120, len * 0.2), "morning"], [M, "midday"],
    [S - Math.min(150, len * 0.25), "afternoon"], [S - Math.min(50, len * 0.1), "golden"], [S, "sunset"], [S + 40, "dusk"], [S + 110, "night"]];
  for (let i = 1; i < f.length; i++) if (f[i][0] <= f[i - 1][0]) f[i][0] = f[i - 1][0] + 1;
  return f;
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mixHex = (a: string, b: string, f: number) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * f)); };
const ease = (f: number) => f * f * (3 - 2 * f);
const ramp = (t: number, from: number, to: number) => ease(clamp((t - from) / (to - from), 0, 1));

export interface Sky extends SkyColours {
  stage: Stage;
  /** The sun's glow: where (in % of the page), its size and its weight (0 to 1). */
  sun: { x: number; y: number; k: number; w: number };
  /** The horizon glow's centre across the bottom and its size. */
  horizon: { x: number; k: number };
  /** The aurora: where it sits across the top and its weight. */
  aurora: { x: number; w: number };
  dark: boolean;
}

/** The sky at minute t of the day. */
export function skyAt(t: number, R: number, S: number, dark: boolean, opts: { strength?: number; fixed?: boolean } = {}): Sky {
  const fr = frames(R, S), first = fr[0][0], last = fr[fr.length - 1][0], set = SKY[dark ? "dark" : "light"];
  const strength = clamp(opts.strength ?? 1, 0.4, 1.5);
  // Late evenings past midnight and early mornings before it belong to the nearer day.
  const tt = [t, t + 1440, t - 1440].find((x) => x >= first && x <= last) ?? t;
  let col: SkyColours = set.night, stage: Stage = "night";
  if (tt > first && tt < last) {
    let i = 0;
    while (fr[i + 1][0] < tt) i++;
    const [t0, n0] = fr[i], [t1, n1] = fr[i + 1], f = ease((tt - t0) / (t1 - t0)), A = set[n0], B = set[n1];
    col = { b: mixHex(A.b, B.b, f), a: mixHex(A.a, B.a, f), c: mixHex(A.c, B.c, f) };
    stage = f < 0.5 ? n0 : n1;
  }
  const p = clamp((tt - R) / (S - R), 0, 1), elev = Math.sin(Math.PI * p);
  let x = 6 + 88 * p, y = 100 - 88 * elev;
  if (tt < R) y = 100 + ((R - tt) / 40) * 12;
  if (tt > S) y = 100 + ((tt - S) / 40) * 12;
  if (opts.fixed) { x = 14; y = 8; }
  const sunW = tt <= R ? ramp(tt, R - 60, R - 20) : 1 - ramp(tt, S + 20, S + 60);
  // The aurora fades in after dusk and out before first light, drifting left to right through the night.
  const auroraW = tt >= S ? ramp(tt, S + 30, S + 110) : 1 - ramp(tt, R - 110, R - 30);
  const nightLen = 1440 - (S - R), sinceSet = ((t - S) % 1440 + 1440) % 1440;
  return {
    ...col, stage, dark,
    sun: { x, y, k: (0.85 + 0.4 * elev) * strength, w: tt >= R - 60 && tt <= S + 60 ? sunW : 0 },
    horizon: { x: opts.fixed ? 80 : 100 - x * 0.7, k: (1 - 0.45 * elev) * strength },
    aurora: { x: 18 + 50 * clamp(sinceSet / nightLen, 0, 1), w: auroraW * Math.min(strength, 1.2) },
  };
}

const f1 = (n: number) => n.toFixed(1);
const fade = (c: string, w: number) => (w >= 0.995 ? c : `color-mix(in srgb, ${c} ${f1(w * 100)}%, transparent)`);
const GRAIN = (dark: boolean) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${dark ? ".05" : ".14"} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`;

/** The sky as one CSS background (layers top to bottom: grain, aurora, horizon glow, sun glow, base). */
export function skyBackground(s: Sky, grain = true): string {
  const layers: string[] = [];
  if (grain) layers.push(GRAIN(s.dark));
  if (s.aurora.w > 0.02) {
    const a = AURORA[s.dark ? "dark" : "light"], w = s.aurora.w;
    layers.push(`radial-gradient(ellipse 70% 34% at ${f1(s.aurora.x)}% 8%, ${fade(a.g, w)} 0%, transparent 100%)`);
    layers.push(`radial-gradient(ellipse 55% 30% at ${f1(s.aurora.x + 24)}% 20%, ${fade(a.b, w * 0.85)} 0%, transparent 100%)`);
  }
  layers.push(`radial-gradient(circle farthest-corner at ${f1(s.horizon.x)}% 104%, ${s.c} 0%, transparent ${f1(s.horizon.k * 46)}%)`);
  if (s.sun.w > 0.02) {
    layers.push(`radial-gradient(circle farthest-corner at ${f1(s.sun.x)}% ${f1(s.sun.y)}%, ${fade(s.a, s.sun.w)} 0%, ${fade(mixHex(s.a, s.b, 0.5), s.sun.w)} ${f1(s.sun.k * 26)}%, transparent ${f1(s.sun.k * 64)}%)`);
  }
  layers.push(s.b);
  return layers.join(", ");
}

export interface Daylight {
  up: boolean;
  /** By day: ms since sunrise and to sunset. By night: ms since sunset and to sunrise. */
  since: number;
  until: number;
  /** How far through the day or night, 0 to 1. */
  p: number;
  /** Today's daylight, ms. */
  length: number;
}

/** Time since sunrise and to sunset by day, since sunset and to sunrise by night. */
export function daylight(sun: SunTimes, now: number): Daylight | undefined {
  if (!sun.known || sun.nextRise === undefined || sun.nextSet === undefined) return undefined;
  const length = (sun.set - sun.rise) * 60_000;
  const [since, until] = sun.up ? [now - (sun.nextRise - DAY_MS), sun.nextSet - now] : [now - (sun.nextSet - DAY_MS), sun.nextRise - now];
  const s = Math.max(0, since), u = Math.max(0, until);
  return { up: sun.up, since: s, until: u, p: s + u > 0 ? s / (s + u) : 0, length };
}

/** 3h 42m, or 25m under an hour. */
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000)), h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
