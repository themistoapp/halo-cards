import { css, html, nothing } from "lit";
import { FIXTURES } from "../light/fixtures";
import type { Fitting } from "./logic";
import { BAR, BLOOM, CHANDELIER, FAIRY, GEM, LANTERN, PATH, STRING } from "./pictures";

type Spot = [number, number, number, number];
/** Each picture, and where its light comes out: centre x / y, width, height, in % of the picture (one spot per bulb or shade). */
export const PICTURES: Record<Exclude<Fitting, "none">, { src: string; ratio: number; lit: Spot[] }> = {
  downlight: { src: FIXTURES.downlight.src, ratio: FIXTURES.downlight.ratio, lit: [[49.7, 44.5, 55, 42]] },
  pendant: { src: FIXTURES.pendant.src, ratio: FIXTURES.pendant.ratio, lit: [[50, 88, 86, 15]] },
  lantern: { src: LANTERN.src, ratio: LANTERN.ratio, lit: [[50, 50, 82, 86]] },
  path: { src: PATH.src, ratio: PATH.ratio, lit: [[50, 74, 62, 44]] },
  bar: { src: BAR.src, ratio: BAR.ratio, lit: [[45.7, 47.3, 12, 92.5]] },
  bloom: { src: BLOOM.src, ratio: BLOOM.ratio, lit: [[54.5, 46, 98, 59.5]] },
  gem: { src: GEM.src, ratio: GEM.ratio, lit: [[50, 73, 98, 54]] },
  chandelier: { src: CHANDELIER.src, ratio: CHANDELIER.ratio, lit: [[31, 71, 22, 22], [69, 71, 22, 22], [12.6, 64.7, 24, 24], [87.4, 64.7, 24, 24], [50, 61, 27, 25]] },
  fairy: { src: FAIRY.src, ratio: FAIRY.ratio, lit: [[56.4, 2.7, 7.8, 5.5], [16.6, 12.3, 7.5, 6.8], [86.6, 17.1, 6.2, 7.5], [8.3, 31.1, 5.9, 7.5], [90.6, 44, 5, 7.5], [42, 46.6, 7.8, 5.1], [78.6, 55.6, 7.8, 5.5],
    [36.1, 61.8, 7.2, 4.8], [5.8, 68.6, 7.2, 6.1], [96.9, 72.4, 5.6, 7.5], [7, 84, 7.2, 6.8], [87.7, 90.6, 7.2, 5.8], [47.8, 97.4, 8.1, 5.1]] },
  string: { src: STRING.src, ratio: STRING.ratio, lit: [[58.8, 4.9, 6.9, 9.8], [26.1, 17, 7.8, 8.8], [95.3, 22.6, 8.1, 7.4], [46.6, 38.9, 5.6, 8.4], [14.2, 40.7, 7.8, 7.7], [81.7, 44.9, 7.8, 6.3], [51.7, 53.9, 6.6, 8.8],
    [96.2, 57.2, 6.9, 8.4], [19.7, 66.8, 6.9, 8.8], [3.9, 70.4, 7.2, 8.1], [85.9, 77.2, 6.2, 8.4], [40.8, 88.4, 7.8, 8.4], [83.3, 95.6, 7.2, 8.1]] },
};

/** The fitting with its opening lit in CSS: --glow is the colour, --i the strength (0 off). Its height comes from --fh. */
export function fitting(kind: Fitting | undefined) {
  if (!kind || kind === "none" || !PICTURES[kind]) return nothing;
  const p = PICTURES[kind];
  return html`<span class="fx ${kind}" style="--ar:${p.ratio.toFixed(3)}">
    <span class="halo"></span><img src=${p.src} alt="" />${p.lit.map(([x, y, w, h]) => html`<span class="lit" style="--lx:${x}%;--ly:${y}%;--lw:${w}%;--lh:${h}%"></span>`)}</span>`;
}

