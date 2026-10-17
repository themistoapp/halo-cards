import { css, unsafeCSS } from "lit";
import { gradientStyles } from "../../shared/looks";

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/** Home Assistant's badge: a 36px pill with the icon on the left, a small name over the value. In the Entity card's looks. */
export const badgeStyles = [gradientStyles, css`
  :host { display: inline-block; vertical-align: top; }
  .hb {
    --surface: var(--ha-card-background, var(--card-background-color, #fff));
    --ink: var(--primary-text-color, #1b1b1f); --ink-2: var(--secondary-text-color, #5c5c66);
    --line: var(--ha-card-border-color, var(--divider-color, rgba(0,0,0,.12)));
    --well: color-mix(in srgb, var(--ink) 9%, transparent);
    --raise: 0 1px 2px rgba(20,20,40,.16), 0 3px 8px rgba(20,20,40,.08);
    --pressed: inset 0 1.5px 3px rgba(0,0,0,.28), inset 0 -1px 0 rgba(255,255,255,.6);
    position: relative; isolation: isolate; overflow: hidden; box-sizing: border-box;
    height: var(--ha-badge-size, 36px); min-width: var(--ha-badge-size, 36px); border-radius: var(--ha-badge-border-radius, 18px);
    display: inline-flex; align-items: center; gap: 8px; padding: 0 14px 0 3px;
    background: var(--surface); color: var(--ink); border: var(--ha-card-border-width, 1px) solid var(--line);
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); cursor: pointer; user-select: none; -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent; transition: box-shadow .3s, background .3s, transform .12s;
  }
  .hb.dark { --well: color-mix(in srgb, var(--ink) 14%, transparent); --raise: 0 1px 2px rgba(0,0,0,.6), 0 3px 10px rgba(0,0,0,.4);
    --pressed: inset 0 1.5px 4px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.06); }
  .hb.shadow { box-shadow: var(--raise); }
  .hb:active { transform: scale(.97); }
  .hb:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .hb.icon-only { padding: 0; width: var(--ha-badge-size, 36px); justify-content: center; }
  .hb.unavailable .tx, .hb.unavailable .ic { opacity: .5; }

  .ic { position: relative; width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--well); color: var(--ink); transition: background .3s, color .3s; }
  .ic svg.g { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .ic ha-icon, .ic ha-state-icon { --mdc-icon-size: 16px; display: inline-flex; }
  .ic.ring { background: transparent; }
  .ic.ring > svg.r { position: absolute; inset: 0; width: 28px; height: 28px; overflow: visible; }
  .ic.ring ha-icon, .ic.ring ha-state-icon { --mdc-icon-size: 13px; }
  .r .trk { fill: none; stroke: color-mix(in srgb, var(--ink) 14%, transparent); stroke-width: 2.6; stroke-linecap: round; }
  .r .fil { fill: none; stroke-width: 2.6; stroke-linecap: round; transition: stroke-dasharray .8s cubic-bezier(.22,.7,.2,1), stroke .6s; }
  .r text, .dial text { font-weight: 600; letter-spacing: -.04em; fill: var(--ink); font-variant-numeric: tabular-nums; font-family: inherit; }

  .tx { display: grid; line-height: 1; gap: 2px; min-width: 0; }
  .nm { font: 500 9px/11px var(--code-font-family, ui-monospace, monospace); letter-spacing: .07em; text-transform: uppercase; color: var(--ink-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
  .tx.only .nm { font-size: 10px; }
  .st { font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .st small { font-size: 11px; font-weight: 500; color: var(--ink-2); margin-left: 2px; letter-spacing: 0; }

  /* Fixed looks, as on the Entity card. */
  .hb.t-light { --surface: #fff; --ink: #1b1b1f; --ink-2: #5c5c66; --line: rgba(0,0,0,.08); --well: #f0f0f3; }
  .hb.t-dark { --surface: #141416; --ink: #f4f4f6; --ink-2: rgba(255,255,255,.66); --line: rgba(255,255,255,.1); --well: rgba(255,255,255,.12); }
  .hb.grad { --ink: #fff; --ink-2: rgba(255,255,255,.86); --line: transparent; --well: rgba(255,255,255,.24); background: var(--g); }
  .hb.grad::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: overlay; opacity: .55; background-image: ${unsafeCSS(GRAIN)}; }
  .hb.grad.dark::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: rgba(0,0,0,.34); }
  .hb.grad .r .trk { stroke: rgba(255,255,255,.32); }

  /* The thermostat's bloom: the compact card's ellipse from below the bottom edge. */
  @keyframes rise-in { from { --bw: 0; --bh: 0; } }
  .bloom { position: absolute; inset: 0; z-index: -1; pointer-events: none;
    transition: --bw 1.8s cubic-bezier(.22,.7,.2,1), --bh 1.8s cubic-bezier(.22,.7,.2,1), --c0 .9s ease, --c1 .9s ease;
    animation: rise-in 2.4s cubic-bezier(.22,.7,.2,1) backwards;
    background: radial-gradient(ellipse calc(var(--bw) * 1%) calc(var(--bh) * 1%) at 50% 114%, var(--c0) 0%, var(--c1) 38%, transparent 75%); }

  /* Mini thermostat dial: ticks round 270°, a thicker tick at the room temperature, the figure in the middle. */
  .hb.th { padding-left: 1px; }
  .ic.dial { width: 32px; height: 32px; background: transparent; }
  .ic.dial svg { position: absolute; inset: 0; width: 32px; height: 32px; overflow: visible; }
  .dial .tk { stroke: var(--ink); opacity: .22; stroke-width: 1.1; stroke-linecap: round; }
  .dial .tk.lit { stroke: var(--tone, var(--ink-2)); opacity: 1; }
  .dial .tk.band { stroke: var(--ink); opacity: .5; }
  .dial .cur { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; }
  .dial .tgt { stroke: var(--tone, var(--ink-2)); stroke-width: 2.2; stroke-linecap: round; }
  .dial .lo { stroke: #e8742f; stroke-width: 2.2; stroke-linecap: round; } .dial .hi { stroke: #2f86cf; stroke-width: 2.2; stroke-linecap: round; }
  .dark .dial .lo { stroke: #ff9a5c; } .dark .dial .hi { stroke: #6cc3ec; }
  .grad .dial .tk.lit, .grad .dial .tgt, .grad .dial .lo, .grad .dial .hi { stroke: #fff; }

  /* Weather icons in the weather card's colours. */
  .ic .sun, .ic .pc { color: #c98a0e; } .ic .moon, .ic .pcn { color: #4a58c4; } .ic .rain, .ic .pour, .ic .snow, .ic .drop { color: #2f86cf; }
  .dark .ic .sun, .dark .ic .pc { color: #f2b84a; } .dark .ic .moon, .dark .ic .pcn { color: #a9b4ff; } .dark .ic .rain, .dark .ic .pour, .dark .ic .snow, .dark .ic .drop { color: #6cc3ec; }
  .grad .ic svg { color: #fff !important; }
  .ic svg.ic { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }

  /* On/off: off stands proud; on is pressed in, like the compact thermostat's heat button. */
  .hb.bool .ic { background: transparent; color: var(--ink-2); }
  .hb.bool.off .st { color: var(--ink-2); }
  .hb.bool.on { box-shadow: var(--pressed); border-color: transparent; background: var(--on-bg, color-mix(in srgb, var(--ink) 8%, var(--surface))); }
  .hb.bool.on .ic { background: var(--on-ic-bg, var(--well)); color: var(--on-ic, var(--ink)); }
  .hb.bool.on.grad { background: var(--g); }
  .hb.bool.on.grad .ic { background: rgba(255,255,255,.9); color: #1b1b1f; }

  @media (prefers-reduced-motion: reduce) { .hb, .bloom, .r .fil { transition: none; } .bloom { animation: none; } }
`];
