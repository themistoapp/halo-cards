import { css } from "lit";
import { bloomStyles, shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, shadowStyles, css`
  ha-card { --tone: var(--ink-2); }
  ha-card.heat { --tone: #e8742f; --cur: var(--ink); }
  ha-card.heat.dark { --tone: #ff9a5c; }
  ha-card.cool { --tone: #2f86cf; }
  ha-card.cool.dark { --tone: #6cc3ec; }
  .inner { gap: 6px; padding: 14px 16px 16px; }
  h2 { padding-top: 1px; }

  /* Dial: everything inside one SVG so it scales together. */
  .dialbox { flex: 1; min-height: 0; position: relative; }
  .dialbox svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  .tk { stroke: var(--ink); opacity: .22; stroke-linecap: round; }
  .tk.lit { stroke: var(--tone); opacity: 1; }
  .tk.band { stroke: var(--ink); opacity: .5; }
  .mk-cur { stroke: var(--ink); stroke-linecap: round; }
  .mk-tgt { stroke: var(--tone); stroke-linecap: round; }
  .mk-lo { stroke: #e8742f; stroke-linecap: round; } .mk-hi { stroke: #2f86cf; stroke-linecap: round; }
  .dark .mk-lo { stroke: #ff9a5c; } .dark .mk-hi { stroke: #6cc3ec; }
  .hero { font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); font-weight: 600; letter-spacing: -.045em; fill: var(--ink); }
  .hero.off { fill: var(--ink-2); }
  .sub { font-size: 13px; fill: var(--ink-2); }
  .lim { font: 500 10px var(--code-font-family, ui-monospace, monospace); fill: var(--ink-2); }
  .rb { cursor: pointer; outline: none; }
  .rb circle { fill: var(--surface); stroke: var(--line); stroke-width: 1; }
  .rb path { stroke: var(--ink); stroke-width: 2; stroke-linecap: round; fill: none; }
  .rb:focus-visible circle { stroke: var(--action); stroke-width: 2; }
  .rb[aria-disabled="true"] { opacity: .4; cursor: default; }

  .seg { flex: none; display: flex; gap: 0; padding: 3px; border-radius: 99px; background: var(--sunken); overflow-x: auto; scrollbar-width: none; }
  .seg::-webkit-scrollbar { display: none; }
  .seg button { flex: 1 0 auto; border: 0; background: none; padding: 7px 14px; border-radius: 99px; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-2); cursor: pointer; white-space: nowrap; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  /* Compact bar: target in the middle with - and +, now line, then the tick bar full width. */
  .c.inner { gap: 0; padding: 10px 12px; justify-content: space-between; }
  .c .nm { position: absolute; left: 12px; top: 10px; font: 500 10px/12px var(--code-font-family, ui-monospace, monospace); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); max-width: 28%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c .hr { display: flex; align-items: center; justify-content: center; gap: 18px; height: 44px; }
  .c .hv { font-size: 40px; line-height: 44px; font-weight: 600; letter-spacing: -.045em; min-width: 80px; text-align: center; font-variant-numeric: tabular-nums; }
  .c .hv sup { font-size: 18px; letter-spacing: 0; vertical-align: top; position: relative; top: 4px; }
  .c .hv.off { color: var(--ink-2); }
  .c .nw { text-align: center; font-size: 12px; line-height: 16px; color: var(--ink-2); }
  .c button.rb2 { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); display: grid; place-items: center; padding: 0; cursor: pointer; }
  .c button.rb2:disabled { opacity: .4; cursor: default; }
  .c button.rb2 svg { width: 14px; height: 14px; fill: none; stroke: var(--ink); stroke-width: 1.8; stroke-linecap: round; }
  .bar { position: relative; height: 28px; margin-top: 4px; }
  .bar i { position: absolute; bottom: 0; width: 2px; height: 18px; border-radius: 1px; background: var(--ink); opacity: .2; }
  .bar i.lit { background: var(--tone); opacity: 1; }
  .bar i.band { opacity: .5; }
  .bar i.cur { width: 3px; height: 28px; border-radius: 2px; background: var(--ink); opacity: 1; }
  .bar i.tgt { width: 4px; height: 28px; border-radius: 2px; background: var(--tone); opacity: 1; }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--ink-2); font-size: 13px; }
`];
