import { css, html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { currencyAfter } from "./format";
import { graphPath } from "./history";

// The small tile shared by the Energy and Entity cards: a chip with the icon and title, a figure, a line below,
// and a history graph along the bottom.

/** Graph colours, [day, night]: g0 at the top of the fill, a0 at the bottom, ln the line (and the icon). */
export const PALETTE = {
  grey:   [{ g0: "#aeb3bf", a0: "#aeb3bf", ln: "#666670" }, { g0: "#5a606e", a0: "#5a606e", ln: "#b0b4bf" }],
  red:    [{ g0: "#f59a94", a0: "#e0566a", ln: "#c2362b" }, { g0: "#7a2622", a0: "#6a1f33", ln: "#ff7b72" }],
  orange: [{ g0: "#f5b27c", a0: "#f07c62", ln: "#c4561a" }, { g0: "#8a4a1c", a0: "#7a2f2a", ln: "#f4a36a" }],
  yellow: [{ g0: "#f2c14e", a0: "#f47fa4", ln: "#b97d00" }, { g0: "#8a6a10", a0: "#a8325f", ln: "#f2c14e" }],
  green:  [{ g0: "#6fcf9a", a0: "#2fc4b8", ln: "#2f6b4a" }, { g0: "#1f7a52", a0: "#0f6f78", ln: "#6fcf9a" }],
  teal:   [{ g0: "#8fe0d8", a0: "#2fc4b8", ln: "#1a7f77" }, { g0: "#146b64", a0: "#0f5a63", ln: "#5fe0d4" }],
  blue:   [{ g0: "#8cc2f5", a0: "#2f7bff", ln: "#1f5fc4" }, { g0: "#1d4f8a", a0: "#1b3f8f", ln: "#7fb6ff" }],
  purple: [{ g0: "#8a6bff", a0: "#2f7bff", ln: "#4b3fd6" }, { g0: "#5a46c8", a0: "#2457d6", ln: "#a99bff" }],
  pink:   [{ g0: "#f6a8c4", a0: "#e0568a", ln: "#b5306a" }, { g0: "#7a2448", a0: "#6a1f4a", ln: "#f78fb6" }],
} as const;
export type PaletteName = keyof typeof PALETTE;
export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[];

/** Day or night palette, or white (on a gradient). */
export type ColourMode = "day" | "night" | "white";
export interface GraphColours { g0: string; a0: string; ln: string; o0: number; o1: number }

const named = (c?: string): PaletteName | undefined => {
  const k = c?.trim().toLowerCase();
  return k && k in PALETTE ? (k as PaletteName) : undefined;
};
/** Anything else typed in (a hex colour, rgb(), a CSS name) is used as given, as long as it can't break out of the style. */
const custom = (c?: string): string | undefined => {
  const v = c?.trim();
  return v && !named(v) && /^[#\w\s(),.%-]+$/.test(v) ? v : undefined;
};

/** Graph colours for a palette name or your own colour (grey if neither). */
export function graphColours(colour: string | undefined, mode: ColourMode): GraphColours {
  if (mode === "white") return { g0: "#fff", a0: "#fff", ln: "#fff", o0: 0.42, o1: 0.05 };
  const own = custom(colour);
  if (own) {
    return mode === "night"
      ? { g0: `color-mix(in srgb, ${own} 55%, #000)`, a0: `color-mix(in srgb, ${own} 45%, #000)`, ln: `color-mix(in srgb, ${own} 70%, #fff)`, o0: 0.85, o1: 0.45 }
      : { g0: `color-mix(in srgb, ${own} 60%, #fff)`, a0: own, ln: `color-mix(in srgb, ${own} 75%, #000)`, o0: 0.85, o1: 0.45 };
  }
  return { ...PALETTE[named(colour) ?? "grey"][mode === "night" ? 1 : 0], o0: 0.85, o1: 0.45 };
}

/** The icon's colour: the palette's line colour, your own colour, or undefined to follow the text. On a gradient the chip is white, so the day colour. */
export function iconColour(colour: string | undefined, mode: ColourMode): string | undefined {
  const n = named(colour);
  if (n) return PALETTE[n][mode === "night" ? 1 : 0].ln;
  return custom(colour);
}

/** How a unit sits with the big figure: currency before or after as the language writes it, % and degrees at full size, the rest small. */
export function unitParts(unit: string): { pre: string; inline: string; small: string } {
  if (/^[£$€¥]$/.test(unit)) return currencyAfter() ? { pre: "", inline: "", small: unit } : { pre: unit, inline: "", small: "" };
  if (unit === "%") return { pre: "", inline: "%", small: "" };
  if (/^°[CF]?$/.test(unit)) return { pre: "", inline: "°", small: "" };
  return { pre: "", inline: "", small: unit };
}

export function figure(value: string, unit: string): TemplateResult {
  const u = unitParts(unit);
  return html`<span class="fig">${u.pre}${value}${u.inline}${u.small ? html`<span class="unit">${u.small}</span>` : nothing}</span>`;
}

/** The graph along the bottom of a tile, between `lo` and `hi`. Colours come from --g0 / --a0 / --ln, or `colours`. */
export function tileGraph(values: (number | null)[], lo: number, hi: number, id: string, colours?: GraphColours) {
  const p = graphPath(values, hi, lo);
  if (!p) return nothing;
  const vars = colours ? { "--g0": colours.g0, "--a0": colours.a0, "--ln": colours.ln, "--o0": String(colours.o0), "--o1": String(colours.o1) } : {};
  return html`<div class="gw" style=${styleMap(vars)}><svg class="graph" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id=${id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--g0);stop-opacity:var(--o0, .85)"/><stop offset="1" style="stop-color:var(--a0);stop-opacity:var(--o1, .45)"/>
    </linearGradient></defs>
    <path d=${p.area} fill="url(#${id})"/><path class="ln" d=${p.line}/></svg></div>`;
}

export const tileStyles = css`
  .tile {
    --px: 14px; --py: 14px; --fig: 38px; --t-ink: var(--ink); --t-det: var(--t-ink);
    --chip-bg: color-mix(in srgb, var(--surface) 62%, transparent); --chip-ico: var(--surface); --chip-ink: var(--t-ink);
    position: relative; overflow: hidden; box-sizing: border-box; min-width: 0;
    padding: var(--py) var(--px); display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; color: var(--t-ink);
  }
  .tile .top { display: flex; min-width: 0; }
  .tchip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; min-width: 0; box-sizing: border-box; min-height: 32px; padding: 3px 12px 3px 3px;
    border-radius: 99px; background: var(--chip-bg); color: var(--chip-ink); }
  .tchip.bare { padding: 3px 12px; }
  .tchip .ico { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--chip-ico); transition: color .6s ease; }
  .tchip .ico > svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .tchip .label { font-size: 13px; line-height: 18px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .fig { display: block; font-size: var(--fig); line-height: 1; font-weight: 600; letter-spacing: -.045em; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fig .unit { font-size: .38em; font-weight: 500; letter-spacing: 0; margin-left: 3px; opacity: .78; }
  .det { font-size: 12px; line-height: 16px; margin-top: 2px; color: var(--t-det); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .det b { font-weight: 600; }
  /* The graph only ever takes the space left under the text (never behind it), and disappears if that is too little. */
  .gw { flex: 1 1 0; min-height: 0; margin: 0 calc(var(--px) * -1) calc(var(--py) * -1); position: relative; container-type: size; }
  .gw svg.graph { position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: 50% 100%; animation: rise 1.2s cubic-bezier(.22,.7,.2,1) backwards; }
  @container (max-height: 19px) { .gw svg.graph { display: none; } }
  svg.graph .ln { fill: none; stroke: var(--ln); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  @keyframes rise { from { transform: scaleY(0); opacity: 0; } }
  /* Tight: small tiles, and the energy card in shorter slots. */
  .tile.tight { --px: 9px; --py: 9px; gap: 3px; }
  .tight .tchip { gap: 4px; min-height: 24px; padding: 2px 7px 2px 2px; }
  .tight .tchip.bare { padding: 2px 8px; }
  .tight .tchip .ico { width: 20px; height: 20px; }
  .tight .tchip .ico > svg { width: 13px; height: 13px; }
  .tight .tchip .label { font-size: 11px; line-height: 16px; letter-spacing: -.01em; }
  .tight .det { font-size: 11px; line-height: 14px; margin-top: 0; -webkit-line-clamp: 1; }
  @media (prefers-reduced-motion: reduce) { .gw svg.graph { animation: none; } .tchip .ico { transition: none; } }
`;
