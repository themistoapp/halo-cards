import { css } from "lit";
import { bloomStyles, shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, shadowStyles, css`
  ha-card { cursor: pointer; }
  .inner { padding: 16px; gap: 14px; }
  h2 { padding-top: 1px; }

  /* Icons: line icons, tinted by condition. */
  .ic { flex: none; display: block; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; color: var(--ink-2); }
  .ic.sun, .ic.pc { color: #c98a0e; }
  .ic.moon, .ic.pcn { color: #4a58c4; }
  .ic.rain, .ic.pour, .ic.snow { color: #2f86cf; }
  .ic.bolt { color: var(--warn); }
  ha-card.dark .ic.sun, ha-card.dark .ic.pc { color: #f2b84a; }
  ha-card.dark .ic.moon, ha-card.dark .ic.pcn { color: #a9b4ff; }
  ha-card.dark .ic.rain, ha-card.dark .ic.pour, ha-card.dark .ic.snow { color: #6cc3ec; }

  .t { font-weight: 600; letter-spacing: -.045em; white-space: nowrap; }
  .t sup { font-size: .44em; letter-spacing: 0; vertical-align: top; position: relative; top: .1em; }
  .cond { font-size: 15px; line-height: 20px; font-weight: 500; }
  .sub { font-size: 13px; line-height: 18px; color: var(--ink-2); }
  .big { position: absolute; top: 14px; right: 16px; }

  /* Today */
  .hero { margin-top: -6px; }
  .hero .t { font-size: 76px; line-height: 80px; }
  .tight .hero .t { font-size: 64px; line-height: 68px; }
  .tight .inner { gap: 10px; }
  .grow { flex: 1; min-height: 0; }
  .stats { display: flex; }
  .stats > div { flex: 1; min-width: 0; padding: 10px 12px; }
  .stats > div + div { border-left: 1px solid var(--line); }
  .v { font-size: 15px; line-height: 20px; font-weight: 500; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .v small { font-size: 11px; font-weight: 400; color: var(--ink-2); margin-left: 3px; }
  .hours { display: flex; padding: 12px 6px; }
  .hr { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .hr b { font-size: 15px; line-height: 18px; font-weight: 500; }

  /* Week */
  .days { padding: 2px 14px; flex: none; }
  .day { display: flex; align-items: center; gap: 10px; height: 40px; }
  .day + .day { border-top: 1px solid var(--line); }
  .dn { width: 52px; font-size: 14px; line-height: 20px; font-weight: 500; }
  .dl, .dh { width: 30px; font-size: 14px; line-height: 20px; }
  .dl { text-align: right; color: var(--ink-2); }
  .dh { font-weight: 500; }
  .rng { flex: 1; position: relative; height: 6px; border-radius: 3px; background: var(--sunken); }
  .rng i { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg, #2f86cf, #e0592a); }
  .rng u { position: absolute; top: -2px; width: 6px; height: 10px; border-radius: 3px; background: var(--ink); box-shadow: 0 0 0 2px var(--surface); }

  /* Compact */
  .c { flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; }
  .c .main { flex: 1; min-width: 0; }
  .c .row { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
  .c .t { font-size: 44px; line-height: 48px; }
  .c .sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c .hours { padding: 10px 6px; gap: 2px; flex: none; }
  .c .hr { width: 44px; flex: none; gap: 5px; }
  .c .hr b { font-size: 14px; line-height: 16px; }
`];
