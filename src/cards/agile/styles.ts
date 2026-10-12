import { css } from "lit";
import { shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, shadowStyles, css`
  ha-card { --lo: #1f9d63; --mid: #d89a1b; --hi: #d6453d; background: var(--surface); }
  ha-card.dark { --lo: #4cc9a0; --mid: #f2b84a; --hi: #ff7b72; }
  .inner { padding: 16px; gap: 12px; }
  header { min-height: 30px; }

  /* One pill with both days, same as the thermostat's modes. */
  .seg { flex: none; display: flex; padding: 3px; border-radius: 99px; background: var(--sunken); }
  .seg button { flex: 1; border: 0; background: none; padding: 7px 14px; border-radius: 99px; font: inherit; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-2); cursor: pointer; white-space: nowrap; transition: background .2s ease, color .2s ease; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  .stats { display: flex; }
  .stats > div { flex: 1; min-width: 0; }
  .big { font-size: 28px; line-height: 32px; font-weight: 600; letter-spacing: -.04em; margin-top: 3px; white-space: nowrap; }
  .big small { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 3px; }
  .note { font-size: 12px; line-height: 16px; color: var(--ink-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .low { --c: var(--lo); } .mid { --c: var(--mid); } .high { --c: var(--hi); }

  .chart { flex: 1; min-height: 0; position: relative; }
  .chart svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  .empty { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 4px; padding: 0 12px; color: var(--ink-2); font-size: 13px; line-height: 18px; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .grid.dash { stroke-dasharray: 2 4; }
  .grid.zero { stroke: var(--ink-2); stroke-opacity: .5; stroke-dasharray: none; }
  .ax { fill: var(--ink-2); opacity: .8; font: 500 10px var(--code-font-family, ui-monospace, monospace); }
  rect.bar { fill: var(--c); }
  rect.bar.past { opacity: .45; }
  .chart { touch-action: pan-y; cursor: crosshair; }
  .chart svg { pointer-events: none; }
  rect.bar.sel { stroke: var(--ink); stroke-width: 1.5; }
  .readout { text-align: center; font: 500 12px/16px var(--code-font-family, ui-monospace, monospace); letter-spacing: .02em; color: var(--ink-2); height: 16px; white-space: nowrap; }
  rect.bar.now { stroke: var(--ink); stroke-width: 1.5; }
  .nowline { stroke: var(--ink); stroke-opacity: .28; stroke-dasharray: 3 3; }


  /* Compact */
  .c { flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; }
  .c .l { flex: 1; min-width: 0; }
  .c .big { font-size: 40px; line-height: 44px; margin-top: 2px; letter-spacing: -.045em; }
  .c .big small { font-size: 14px; line-height: 20px; margin-left: 4px; }
  .c .note { font-size: 13px; line-height: 18px; }
  .c .r { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: stretch; justify-content: center; }
  .c .seg { padding: 2px; } .c .seg button { font-size: 11px; line-height: 14px; padding: 3px 9px; }
  .c .chart { flex: 1; min-height: 0; width: 100%; }
`];
