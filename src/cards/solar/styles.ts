import { css } from "lit";
import { shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, shadowStyles, css`
  ha-card { --sol: #c28a0c; --good: #1f8a5b; background: var(--surface); }
  ha-card.dark { --sol: #f2b84a; --good: #4cc9a0; }
  .inner { padding: 16px; gap: 12px; }
  header { min-height: 30px; }

  /* One pill with both days, same as the thermostat's modes. */
  .seg { flex: none; display: flex; padding: 3px; border-radius: 99px; background: var(--sunken); }
  .seg button { flex: 1; border: 0; background: none; padding: 7px 14px; border-radius: 99px; font: inherit; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-2); cursor: pointer; white-space: nowrap; transition: background .2s ease, color .2s ease; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  .stats { display: flex; gap: 36px; }
  .stats.wide { gap: 0; }
  .stats.wide > div { flex: 1; min-width: 0; }
  .stats.wide .big { font-size: 28px; line-height: 32px; }
  .stats.wide .big small { font-size: 12px; margin-left: 3px; }
  .big { font-size: 36px; line-height: 38px; font-weight: 600; letter-spacing: -.04em; margin-top: 3px; white-space: nowrap; }
  .big small { font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 4px; }
  .note { font-size: 12px; line-height: 16px; color: var(--ink-2); margin-top: 2px; white-space: nowrap; }
  .note.good { color: var(--good); }

  .chart { flex: 1; min-height: 0; position: relative; }
  .chart svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  .empty { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 4px; padding: 0 12px; color: var(--ink-2); font-size: 13px; line-height: 18px; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .grid.dash { stroke-dasharray: 2 4; }
  .ax { fill: var(--ink-2); opacity: .8; font: 500 10px var(--code-font-family, ui-monospace, monospace); }
  .fa { stroke: var(--sol); stroke-width: 1.6; fill: none; stroke-linejoin: round; }
  .act { stroke: var(--ink); stroke-width: 2.2; fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .nowline { stroke: var(--ink); stroke-opacity: .28; stroke-dasharray: 3 3; }
  .dot { fill: var(--ink); stroke: var(--surface); stroke-width: 2; }

  .legend { display: flex; gap: 16px; font-size: 12px; line-height: 16px; color: var(--ink-2); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { display: block; }
  .sw-f { width: 14px; height: 8px; border-radius: 2px; border-top: 1.5px solid var(--sol); background: linear-gradient(var(--sol), color-mix(in srgb, var(--sol) 25%, transparent)); }
  .sw-a { width: 14px; height: 2.5px; border-radius: 2px; background: var(--ink); }

  /* Compact */
  .c { flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; }
  .c .l { flex: 1; min-width: 0; }
  .c .big { font-size: 40px; line-height: 44px; margin-top: 2px; letter-spacing: -.045em; }
  .c .note { font-size: 13px; line-height: 18px; }
  .c .r { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: stretch; justify-content: center; }
  .c .seg { padding: 2px; } .c .seg button { font-size: 11px; line-height: 14px; padding: 3px 9px; }
  .c .chart { flex: 1; min-height: 0; width: 100%; }
`];
