import { css } from "lit";

export const styles = css`
  ha-card {
    --box: color-mix(in srgb, var(--ink) 4.5%, var(--surface));
    --rain: #2f86cf; --sun: #c98a0e; --moon: #4a58c4; --good: #1f9d63; --fuel: #8a8f9b; --low: #c2362b;
    height: auto; min-height: 100%; background: var(--surface); border-radius: var(--ha-card-border-radius, 18px); isolation: isolate;
  }
  ha-card.dark { --box: color-mix(in srgb, var(--ink) 7%, var(--surface)); --rain: #6cc3ec; --sun: #f2b84a; --moon: #a9b4ff; --good: #4cc9a0; --fuel: #a6abb6; --low: #ff7b72; }
  .bg { position: absolute; inset: 0; z-index: -2; pointer-events: none;
    background: radial-gradient(ellipse 90% 170px at 0% -40px, var(--c0) 0%, var(--c1) 45%, transparent 100%), var(--surface); }
  .grain { position: absolute; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: overlay; opacity: .3;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
  .ic { flex: none; display: block; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; color: var(--ink-2); }
  .ic.sun, .ic.pc { color: var(--sun); } .ic.moon, .ic.pcn { color: var(--moon); } .ic.rain, .ic.pour, .ic.snow { color: var(--rain); }

  /* Title */
  .ttl { padding: 16px 16px 12px; }
  .ttl h2 { margin: 5px 0 0; font-size: 24px; line-height: 28px; font-weight: 600; letter-spacing: -.03em; text-wrap: balance; cursor: pointer; transition: opacity .25s; }
  .ttl h2.swap { opacity: 0; }
  .ttl.date { display: flex; align-items: center; gap: 14px; }
  .ttl .num { font-size: 60px; line-height: 52px; font-weight: 600; letter-spacing: -.06em; font-variant-numeric: tabular-nums; flex: none; }
  .ttl.date .tx { min-width: 0; }
  .ttl.date h3 { margin: 0; font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -.02em; }
  .ttl.date p { margin: 2px 0 0; font-size: 13px; line-height: 18px; color: var(--ink-2); cursor: pointer; transition: opacity .25s; }
  .ttl.date p.swap { opacity: 0; }
  .ttl.none { padding: 6px; }

  /* Boxes: flat. Something to act on gets a thin ring in its colour and a pill. */
  .grid { display: grid; gap: 8px; padding: 0 10px 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .w .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: dense; gap: 10px; padding: 0 14px 14px; }
  .w .ttl { padding: 20px 22px 14px; }
  .w .ttl h2 { font-size: 32px; line-height: 36px; }
  .bx { position: relative; overflow: hidden; box-sizing: border-box; border-radius: 14px; background: var(--box); padding: 10px 12px 11px; min-width: 0; display: flex; flex-direction: column; gap: 4px; text-align: left;
    border: 0; color: inherit; font: inherit; -webkit-tap-highlight-color: transparent; }
  button.bx { cursor: pointer; }
  button.bx:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
  .bx.hot { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--t) 70%, transparent); }
  .bx.full { grid-column: span 2; }
  .bx.tall { min-height: 166px; }
  .bx.mid { min-height: 132px; }
  .hd { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 18px; }
  .hd .lab { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fill { flex: 1; }
  .big { font-size: 26px; line-height: 28px; font-weight: 600; letter-spacing: -.04em; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .big small { font-size: 12px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 3px; }
  .sub { font-size: 12px; line-height: 16px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill { flex: none; font: 600 10px/14px var(--code-font-family, ui-monospace, monospace); padding: 2px 7px; border-radius: 99px; background: var(--action); color: var(--action-ink); white-space: nowrap; text-transform: uppercase; letter-spacing: .04em; }
  .pill.soft { background: var(--surface); color: var(--ink); border: 1px solid var(--line); font-weight: 500; }

  /* Calendar */
  .evs { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .w .evs { gap: 12px; margin-top: 10px; }
  .e { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .e .cb { width: 4px; align-self: stretch; border-radius: 99px; background: var(--c); flex: none; }
  .e .tm { width: 42px; flex: none; font: 600 13px/18px var(--code-font-family, ui-monospace, monospace); font-variant-numeric: tabular-nums; }
  .e .tm span { display: block; font-weight: 500; color: var(--ink-2); font-size: 10.5px; line-height: 13px; }
  .e .bd { flex: 1; min-width: 0; }
  .e .tt { font-size: 15px; line-height: 19px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .e .mt { font-size: 12px; line-height: 15px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prog { height: 3px; border-radius: 99px; background: color-mix(in srgb, var(--ink) 12%, transparent); margin-top: 5px; overflow: hidden; }
  .prog i { display: block; height: 100%; border-radius: 99px; background: var(--c, var(--ink)); }
  .more { font-size: 12px; line-height: 16px; color: var(--ink-2); margin-top: auto; padding-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Weather */
  .wnow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .wnow .big { font-size: 28px; }
  .wnow .cond { min-width: 0; font-size: 13px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wnow .cond span { display: block; color: var(--ink-2); font: 500 10.5px/14px var(--code-font-family, ui-monospace, monospace); }
  .hrs { display: grid; grid-template-columns: repeat(var(--n, 8), minmax(0, 1fr)); margin-top: auto; padding-top: 6px; }
  .hr { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
  .hr .t { font: 500 10px/12px var(--code-font-family, ui-monospace, monospace); color: var(--ink-2); }
  .hr .t.now { color: var(--ink); font-weight: 700; }
  .hr .v { font-size: 13px; line-height: 16px; font-weight: 600; }
  .hr .rb { width: 14px; height: 14px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--line); }
  .hr .rb i { display: block; width: 10px; border-radius: 2px 2px 0 0; background: var(--rain); opacity: .8; }
  .hr .p { font: 500 9px/11px var(--code-font-family, ui-monospace, monospace); color: var(--rain); min-height: 11px; white-space: nowrap; }

  /* Vehicles */
  .veh img { display: block; height: 46px; width: auto; max-width: 100%; margin: 2px auto 0; object-fit: contain; }
  .veh .row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
  .veh .big { font-size: 22px; line-height: 24px; }
  .veh.full { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto 1fr auto auto; column-gap: 14px; }
  .veh.full .hd { grid-column: 1 / -1; } .veh.full img { grid-column: 1; grid-row: 2 / 5; align-self: center; height: 58px; }
  .veh.full .fill { display: none; } .veh.full .row { grid-column: 2; grid-row: 3; } .veh.full .stripe { grid-column: 2; grid-row: 4; }
  .stripe { height: 6px; border-radius: 99px; background: var(--sunken); overflow: hidden; margin-top: 3px; }
  .stripe i { display: block; height: 100%; border-radius: 99px; --c: var(--low); background: repeating-linear-gradient(135deg, var(--c) 0 1.5px, color-mix(in srgb, var(--c) 20%, transparent) 1.5px 5px); }

  /* Bins: one row per bin, countdown on the right */
  .brow { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 7px 0; }
  .brow + .brow { border-top: 1px solid var(--line); }
  .brow svg { width: 26px; height: 26px; flex: none; display: block; }
  .brow .nm { flex: 1; min-width: 0; }
  .brow .nm b { display: block; font-size: 13.5px; line-height: 17px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brow .nm span { display: block; font: 500 10.5px/13px var(--code-font-family, ui-monospace, monospace); color: var(--ink-2); white-space: nowrap; }
  .brow .nm span.out { color: var(--ink); font-weight: 700; }
  .brow .cd { text-align: right; flex: none; }
  .brow .cd .big { font-size: 22px; line-height: 22px; display: block; }
  .brow .cd .big.word { font-size: 15px; letter-spacing: -.01em; }
  .brow .cd .u { font: 500 10px/12px var(--code-font-family, ui-monospace, monospace); color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; }
  .brow.later { opacity: .55; }

  /* Cheapest Agile slots */
  .slots { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; }
  .slot { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-variant-numeric: tabular-nums; }
  .slot + .slot { border-top: 1px solid var(--line); }
  .slot .tm { font: 600 12.5px/16px var(--code-font-family, ui-monospace, monospace); flex: 1; white-space: nowrap; overflow: hidden; }
  .slot .tm span { color: var(--ink-2); font-weight: 500; }
  .slot .pr { font-size: 14px; line-height: 16px; font-weight: 600; color: var(--good); white-space: nowrap; }
  .slot .pill { font-size: 9px; padding: 1px 5px; }
  /* Half width: just the start time, so the pill and price fit. */
  .bx:not(.full) .slot .tm span { display: none; }
  .dayb { display: flex; align-items: flex-end; gap: 1px; height: 18px; margin-top: auto; padding-top: 4px; }
  .dayb i { flex: 1; min-width: 0; border-radius: 1px; background: color-mix(in srgb, var(--ink) 13%, transparent); }
  .dayb i.pick { background: var(--good); }

  /* Now playing: one slim row */
  .np { flex-direction: row; align-items: center; gap: 10px; padding: 8px; }
  .np .art { width: 44px; height: 44px; border-radius: 8px; flex: none; background: var(--sunken) center / cover no-repeat; box-shadow: 0 2px 6px rgba(0,0,0,.18); }
  .np .meta { flex: 1; min-width: 0; cursor: pointer; }
  .np .meta b { display: block; font-size: 14px; line-height: 18px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np .meta span { display: block; font-size: 12px; line-height: 15px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np .prog i { background: var(--ink); opacity: .6; }
  .np .pp { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--action); color: var(--action-ink); display: grid; place-items: center; cursor: pointer; box-shadow: var(--press); }
  .np .pp svg { width: 16px; height: 16px; fill: currentColor; }

  .empty { padding: 4px 16px 18px; font-size: 13px; color: var(--ink-2); }
  @media (prefers-reduced-motion: reduce) { .ttl h2 { transition: none; } }
`;
