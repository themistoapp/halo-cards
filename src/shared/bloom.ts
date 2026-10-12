import { css } from "lit";

// Registered at document level so the bloom can grow in and colours can fade (shadow-root @property is ignored).
let done = false;
export function registerBloomProps() {
  if (done || typeof CSS === "undefined" || !CSS.registerProperty) return;
  done = true;
  const reg = (name: string, syntax: string, initialValue: string) => { try { CSS.registerProperty({ name, syntax, inherits: true, initialValue }); } catch { /* already registered */ } };
  reg("--k", "<number>", "0"); reg("--k2", "<number>", "0");
  reg("--c0", "<color>", "#aeb3bf"); reg("--c1", "<color>", "#d3d6dd"); reg("--ca", "<color>", "#aeb3bf");
}

/** Random start point on one of the four edges, slightly outside it. */
export function randomOrigin(rand: () => number = Math.random): [string, string] {
  const side = Math.floor(rand() * 4), along = 8 + rand() * 84, out = -6 + rand() * 12;
  const [x, y] = side === 0 ? [along, out] : side === 1 ? [100 - out, along] : side === 2 ? [along, 100 - out] : [out, along];
  return [x.toFixed(1) + "%", y.toFixed(1) + "%"];
}

export const GREY_DAY = { c0: "#aeb3bf", c1: "#d3d6dd", ca: "#aeb3bf" };
export const GREY_NIGHT = { c0: "#5a606e", c1: "#3d424d", ca: "#5a606e" };

/** Two-bloom background (--x1 --y1 --x2 --y2 origins, --k --k2 sizes, --c0 --c1 --ca colours) and the film grain. */
export const bloomStyles = css`
  @keyframes bloom-in { from { --k: 0; --k2: 0; } }
  .bg {
    position: absolute; inset: 0;
    transition: --k .9s ease, --k2 .9s ease, --c0 .9s ease, --c1 .9s ease, --ca .9s ease;
    animation: bloom-in 2.4s cubic-bezier(.22,.7,.2,1) backwards;
    background:
      radial-gradient(circle farthest-corner at var(--x2) var(--y2), var(--ca) 0%, transparent calc(var(--k2) * 38%)),
      radial-gradient(circle farthest-corner at var(--x1) var(--y1), var(--c0) 0%, var(--c1) calc(var(--k) * 38%), transparent calc(var(--k) * 75%)),
      var(--surface);
  }
  .grain {
    position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .35;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  @media (prefers-reduced-motion: reduce) { .bg { animation: none; transition: none; } }
`;

/** Theme variables every Halo card uses, taken from the Home Assistant theme. */
export const themeStyles = css`
  :host { display: block; height: 100%; }
  ha-card {
    --surface: var(--ha-card-background, var(--card-background-color, #fff));
    --ink: var(--primary-text-color, #1b1b1f);
    --ink-2: var(--secondary-text-color, #5c5c66);
    --line: var(--divider-color, rgba(0,0,0,.12));
    --sunken: color-mix(in srgb, var(--ink) 9%, transparent);
    --action: var(--ink);
    --action-ink: var(--surface);
    --warn: #b45f06; --bad: #c2362b;
    --press: 0 1px 2px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.14);
    display: block; position: relative; height: 100%; box-sizing: border-box; overflow: hidden;
    color: var(--ink); font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
  }
  ha-card.dark { --sunken: color-mix(in srgb, var(--ink) 14%, transparent); --warn: #f4a36a; --bad: #ff7b72; --press: 0 1px 2px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.4); }
  .inner { position: relative; z-index: 1; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; min-height: 0; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 16px; line-height: 22px; font-weight: 500; }
  .chip { display: inline-flex; align-items: center; gap: 6px; max-width: 170px; padding: 3px 10px; border-radius: 99px; font-size: 11px; line-height: 16px; background: color-mix(in srgb, var(--surface) 72%, transparent); border: 1px solid var(--line); white-space: nowrap; }
  .chip span { overflow: hidden; text-overflow: ellipsis; }
  .chip svg { flex: none; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .chip i { width: 6px; height: 6px; border-radius: 50%; background: #2e9e5b; display: block; flex: none; }
  .chip.off i { background: #9aa0ac; }
  .glass { position: relative; box-sizing: border-box; border-radius: 14px; border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 80%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
  .dark .glass { background: color-mix(in srgb, var(--surface) 72%, transparent); }
  .lab { font-size: 10px; line-height: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); font-family: var(--code-font-family, ui-monospace, monospace); }
  button { font-family: inherit; color: inherit; }
`;

/** Soft drop shadow, stronger at night, on by default (shadow: false leaves the theme's own). */
export const shadowStyles = css`
  ha-card.halo-shadow { box-shadow: 0 14px 36px -4px rgba(20, 20, 40, .22), 0 3px 8px rgba(20, 20, 40, .12); }
  ha-card.halo-shadow.dark { box-shadow: 0 14px 36px -4px rgba(0, 0, 0, .65), 0 3px 8px rgba(0, 0, 0, .45); }
`;