export const fittingStyles = css`
  /* Width and height are both set outright (no aspect-ratio), so the picture and its lit opening line up the same in every browser. */
  .fx { position: relative; display: block; flex: none; box-sizing: content-box; height: var(--fh, 92px); width: calc(var(--fh, 92px) * var(--ar)); pointer-events: none; }
  .fx img { position: relative; z-index: 1; display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 6px 10px rgba(0,0,0,.22)); }
  .dark .fx img { filter: drop-shadow(0 6px 12px rgba(0,0,0,.5)) brightness(.9); }
  /* The halo is light thrown on the wall or ceiling; the lit opening sits on top of the picture. */
  .fx .halo, .fx .lit { position: absolute; opacity: var(--i, 0); transition: opacity .5s ease, background .5s ease, box-shadow .5s ease; }
  .fx .halo { z-index: 0; left: 50%; top: 50%; width: 170%; height: 170%; transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--glow) 55%, transparent), transparent); filter: blur(6px); }
  .fx .lit { z-index: 2; left: var(--lx); top: var(--ly); width: var(--lw); height: var(--lh); transform: translate(-50%, -50%); }
  /* Downlight: the opening glows straight out. */
  .fx.downlight .lit { border-radius: 50%; background: radial-gradient(closest-side, #fff 0%, color-mix(in srgb, var(--glow) 40%, #fff) 35%, var(--glow) 70%, color-mix(in srgb, var(--glow) 40%, transparent) 100%);
    box-shadow: 0 0 calc(var(--fh, 92px) * .2) calc(var(--fh, 92px) * .06) color-mix(in srgb, var(--glow) 80%, transparent); }
  /* Pendant: a bright ring at the bottom opening. */
  .fx.pendant .lit { border-radius: 50%; background: radial-gradient(closest-side, #fff 0%, color-mix(in srgb, var(--glow) 50%, #fff) 45%, var(--glow) 80%, transparent 100%);
    box-shadow: 0 0 calc(var(--fh, 92px) * .08) calc(var(--fh, 92px) * .02) color-mix(in srgb, var(--glow) 85%, transparent); }
  .fx.pendant .halo { top: 86%; width: 150%; height: 60%; }
  /* Wall lantern: the glass fills with light from the bulb (screen keeps the flutes showing). */
  .fx.lantern .lit { border-radius: 10%; mix-blend-mode: screen;
    background: radial-gradient(ellipse 60% 42% at 50% 45%, #fff 0%, color-mix(in srgb, var(--glow) 60%, #fff) 18%, var(--glow) 45%, color-mix(in srgb, var(--glow) 55%, transparent) 80%, color-mix(in srgb, var(--glow) 30%, transparent) 100%); }
  .fx.lantern .halo { width: 230%; height: 150%; }
  /* Path light: the louvres glow. */
  .fx.path .lit { mix-blend-mode: screen; clip-path: polygon(50% 0, 82% 34%, 100% 62%, 92% 100%, 8% 100%, 0 62%, 18% 34%);
    background: linear-gradient(to bottom, color-mix(in srgb, var(--glow) 45%, transparent), var(--glow) 55%, color-mix(in srgb, var(--glow) 70%, #fff)); }
  .fx.path .halo { top: 70%; width: 150%; height: 90%; }
  /* Floor light bar: the diffuser glows top to bottom; the light washes the wall either side. */
  .fx.bar .lit { border-radius: 40% / 3%; mix-blend-mode: screen;
    background: linear-gradient(to right, color-mix(in srgb, var(--glow) 70%, transparent), color-mix(in srgb, var(--glow) 35%, #fff) 45%, var(--glow));
    box-shadow: 0 0 calc(var(--fh, 92px) * .05) calc(var(--fh, 92px) * .01) var(--glow), 0 0 calc(var(--fh, 92px) * .14) calc(var(--fh, 92px) * .02) color-mix(in srgb, var(--glow) 55%, transparent); }
  .fx.bar .halo { top: 45%; width: 700%; height: 95%; }
  /* Bloom: the round face, seen tilted, fills with light. */
  .fx.bloom .lit { border-radius: 50%; mix-blend-mode: screen; transform: translate(-50%, -50%) rotate(44deg);
    background: radial-gradient(closest-side, color-mix(in srgb, var(--glow) 35%, #fff) 0%, var(--glow) 65%, color-mix(in srgb, var(--glow) 70%, transparent) 100%); }
  .fx.bloom .halo { left: 60%; top: 40%; }
  /* Gem: the cut glass lights up from inside. */
  .fx.gem .lit { mix-blend-mode: screen; clip-path: polygon(30% 0, 70% 0, 97% 25%, 100% 45%, 92% 70%, 50% 100%, 8% 70%, 0 45%, 3% 25%);
    background: radial-gradient(ellipse 60% 55% at 50% 40%, color-mix(in srgb, var(--glow) 30%, #fff), var(--glow) 60%, color-mix(in srgb, var(--glow) 65%, transparent)); }
  .fx.gem .halo { top: 70%; width: 260%; height: 100%; }
  /* Chandelier: each shade glows through its fabric (screen keeps the weave showing). */
  .fx.chandelier .lit { border-radius: 6%; mix-blend-mode: screen;
    background: radial-gradient(ellipse 70% 80% at 50% 60%, color-mix(in srgb, var(--glow) 45%, #fff), var(--glow) 70%, color-mix(in srgb, var(--glow) 70%, transparent)); }
  .fx.chandelier .halo { top: 62%; width: 160%; height: 110%; }
  /* Fairy and string lights: every bulb glows. */
  .fx.fairy .lit, .fx.string .lit { border-radius: 50%;
    background: radial-gradient(closest-side, #fff 0%, color-mix(in srgb, var(--glow) 45%, #fff) 40%, var(--glow) 80%, color-mix(in srgb, var(--glow) 40%, transparent) 100%);
    box-shadow: 0 0 calc(var(--fh, 92px) * .06) calc(var(--fh, 92px) * .015) color-mix(in srgb, var(--glow) 85%, transparent); }
  .fx.fairy .halo, .fx.string .halo { width: 140%; height: 140%; }
  @media (prefers-reduced-motion: reduce) { .fx .halo, .fx .lit { transition: none; } }
`;
