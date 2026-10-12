import { css } from "lit";
import { bloomStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, css`
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
  .bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 12px; background: var(--action); transition: width .6s ease; }
  .bar.fuel i { background: linear-gradient(90deg, #f5a3a5, #e5484d 55%, #b3262f); }
  .bar.ev.warn i { background: var(--warn); } .bar.ev.bad i { background: var(--bad); }
  .bar.chg i { background: linear-gradient(90deg, #3ee08a, #2fc4b8, #3ee08a); background-size: 200% 100%; animation: flow 2.4s linear infinite; }
  @keyframes flow { to { background-position: -200% 0; } }
  .pill { display: inline-flex; align-items: center; gap: 5px; height: 24px; box-sizing: border-box; padding: 0 10px; border-radius: 99px; font-size: 12px; line-height: 16px; font-weight: 500; background: var(--sunken); white-space: nowrap; flex: none; border: 0; cursor: pointer; }
  .pill.charging { background: color-mix(in srgb, #3ee08a 24%, var(--surface)); }
  .pill svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; font-size: 13px; color: var(--ink-2); }
  @media (prefers-reduced-motion: reduce) { .bar.chg i, .pic .ring { animation: none; } .bar i { transition: none; } }
`];
