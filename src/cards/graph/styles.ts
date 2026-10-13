import { css } from "lit";
import { shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, shadowStyles, css`
  ha-card { --good: #1f8a5b; background: var(--surface); }
  ha-card.dark { --good: #4cc9a0; }
  .inner { padding: 14px 16px; gap: 10px; }
  header { min-height: 24px; }

  /* One pill with both days, same as the thermostat's modes. */
  .seg { flex: none; display: flex; padding: 3px; border-radius: 99px; background: var(--sunken); }
  .seg button { flex: 1; border: 0; background: none; padding: 5px 14px; border-radius: 99px; font: inherit; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-2); cursor: pointer; white-space: nowrap; transition: background .2s ease, color .2s ease; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  .stats { display: flex; }
  .stats > div { flex: 1; min-width: 0; }
  .stats .lab { display: flex; align-items: center; gap: 4px; }
  .fi { flex: none; display: inline-flex; width: 12px; height: 12px; --mdc-icon-size: 12px; }
  .fi halo-svg-icon { width: 12px; height: 12px; }
  .big { font-size: 26px; line-height: 30px; font-weight: 600; letter-spacing: -.04em; margin-top: 2px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .big small { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 3px; }
  .stats.tight .lab { font-size: 9px; letter-spacing: .02em; gap: 3px; }
  .stats.tight .big { font-size: 20px; line-height: 24px; }
  .stats.tight .big small { font-size: 11px; margin-left: 1px; }
  .note { font-size: 12px; line-height: 16px; color: var(--ink-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note.good { color: var(--good); }

  .chart { flex: 1; min-height: 0; position: relative; touch-action: pan-y; cursor: crosshair; }
  .chart svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; pointer-events: none; }
  .empty { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 4px; padding: 0 12px; color: var(--ink-2); font-size: 13px; line-height: 18px; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .grid.dash { stroke-dasharray: 2 4; }
  .grid.zero { stroke: var(--ink-2); stroke-opacity: .5; stroke-dasharray: none; }
  .ax { fill: var(--ink-2); opacity: .8; font: 500 10px var(--code-font-family, ui-monospace, monospace); }
  .line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
  .edge { fill: none; stroke-width: 1.6; stroke-linejoin: round; }
  rect.bar.sel { stroke: var(--ink); stroke-width: 1.5; }
  .nowline { stroke: var(--ink); stroke-opacity: .28; stroke-dasharray: 3 3; }
  .hovline { stroke: var(--ink); stroke-opacity: .4; }
  .dot { stroke: var(--surface); stroke-width: 2; }
  /* Empty at rest; the row stays so the card doesn't jump when it fills. */
  .readout { display: flex; justify-content: center; gap: 10px; font: 500 12px/16px var(--code-font-family, ui-monospace, monospace); letter-spacing: .02em; color: var(--ink-2); height: 16px; white-space: nowrap; overflow: hidden; }
  .readout i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }

  /* Compact */
  .c { flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; }
  .c .l { flex: 1; min-width: 0; }
  .c .lab { display: flex; align-items: center; gap: 4px; }
  .c .big { font-size: 40px; line-height: 44px; margin-top: 2px; letter-spacing: -.045em; }
  .c .big small { font-size: 14px; line-height: 20px; margin-left: 4px; }
  .c .note { font-size: 13px; line-height: 18px; }
  .c .r { flex: none; width: 46%; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: stretch; justify-content: center; }
  .c .seg { padding: 2px; } .c .seg button { font-size: 11px; line-height: 14px; padding: 3px 9px; }
  .c .chart { flex: 1; min-height: 0; width: 100%; cursor: default; }
  @media (prefers-reduced-motion: reduce) { .seg button { transition: none; } }
`];
