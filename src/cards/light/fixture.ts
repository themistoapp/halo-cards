import { css, html, nothing } from "lit";
import { FIXTURES } from "./fixtures";
import type { LightTile } from "./logic";

// Width / height of each fitting's drawing. The bars are drawn in CSS, so they take whatever shape the tile gives them.
const RATIO = { pendant: FIXTURES.pendant.ratio, downlight: FIXTURES.downlight.ratio } as const;

/**
 * Picture of the fitting with its opening lit in the light's colour, brighter with brightness.
 * `h` is the drawing's height in px; the glow scales with it.
 */
export function fixture(t: LightTile, h = 60) {
  if (t.type === "none") return nothing;
  const style = `--glow:${t.glow};--i:${t.intensity.toFixed(2)};--fxh:${h}px`;
  if (t.type === "strip" || t.type === "pole") return html`<div class="fx ${t.type} ${t.on ? "on" : ""}" style=${style}><i></i></div>`;
  const f = FIXTURES[t.type], b = f.bulb;
  return html`<div class="fx ${t.type}" style="${style};--r:${RATIO[t.type].toFixed(3)}"><img src=${f.src} alt="" />
    <i class="bulb" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></i></div>`;
}

/** Glow sizes scale with the drawing (--fxh) so it reads the same at any size. */
export const fixtureStyles = css`
  .fx { --u: calc(var(--fxh, 60px) / 84); position: relative; flex: none; height: var(--fxh, 60px); pointer-events: none; }
  .fx.pendant, .fx.downlight { width: calc(var(--fxh, 60px) * var(--r, 1)); }
  .fx.strip { width: 100%; } .fx.pole { width: 40px; }
  .fx img { display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 calc(6 * var(--u)) calc(10 * var(--u)) rgba(0,0,0,.25)); }
  .fx .bulb { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; opacity: var(--i, 0); transition: opacity .3s, background .3s, box-shadow .3s;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--glow) 30%, white) 0%, var(--glow) 62%, color-mix(in srgb, var(--glow) 55%, transparent) 100%);
    box-shadow: 0 0 calc(5 * var(--u)) calc(1 * var(--u)) var(--glow), 0 0 calc(16 * var(--u)) calc(4 * var(--u)) color-mix(in srgb, var(--glow) 50%, transparent); }
  /* Pendant: light falls out of the bottom. */
  .fx.pendant .bulb::after { content: ""; position: absolute; left: -35%; right: -35%; top: 50%; height: 260%;
    background: radial-gradient(ellipse 50% 70% at 50% 0%, color-mix(in srgb, var(--glow) 40%, transparent), transparent); filter: blur(calc(4 * var(--u))); }
  /* Horizontal bar: a hairline edge with diffused light washing up behind it. */
  .fx.strip i, .fx.pole i { position: absolute; background: color-mix(in srgb, var(--ink) 35%, transparent); transition: background .3s, box-shadow .3s; }
  .fx.strip i { left: 0; right: 0; bottom: 18%; height: 1px; }
  .fx.strip::before { content: ""; position: absolute; left: 0; right: 0; bottom: 18%; height: 78%; opacity: var(--i, 0); transition: opacity .3s;
    background: linear-gradient(to top, color-mix(in srgb, var(--glow) 80%, transparent), color-mix(in srgb, var(--glow) 22%, transparent) 50%, transparent);
    -webkit-mask: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent); mask: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent); filter: blur(calc(3 * var(--u))); }
  .fx.strip.on i { background: color-mix(in srgb, var(--glow) 55%, var(--ink)); box-shadow: 0 -1px calc(5 * var(--u)) var(--glow); }
  /* Vertical bar: a hairline glowing out to both sides, fading at the ends. */
  .fx.pole i { top: 4%; bottom: 4%; left: 50%; width: 1px; transform: translateX(-50%); }
  .fx.pole::before { content: ""; position: absolute; inset: 4% 0; opacity: var(--i, 0); transition: opacity .3s;
    background: linear-gradient(to right, transparent, color-mix(in srgb, var(--glow) 25%, transparent) 25%, color-mix(in srgb, var(--glow) 85%, transparent) 50%, color-mix(in srgb, var(--glow) 25%, transparent) 75%, transparent);
    -webkit-mask: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); mask: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); filter: blur(calc(3 * var(--u))); }
  .fx.pole.on i { background: color-mix(in srgb, var(--glow) 55%, var(--ink)); box-shadow: 0 0 calc(5 * var(--u)) var(--glow); }
  @media (prefers-reduced-motion: reduce) { .fx *, .fx::before, .fx .bulb { transition: none; } }
`;
