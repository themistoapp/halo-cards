import { css } from "lit";
import { shadowStyles } from "../../shared/bloom";

export const styles = [shadowStyles, css`
  :host { display: block; height: 100%; }
  ha-card {
    --surface: var(--ha-card-background, var(--card-background-color, #fff));
    --ink: var(--primary-text-color, #1b1b1f);
    --ink-2: var(--secondary-text-color, #5c5c66);
    --line: var(--divider-color, rgba(0,0,0,.12));
    --sunken: color-mix(in srgb, var(--ink) 9%, transparent);
    --action: var(--ink);
    --action-ink: var(--surface);
    --press: 0 1px 2px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.14);
    --s0:#f2c14e; --s1:#f7dc93; --sa:#f47fa4;
    --b0:#6fcf9a; --b1:#a9e5c3; --ba:#2fc4b8;
    --r0:#aeb3bf; --r1:#d3d6dd;
    display: block; position: relative; height: 100%; box-sizing: border-box; overflow: hidden;
    color: var(--ink); font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
  }
  ha-card.dark {
    --sunken: color-mix(in srgb, var(--ink) 14%, transparent);
    --press: 0 1px 2px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.4);
    --s0:#8a6a10; --s1:#5a4710; --sa:#a8325f;
    --b0:#1f7a52; --b1:#1a5239; --ba:#0f6f78;
    --r0:#5a606e; --r1:#3d424d;
  }

  /* Background: one bloom per source, sized by its share of supply, random start, grows in. */
  @keyframes bloom-in { from { --is: 0; --ib: 0; --ig: 0; } }
  .bg {
    position: absolute; inset: 0;
    --is: var(--ts); --ib: var(--tb); --ig: var(--tg);
    transition: --is .9s ease, --ib .9s ease, --ig .9s ease;
    animation: bloom-in 2.4s cubic-bezier(.22,.7,.2,1) backwards;
    background:
      radial-gradient(circle farthest-corner at var(--sx) var(--sy), var(--sa) 0%, transparent calc(var(--is) * 38%)),
      radial-gradient(circle farthest-corner at var(--bx) var(--by), var(--ba) 0%, transparent calc(var(--ib) * 38%)),
      radial-gradient(circle farthest-corner at var(--sx) var(--sy), var(--s0) 0%, var(--s1) calc(var(--is) * 38%), transparent calc(var(--is) * 75%)),
      radial-gradient(circle farthest-corner at var(--bx) var(--by), var(--b0) 0%, var(--b1) calc(var(--ib) * 38%), transparent calc(var(--ib) * 75%)),
      radial-gradient(circle farthest-corner at var(--gx) var(--gy), var(--r0) 0%, var(--r1) calc(var(--ig) * 38%), transparent calc(var(--ig) * 75%)),
      var(--surface);
  }
  .grain {
    position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .35;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  .inner { position: relative; z-index: 1; height: 100%; box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 16px; line-height: 22px; font-weight: 500; }
  .chip { padding: 3px 10px; border-radius: 99px; font-size: 11px; line-height: 16px; background: color-mix(in srgb, var(--surface) 72%, transparent); border: 1px solid var(--line); white-space: nowrap; }

  /* Hero: product image with a glowing LED strip filled to the battery level. */
  .hero { position: relative; flex: 0 1 220px; min-height: 0; display: flex; justify-content: center; container-type: size; }
  @container (max-height: 69px) { .halo, .stream { display: none; } }
  .halo { position: absolute; inset: 10% 20%; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--b0) 22%, transparent), transparent 70%); }
  .stream { position: relative; height: 100%; aspect-ratio: 332 / 480; filter: drop-shadow(0 10px 18px color-mix(in srgb, var(--ink) 28%, transparent)); }
  .stream img { width: 100%; height: 100%; display: block; object-fit: contain; }
  .lb { position: absolute; left: 50.9%; top: 42.1%; height: 47.5%; width: max(2px, 1.8%); transform: translateX(-50%); border-radius: 99px; background: rgba(255,255,255,.14); }
  .lb > i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 99px; background: #3ee08a; box-shadow: 0 0 4px 1px #3ee08a, 0 0 14px 4px color-mix(in srgb, #3ee08a 55%, transparent); transition: height .6s ease; }

  /* Tiles */
  .tiles { flex: 1 0 0; min-height: var(--tmin, 0px); display: grid; gap: 8px; }
  .tile {
    --g0:#f2c14e; --a0:#f47fa4; --ln:#b97d00; --px: 14px; --py: 14px;
    position: relative; overflow: hidden; box-sizing: border-box; min-width: 0;
    border-radius: 14px; border: 1px solid var(--line); padding: var(--py) var(--px);
    display: flex; flex-direction: column; justify-content: flex-start; gap: 6px;
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  }
  .dark .tile { background: color-mix(in srgb, var(--surface) 72%, transparent); --g0:#8a6a10; --a0:#a8325f; --ln:#f2c14e; }
  .tile.battery { --g0:#6fcf9a; --a0:#2fc4b8; --ln:#2f6b4a; }
  .tile.grid { --g0:#f08a4b; --a0:#2f7bff; --ln:#c2570f; }
  .tile.house { --g0:#aeb3bf; --a0:#aeb3bf; --ln:#666670; }
  .dark .tile.battery { --g0:#1f7a52; --a0:#0f6f78; --ln:#6fcf9a; }
  .dark .tile.grid { --g0:#b5561d; --a0:#2457d6; --ln:#f4a36a; }
  .dark .tile.house { --g0:#5a606e; --a0:#5a606e; --ln:#b0b4bf; }
  .tap { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .tile.tap:focus-visible, .lb:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
  .tile.span { grid-column: 1 / -1; }
  .top { display: flex; align-items: center; gap: 8px; }
  .ico { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex: none; background: color-mix(in srgb, var(--surface) 72%, transparent); }
  .ico svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .label { font-size: 13px; line-height: 18px; font-weight: 500; }
  .fig { font-size: 38px; line-height: 1; font-weight: 400; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .unit { font-size: 14px; letter-spacing: 0; margin-left: 3px; }
  .det { font-size: 12px; line-height: 16px; margin-top: 2px; }
  /* The graph only ever takes the space left under the text (never behind it), and disappears if that is too little. */
  .gw { flex: 1 1 0; min-height: 0; margin: 0 calc(var(--px) * -1) calc(var(--py) * -1); position: relative; container-type: size; }
  .gw svg.graph { position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: 50% 100%; animation: rise 1.2s cubic-bezier(.22,.7,.2,1) backwards; }
  @container (max-height: 19px) { .gw svg.graph { display: none; } }
  svg.graph .ln { fill: none; stroke: var(--ln); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  @keyframes rise { from { transform: scaleY(0); opacity: 0; } }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; font-size: 13px; color: var(--ink-2); padding: 0 24px; }

  /* Controls: reserve slider and mode pill */
  .ctl { flex: none; height: 72px; box-sizing: border-box; display: flex; align-items: center; gap: 16px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 80%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
  .dark .ctl { background: color-mix(in srgb, var(--surface) 72%, transparent); }
  .rsv { flex: 1; min-width: 0; }
  .rsv .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 500; }
  .rsv .row span:last-child { font-variant-numeric: tabular-nums; }
  input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 20px; margin: 4px 0 0; background: transparent; cursor: pointer; --p: 0%; }
  input[type=range]::-webkit-slider-runnable-track { height: 8px; border-radius: 4px; background: linear-gradient(to right, var(--action) var(--p), var(--sunken) var(--p)); }
  input[type=range]::-moz-range-track { height: 8px; border-radius: 4px; background: var(--sunken); }
  input[type=range]::-moz-range-progress { height: 8px; border-radius: 4px; background: var(--action); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -6px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--press); }
  input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--press); }
  input[type=range]:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 4px; }

  .seg { position: relative; display: flex; flex: none; padding: 3px; border-radius: 99px; background: var(--sunken); border: 1px solid var(--line); margin-left: auto; }
  .seg button { position: relative; z-index: 1; border: 0; background: none; font-family: inherit; font-size: 13px; line-height: 18px; font-weight: 500; padding: 6px 0; cursor: pointer; color: var(--ink-2); transition: color .2s; }
  .seg button.ms { width: 108px; }
  .seg button.ma { width: 44px; }
  .seg button[aria-checked=true] { color: var(--action-ink); }
  .seg .th { position: absolute; top: 3px; bottom: 3px; left: 3px; width: 108px; border-radius: 99px; background: var(--action); box-shadow: var(--press); transition: left .28s cubic-bezier(.3,.8,.3,1), width .28s cubic-bezier(.3,.8,.3,1); }
  .seg.ai .th { left: 111px; width: 44px; }
  .seg.none .th { display: none; }
  .seg button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 99px; }

  /* Shorter slots: tighten everything (the picture has already given up its free space). */
  .regular { --tmin: 252px; }
  .tight { --tmin: 200px; }
  .regular .inner, .tight .inner { padding: 14px; gap: 10px; }
  .regular .tile, .tight .tile { --px: 12px; --py: 10px; gap: 3px; }
  .regular .ico, .tight .ico { width: 26px; height: 26px; }
  .regular .ico svg, .tight .ico svg { width: 15px; height: 15px; }
  .regular .fig, .tight .fig { font-size: 30px; }
  .regular .unit, .tight .unit { font-size: 12px; }
  .regular .det, .tight .det { font-size: 11px; line-height: 14px; margin-top: 0; }
  .regular .ctl, .tight .ctl { height: 56px; padding: 8px 12px; }
  .regular .rsv input, .tight .rsv input { margin-top: 0; }

  @media (prefers-reduced-motion: reduce) {
    .bg, svg.graph { animation: none; }
    .bg, .lb > i, .seg .th, .seg button { transition: none; }
  }
`];
