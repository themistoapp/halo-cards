import { css } from "lit";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import { fixtureStyles } from "./fixture";

export const styles = [themeStyles, shadowStyles, fixtureStyles, css`
  ha-card { background: var(--surface); border-radius: var(--ha-card-border-radius, 12px); }
  .inner { gap: 12px; padding: 16px; }
  header .r { display: flex; align-items: center; gap: 6px; }
  button.chip { cursor: pointer; font: inherit; font-size: 11px; line-height: 16px; color: inherit; }
  button.chip:disabled { opacity: .45; cursor: default; }

  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); grid-auto-rows: minmax(116px, 1fr); gap: 8px; overflow-y: auto; scrollbar-width: none; }
  .grid::-webkit-scrollbar { display: none; }

  /* Tile: the fitting, name and level. On, it takes a soft wash of the light's own colour. */
  .tile { position: relative; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 8px 12px;
    border-radius: 14px; border: 1px solid var(--line); background: var(--sunken); cursor: pointer; touch-action: pan-y; user-select: none; -webkit-user-select: none; text-align: center;
    transition: border-color .3s, background .3s; }
  .tile::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: var(--i, 0); transition: opacity .3s, background .3s;
    background: radial-gradient(ellipse 90% 70% at 50% 28%, color-mix(in srgb, var(--glow) 34%, transparent), transparent 75%); }
  .tile.on { border-color: color-mix(in srgb, var(--glow) 45%, var(--line)); }
  .tile:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
  .tile.na { opacity: .5; cursor: default; }
  .art { position: relative; flex: 1; min-height: 0; width: 100%; display: grid; place-items: center; }
  .art .fx.strip { width: 100%; }
  .tx { position: relative; width: 100%; min-width: 0; }
  .nm { font-size: 13px; line-height: 17px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st { font-size: 11px; line-height: 14px; color: var(--ink-2); font-family: var(--code-font-family, ui-monospace, monospace); }
  .tile.on .st { color: var(--ink); }

  /* No fitting chosen: a lit bulb icon in its place. */
  .bulb-i { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--ink) 10%, transparent); transition: background .3s, box-shadow .3s; }
  .bulb-i svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .tile.on .bulb-i { background: var(--glow); color: #1b1400; box-shadow: 0 0 14px 2px color-mix(in srgb, var(--glow) 60%, transparent); }

  /* Brightness: a thin bar along the bottom edge, filled while on and while dragging. */
  .lvl { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .lvl i { position: absolute; inset: 0 auto 0 0; background: var(--glow); transition: width .15s; }
  .tile.drag { transition: none; } .tile.drag .lvl i { transition: none; }
  .tile.drag .lvl { height: 6px; }

  .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--ink-2); font-size: 13px; padding: 12px; }
  .dark .tile { background: color-mix(in srgb, var(--ink) 7%, transparent); }
`];
