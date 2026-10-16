import { css, html, nothing, svg, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";

// Gauges for the Entity card: a ring, a semicircle and a line, each a grey track with the reading's share filled in.
// The fill of the ring and semicircle is one arc used as a mask over a conic gradient, so it shades along its length
// without seams and keeps round ends.

export interface GaugeColours { from: string; to: string }
/** A stretch of the track (0 to 1) in a colour, drawn faintly under the fill. */
export interface Band { from: number; to: number; colour: string }

type Kind = "ring" | "semi";

const f2 = (n: number) => n.toFixed(2);

/** Point on the arc at t (0 to 1): the ring runs clockwise from the top, the semicircle from the left over the top. */
function point(kind: Kind, cx: number, cy: number, r: number, t: number): [number, number] {
  if (kind === "ring") { const a = -Math.PI / 2 + 2 * Math.PI * t; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  const a = Math.PI * t;
  return [cx - r * Math.cos(a), cy - r * Math.sin(a)];
}

/** Path along the arc from a to b, split in two so no piece is over half the arc. */
function arcPath(kind: Kind, cx: number, cy: number, r: number, a: number, b: number): string {
  const p = (t: number) => point(kind, cx, cy, r, t).map(f2).join(" ");
  const mids = a < 0.5 && b > 0.5 ? [0.5, b] : [b];
  return `M${p(a)}` + mids.map((t) => `A${f2(r)} ${f2(r)} 0 0 1 ${p(t)}`).join("");
}

function arc(kind: Kind, w: number, h: number, cx: number, cy: number, r: number, sw: number, frac: number, c: GaugeColours, bands: Band[], inner: unknown) {
  const track = kind === "ring"
    ? svg`<circle cx=${cx} cy=${cy} r=${r} fill="none" class="trk" stroke-width=${sw}></circle>`
    : svg`<path d=${arcPath(kind, cx, cy, r, 0, 1)} fill="none" class="trk" stroke-width=${sw} stroke-linecap="round"></path>`;
  // Bands overlap a hair so no gap shows between them.
  const bandPaths = bands.map((b) => svg`<path d=${arcPath(kind, cx, cy, r, b.from, Math.min(b.to + 0.006, 1))} fill="none" stroke=${b.colour} stroke-opacity=".38" stroke-width=${sw}></path>`);
  let fill: TemplateResult | typeof nothing = nothing;
  if (frac > 0.001) {
    const d = arcPath(kind, cx, cy, r, 0, frac);
    const mask = `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round"/></svg>`).replace(/'/g, "%27")}') 0 0 / 100% 100% no-repeat`;
    // The round start cap sits a little before the start: keep it the start colour.
    const cap = (sw / 2 / r) * 180 / Math.PI, span = kind === "ring" ? 360 : 180, start = (kind === "ring" ? 0 : 270) - cap;
    const bg = `conic-gradient(from ${f2(start)}deg at ${f2(cx)}px ${f2(cy)}px, ${c.from} 0deg, ${c.from} ${f2(cap)}deg, ${c.to} ${f2(cap + span)}deg, ${c.to} 360deg)`;
    fill = html`<div class="gfill" style=${styleMap({ background: bg, "-webkit-mask": mask, mask })}></div>`;
  }
  return html`<div class="gz" style=${styleMap({ width: `${w}px`, height: `${h}px` })}>
    <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">${track}${bandPaths}</svg>${fill}${inner ?? nothing}</div>`;
}

/** A full ring, diameter d, line width sw. */
export const ringGauge = (d: number, sw: number, frac: number, c: GaugeColours, bands: Band[], inner?: unknown) =>
  arc("ring", d, d, d / 2, d / 2, d / 2 - sw / 2, sw, frac, c, bands, inner);

/** A semicircle w wide; its feet sit on the bottom edge (the round caps reach sw / 2 below them). */
export const semiGauge = (w: number, sw: number, frac: number, c: GaugeColours, bands: Band[], inner?: unknown) =>
  arc("semi", w, w / 2 + sw / 2, w / 2, w / 2, w / 2 - sw / 2, sw, frac, c, bands, inner);

/** A bar, h high, filled from the left. The gradient spans the whole track, so the fill's end colour shows how far along it is. */
export function lineGauge(h: number, frac: number, c: GaugeColours, bands: Band[]) {
  const bg = bands.length
    ? { background: `linear-gradient(90deg, ${bands.map((b) => `color-mix(in srgb, ${b.colour} 38%, var(--track)) ${f2(b.from * 100)}% ${f2(b.to * 100)}%`).join(", ")})` }
    : {};
  const fill = frac > 0.001
    ? html`<div class="lfill" style=${styleMap({ width: `${f2(frac * 100)}%`, background: `linear-gradient(90deg, ${c.from}, ${c.to})`, "background-size": `${f2(100 / frac)}% 100%` })}></div>`
    : nothing;
  return html`<div class="lbar" style=${styleMap({ height: `${h}px`, ...bg })}>${fill}</div>`;
}

export const gaugeStyles = css`
  .val.low { margin-top: auto; }
  .gwrap { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .gwrap.end { justify-content: flex-end; }
  .gz { position: relative; flex: none; }
  .gz svg { display: block; overflow: visible; }
  .gz .trk { stroke: var(--track); }
  .gz .gfill { position: absolute; inset: 0; }
  .gz .in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-width: 0; }
  .gz .in .val { max-width: 100%; min-width: 0; }
  .gz .in .det { -webkit-line-clamp: 1; font-size: 11px; line-height: 14px; margin-top: 4px; }
  .beside { margin-top: auto; display: flex; align-items: flex-end; gap: 12px; min-width: 0; }
  .beside .col { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .beside .det { -webkit-line-clamp: 1; }
  .gl { flex: none; display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
  .lbar { position: relative; overflow: hidden; border-radius: 99px; background: var(--track); }
  .lfill { position: absolute; inset: 0 auto 0 0; border-radius: 99px; }
  .glab { display: flex; justify-content: space-between; gap: 6px; font-size: 10px; line-height: 12px; color: var(--t-det); font-variant-numeric: tabular-nums; }
  .glab > span { opacity: .7; white-space: nowrap; }
  .glab .d { flex: 1 1 auto; min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; opacity: 1; font-size: 11px; }
  .glab .d b { font-weight: 600; }
  .det.c { text-align: center; -webkit-line-clamp: 1; }
`;
