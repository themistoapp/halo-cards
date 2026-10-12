import { css } from "lit";
import { bloomStyles, shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, shadowStyles, css`
  .inner { gap: 10px; padding: 16px; }
  .hero { position: relative; flex: 1; min-height: 70px; display: grid; place-items: center; }
  .ring { position: absolute; width: 62%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--c0) 40%, transparent), transparent); animation: pulse 3.2s ease-in-out infinite; }
  .hero.paused .ring, .hero.idle .ring { animation: none; opacity: .3; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.12); opacity: .9; } }
  .hero img { position: relative; object-fit: contain; max-width: 90%; filter: drop-shadow(0 10px 14px color-mix(in srgb, var(--ink) 28%, transparent)); }

  .np { display: flex; gap: 12px; padding: 12px; align-items: center; }
  .art { flex: none; width: 64px; height: 64px; border-radius: 10px; box-shadow: var(--press); background: var(--sunken) center / cover; }
  .tx { min-width: 0; flex: 1; }
  .ti { font-size: 15px; line-height: 20px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ar { font-size: 13px; line-height: 18px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pr { margin-top: 8px; height: 4px; border-radius: 2px; background: var(--sunken); position: relative; }
  .pr i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--action); }
  .tm { display: flex; justify-content: space-between; font-size: 10px; line-height: 14px; color: var(--ink-2); margin-top: 4px; font-family: var(--code-font-family, ui-monospace, monospace); }

  .tr { display: flex; align-items: center; justify-content: space-between; padding: 0 6px; }
  .b { width: 40px; height: 40px; border-radius: 50%; border: 0; background: none; display: grid; place-items: center; padding: 0; cursor: pointer; color: var(--ink); }
  .b.dim { color: var(--ink-2); }
  .b.on { background: var(--sunken); color: var(--ink); }
  .b svg, .play svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .play { width: 56px; height: 56px; border-radius: 50%; border: 0; background: var(--action); color: var(--action-ink); display: grid; place-items: center; box-shadow: var(--press); cursor: pointer; padding: 0; }
  .play svg { width: 24px; height: 24px; stroke: none; fill: currentColor; }

  .vol { display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; height: 52px; }
  .vol .pc { font-size: 13px; font-weight: 500; width: 38px; text-align: right; font-variant-numeric: tabular-nums; }
  input[type=range] { -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; height: 20px; margin: 0; background: transparent; cursor: pointer; --p: 0%; }
  input[type=range]::-webkit-slider-runnable-track { height: 8px; border-radius: 4px; background: linear-gradient(to right, var(--action) var(--p), var(--sunken) var(--p)); }
  input[type=range]::-moz-range-track { height: 8px; border-radius: 4px; background: var(--sunken); }
  input[type=range]::-moz-range-progress { height: 8px; border-radius: 4px; background: var(--action); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -6px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--press); }
  input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--press); }

  header { min-height: 30px; }
  .pick { position: relative; flex: none; max-width: 52%; display: flex; align-items: center; gap: 4px; min-width: 0; }
  .pick h2 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pick svg { flex: none; width: 18px; height: 18px; fill: none; stroke: var(--ink-2); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .pick select { position: absolute; inset: -6px; width: calc(100% + 12px); height: calc(100% + 12px); opacity: 0; cursor: pointer; font-size: 16px; }
  header .grp { flex: 1; min-width: 0; padding: 2px 0;
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 14px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 14px), transparent); }
  header .grp .p:first-child { margin-left: auto; }
  header .grp .p { padding: 4px 10px; font-size: 12px; line-height: 16px; }
  .lab { margin: 2px 2px -2px; }
  .grp { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .grp::-webkit-scrollbar { display: none; }
  .p { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 99px; font-size: 13px; line-height: 18px; font-weight: 500; border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 72%, transparent); cursor: pointer; white-space: nowrap; }
  .p.on { background: var(--action); color: var(--action-ink); border-color: transparent; }
  .p svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .fav { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .f { flex: none; width: 74px; border: 0; background: none; padding: 0; text-align: left; cursor: pointer; }
  .f .im { width: 74px; height: 74px; border-radius: 12px; box-shadow: var(--press); background: var(--sunken) center / cover; }
  .f .nm { font-size: 11px; line-height: 14px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Compact (12 x 4) and mini (12 x 2) */
  .compact .inner { gap: 8px; padding: 14px; justify-content: space-between; }
  .compact .np { padding: 10px; }
  .compact .art { width: 56px; height: 56px; }
  .compact .play { width: 48px; height: 48px; flex: none; }
  .compact .vol { height: 44px; }
  .mini .inner { flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px; }
  .mini .thumb { height: 70px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(0,0,0,.25)); }
  .mini .who { flex: 1; min-width: 0; }
  .mini .who b { display: block; font-size: 13px; line-height: 18px; font-weight: 500; }
  .mini .who span { font-size: 12px; line-height: 16px; color: var(--ink-2); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
`];
