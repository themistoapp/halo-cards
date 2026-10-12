import { css } from "lit";
import { bloomStyles, shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, shadowStyles, css`
  .inner { gap: 6px; padding: 14px; }
  .compact3 .inner { padding: 12px 14px; }
  .pic { flex: 1; min-height: 0; display: grid; place-items: center; position: relative; }
  .pic img { object-fit: contain; max-width: 100%; filter: drop-shadow(0 8px 10px color-mix(in srgb, var(--ink) 28%, transparent)); }
  .pic .ring { position: absolute; width: 70%; height: 90%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, #3ee08a 45%, transparent), transparent); animation: pulse 3.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.12); opacity: .9; } }
  .row3 { flex: 1; min-height: 0; display: flex; align-items: center; gap: 10px; }
  .row3 .pic { flex: none; width: 112px; }
  .tile { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .row3 .tile { flex: 1; padding: 8px 10px; gap: 6px; }
  .stats { display: grid; gap: 8px; }
  .row3 .stats { gap: 6px; }
  .v { font-size: 20px; line-height: 24px; font-weight: 500; letter-spacing: -.01em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row3 .v { font-size: 16px; }
  .v small { font-size: 12px; font-weight: 400; margin-left: 2px; letter-spacing: 0; }
  .v.warn { color: var(--warn); } .v.bad { color: var(--bad); }
  .br { display: flex; align-items: center; gap: 10px; }
  .bar { flex: 1; height: 24px; border-radius: 12px; background: var(--sunken); position: relative; overflow: hidden; }
  /* Meridian stripes: the fill is diagonal stripes in the bar's colour. */
  ha-card { --stripe: #1f9d63; --stripe-ice: #8a8f9b; }
  ha-card.dark { --stripe: #4cc9a0; --stripe-ice: #a6abb6; }
  .bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 12px; --c: var(--stripe); transition: width .6s ease;
    background: repeating-linear-gradient(135deg, var(--c) 0 1.5px, color-mix(in srgb, var(--c) 20%, transparent) 1.5px 5px); }
  .bar.fuel i { --c: var(--stripe-ice); }
  .bar.ev.warn i { --c: var(--warn); } .bar.ev.bad i { --c: var(--bad); }
  .bar.chg i { --c: var(--stripe); animation: breathe 2s ease-in-out infinite; }
  @keyframes breathe { 0%,100% { opacity: .65; } 50% { opacity: 1; } }
  .pill { display: inline-flex; align-items: center; gap: 5px; height: 24px; box-sizing: border-box; padding: 0 10px; border-radius: 99px; font-size: 12px; line-height: 16px; font-weight: 500; background: var(--sunken); white-space: nowrap; flex: none; border: 0; cursor: pointer; }
  .pill.charging { background: color-mix(in srgb, #3ee08a 24%, var(--surface)); }
  .pill svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; font-size: 13px; color: var(--ink-2); }
  @media (prefers-reduced-motion: reduce) { .bar.chg i, .pic .ring { animation: none; } .bar i { transition: none; } }
`];
