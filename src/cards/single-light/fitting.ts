import { css, html, nothing } from "lit";
import { FIXTURES } from "../light/fixtures";
import type { Fitting } from "./logic";
import { LANTERN, PATH } from "./pictures";

/** Each picture, and where its light comes out: centre x / y, width, height, in % of the picture. */
export const PICTURES: Record<Exclude<Fitting, "none">, { src: string; ratio: number; lit: [number, number, number, number] }> = {
  downlight: { src: FIXTURES.downlight.src, ratio: FIXTURES.downlight.ratio, lit: [49.7, 44.5, 55, 42] },
  pendant: { src: FIXTURES.pendant.src, ratio: FIXTURES.pendant.ratio, lit: [50, 88, 86, 15] },
  lantern: { src: LANTERN.src, ratio: LANTERN.ratio, lit: [50, 50, 82, 86] },
  path: { src: PATH.src, ratio: PATH.ratio, lit: [50, 74, 62, 44] },
};

/** The fitting with its opening lit in CSS: --glow is the colour, --i the strength (0 off). Its height comes from --fh. */
export function fitting(kind: Fitting | undefined) {
  if (!kind || kind === "none" || !PICTURES[kind]) return nothing;
  const p = PICTURES[kind], [x, y, w, h] = p.lit;
  return html`<span class="fx ${kind}" style="--ar:${p.ratio.toFixed(3)};--lx:${x}%;--ly:${y}%;--lw:${w}%;--lh:${h}%">
    <span class="halo"></span><img src=${p.src} alt="" /><span class="lit"></span></span>`;
}

export const fittingStyles = css`
  .fx { position: relative; display: block; flex: none; height: var(--fh, 92px); aspect-ratio: var(--ar); pointer-events: none; }
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
  @media (prefers-reduced-motion: reduce) { .fx .halo, .fx .lit { transition: none; } }
`;
