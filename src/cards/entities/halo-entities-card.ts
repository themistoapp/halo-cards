import { LitElement, css, html, nothing, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, numState } from "../../shared/util";
import { buildTiles, columnsFor, isFloating, rowsFor, rowsOf, unitParts, watchedEntities, type EntityTile, type HaloEntitiesConfig } from "./logic";

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

export class HaloEntitiesCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, css`
    ha-card { background: var(--surface); border-radius: var(--ha-card-border-radius, 12px); }
    .inner { gap: 8px; padding: 12px; justify-content: center; }
    .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 8px; }
    .t { position: relative; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 0; padding: 6px 4px;
      border-radius: 14px; border: 1px solid var(--line); background: var(--sunken); color: inherit; font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform .12s, border-color .3s; }
    /* Same soft glow of the tile's own colour as the Scenes buttons, fixed at the bottom centre. */
    .t::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: var(--g, .85);
      background: radial-gradient(ellipse 85% 75% at 50% 100%, color-mix(in srgb, var(--c, var(--ink)) 34%, transparent), transparent 78%); }
    .t:not([style*="--c"]) { --g: .3; }
    .t > * { position: relative; }
    .t { border-color: color-mix(in srgb, var(--c, var(--ink)) 22%, var(--line)); }
    .t:active, .ft:active { transform: scale(.96); }
    .t:focus-visible, .ft:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
    .t.off, .ft.off { opacity: .5; }
    .ic { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c, var(--ink)) 16%, transparent); color: var(--c, var(--ink)); }
    ha-icon, ha-state-icon { --mdc-icon-size: 18px; }
    halo-svg-icon { width: 20px; height: 20px; }
    .v { max-width: 100%; font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .v small { font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 2px; }
    .t .lab { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* ---- Floating tiles: any themed tile turns the card into separate surfaces on the dashboard. ---- */
    ha-card.float { background: none; box-shadow: none; border: 0; overflow: visible; }
    ha-card.float .inner { padding: 0; gap: 10px; }
    ha-card.float header { padding: 0 2px; }
    .ft { --t-bg: var(--surface); --t-ink: var(--ink); --t-sub: var(--ink-2); --t-line: var(--line); --chip-bg: none; --chip-ink: var(--ink-2);
      position: relative; overflow: hidden; isolation: isolate; container-type: size; box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; align-items: stretch; text-align: left;
      padding: 11px 13px 12px; border-radius: 16px; border: 1px solid var(--t-line); background: var(--t-bg); color: var(--t-ink); font: inherit; cursor: pointer;
      -webkit-tap-highlight-color: transparent; transition: transform .12s; }
    .shadow .ft { box-shadow: 0 10px 28px -6px rgba(20, 20, 40, .2), 0 2px 6px rgba(20, 20, 40, .1); }
    .shadow.dark .ft { box-shadow: 0 10px 28px -6px rgba(0, 0, 0, .6), 0 2px 6px rgba(0, 0, 0, .4); }
    /* Black on white and white on black are fixed: they don't change at night. */
    .ft.light { --t-bg: #fff; --t-ink: #1b1b1f; --t-sub: #5c5c66; --t-line: rgba(0, 0, 0, .06); --chip-ink: #5c5c66; }
    .ft.dark { --t-bg: #141416; --t-ink: #f4f4f6; --t-sub: rgba(255, 255, 255, .66); --t-line: rgba(255, 255, 255, .08); --chip-bg: rgba(255, 255, 255, .12); --chip-ink: #f4f4f6; }
    .ft.grad { --t-ink: #fff; --t-sub: rgba(255, 255, 255, .86); --t-line: transparent; --chip-bg: rgba(255, 255, 255, .82); --chip-ink: #1b1b1f; background: var(--g); }
    .ft.grad::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: overlay; opacity: .55; background-image: ${unsafeCSS(GRAIN)}; }
    /* Gradients go a little deeper at night, as the blooms do. */
    .dark .ft.grad::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: rgba(0, 0, 0, .34); }
    .ft .top { display: flex; min-height: 22px; }
    .ft .chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 3px 9px; border: 0; border-radius: 99px; background: var(--chip-bg); color: var(--chip-ink);
      font-size: 12px; line-height: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ft.light .chip, .ft.plain .chip { padding: 3px 0; font-weight: 400; }
    .ft .chip span { overflow: hidden; text-overflow: ellipsis; }
    .ft .chip ha-icon, .ft .chip ha-state-icon { --mdc-icon-size: 14px; display: inline-flex; flex: none; width: 14px; height: 14px; }
    .ft .chip halo-svg-icon { width: 14px; height: 14px; }
    .ft .mid { flex: 1; min-height: 0; display: flex; align-items: flex-end; padding-bottom: 5px; }
    .ft .val { max-width: 100%; font-size: clamp(18px, min(30cqh, 24cqw), 48px); line-height: 1; font-weight: 600; letter-spacing: -.045em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    .ft .val small { font-size: .38em; font-weight: 500; letter-spacing: 0; margin-left: 3px; opacity: .78; }
    .ft .sub { font-size: 12.5px; line-height: 16px; color: var(--t-sub); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ft .sub b { font-weight: 600; color: var(--t-ink); }
    /* Small tiles (four across): tighter padding, title and one line below. */
    .grid.small .ft { padding: 9px 9px 10px; border-radius: 14px; }
    @container (max-width: 130px) {
      .ft .top { min-height: 18px; }
      .ft .chip { font-size: 10.5px; padding: 2px 7px; gap: 4px; }
      .ft.light .chip, .ft.plain .chip { padding: 2px 0; }
      .ft .mid { padding-bottom: 3px; }
      .ft .sub { font-size: 10.5px; line-height: 13px; -webkit-line-clamp: 1; }
    }
    /* Full-coverage gradients. Grid, battery and solar use the colours those things have on the other cards. */
    .g-dusk { --g: radial-gradient(110% 80% at 0% 0%, #eab58e 0%, transparent 62%), radial-gradient(110% 90% at 100% 100%, #2b3fd8 0%, transparent 66%), linear-gradient(165deg, #d8a7a4 0%, #9e9ce8 48%, #3d52e2 100%); }
    .g-slate { --g: radial-gradient(120% 70% at 20% 0%, #b3bbd6 0%, transparent 70%), linear-gradient(175deg, #9aa5c6 0%, #6f7ea9 55%, #56669a 100%); }
    .g-ember { --g: radial-gradient(110% 80% at 0% 0%, #f09a4e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #7c44e4 0%, transparent 66%), linear-gradient(165deg, #ea8a56 0%, #dc4e7c 52%, #8f47dc 100%); }
    .g-solar { --g: radial-gradient(110% 80% at 0% 0%, #f6cf62 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #e0568a 0%, transparent 62%), linear-gradient(165deg, #f0bd52 0%, #e88a3e 55%, #dd5f78 100%); }
    .g-battery { --g: radial-gradient(110% 80% at 0% 0%, #7fd6a8 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1f7894 0%, transparent 64%), linear-gradient(165deg, #5cc596 0%, #2f9f86 55%, #22809a 100%); }
    .g-grid { --g: radial-gradient(110% 80% at 0% 0%, #b9aefc 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #2f6bff 0%, transparent 64%), linear-gradient(165deg, #9a8cf7 0%, #6f5cff 52%, #3c6cf5 100%); }
    .g-ocean { --g: radial-gradient(110% 80% at 0% 0%, #7cc8ef 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1b46a0 0%, transparent 64%), linear-gradient(165deg, #5fb3e6 0%, #2f7fd0 52%, #1f52aa 100%); }
    .g-glacier { --g: radial-gradient(110% 80% at 0% 0%, #d2e8f4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4c74ad 0%, transparent 64%), linear-gradient(165deg, #a9cbe4 0%, #7fa6cf 50%, #5a80b6 100%); }
    .g-aurora { --g: radial-gradient(110% 80% at 0% 0%, #66e3c2 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #7a52e6 0%, transparent 64%), linear-gradient(165deg, #4fd1b6 0%, #44a2e0 50%, #6f5ae4 100%); }
    .g-forest { --g: radial-gradient(110% 80% at 0% 0%, #9ccd7e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #255f53 0%, transparent 64%), linear-gradient(165deg, #82bd6e 0%, #4b9660 52%, #2c6d5a 100%); }
    .g-rose { --g: radial-gradient(110% 80% at 0% 0%, #f8b3c0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #a8356f 0%, transparent 64%), linear-gradient(165deg, #f0a0b2 0%, #e2668c 52%, #b5407a 100%); }
    .g-plum { --g: radial-gradient(110% 80% at 0% 0%, #c39be0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4b2580 0%, transparent 64%), linear-gradient(165deg, #b085d6 0%, #8650b8 52%, #5c308c 100%); }
    .g-sunset { --g: radial-gradient(110% 80% at 0% 0%, #ffc06f 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #c2405e 0%, transparent 64%), linear-gradient(165deg, #ffab62 0%, #f26d5e 52%, #c94466 100%); }
    .g-sand { --g: radial-gradient(110% 80% at 0% 0%, #efd3a4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #946640 0%, transparent 64%), linear-gradient(165deg, #dfbe8c 0%, #c49763 52%, #a0734a 100%); }
    .g-graphite { --g: radial-gradient(110% 80% at 0% 0%, #7d828e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1d1f24 0%, transparent 64%), linear-gradient(165deg, #6a6e79 0%, #44474f 52%, #2a2c32 100%); }
    @media (prefers-reduced-motion: reduce) { .t, .ft { transition: none; } }
  `];

  static getConfigElement() { return document.createElement("halo-entities-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloEntitiesConfig> {
    const ids = Object.keys(hass?.states ?? {}).filter((e) => e.startsWith("sensor.") && numState(hass!.states[e]) !== undefined).slice(0, 4);
    return { entities: ids.map((entity) => ({ entity })) };
  }

  @state() private _config?: HaloEntitiesConfig;
  @state() private _hass?: HomeAssistant;

  setConfig(config: HaloEntitiesConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!Array.isArray(config.entities) || !config.entities.length) throw new Error("Add at least one entity");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || watchedEntities(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 2; }
  getGridOptions() {
    const n = this._config ? rowsOf(this._config).length : 4;
    return { columns: 12, rows: rowsFor(n, !!this._config?.name, this._config?.columns), min_columns: 4, min_rows: 2 };
  }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _icon(t: EntityTile) {
    if (t.svg) return html`<halo-svg-icon .src=${t.svg}></halo-svg-icon>`;
    const s = this._hass!.states[t.entity];
    if (t.stateIcon && s && customElements.get("ha-state-icon")) return html`<ha-state-icon .hass=${this._hass} .stateObj=${s}></ha-state-icon>`;
    return html`<ha-icon .icon=${t.icon}></ha-icon>`;
  }

  /** Plain tile in the classic card: icon, value, name. */
  private _tile(t: EntityTile) {
    const style = styleMap(t.colour ? { "--c": t.colour } : {});
    return html`<button class="t ${t.available ? "" : "off"}" style=${style} aria-label="${t.name}: ${t.value} ${t.unit}" @click=${() => fireMoreInfo(this, t.entity)}>
      ${t.showIcon ? html`<span class="ic">${this._icon(t)}</span>` : nothing}
      <span class="v">${t.value}${t.unit ? html`<small>${t.unit}</small>` : nothing}</span>
      <span class="lab">${t.name}</span></button>`;
  }

  /** Floating tile: title top left, the figure low, a line below. */
  private _floating(t: EntityTile) {
    const u = unitParts(t.unit);
    const grad = t.theme !== "plain" && t.theme !== "light" && t.theme !== "dark";
    const sec = t.secondary;
    return html`<button class="ft ${t.theme} ${grad ? `grad g-${t.theme}` : ""} ${t.available ? "" : "off"}" aria-label="${t.name}: ${t.value} ${t.unit}" @click=${() => fireMoreInfo(this, t.entity)}>
      <div class="top"><span class="chip">${t.showIcon ? this._icon(t) : nothing}<span>${t.name}</span></span></div>
      <div class="mid"><span class="val">${u.pre}${t.value}${u.inline}${u.small ? html`<small>${u.small}</small>` : nothing}</span></div>
      ${sec ? html`<div class="sub">${"text" in sec ? sec.text : html`${sec.name ? html`<b>${sec.name}</b> ` : nothing}${sec.value}${sec.unit ? ` ${sec.unit}` : ""}`}</div>` : nothing}
    </button>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const tiles = buildTiles(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    const float = isFloating(cfg);
    const shadow = cfg.shadow === false ? "" : float ? "shadow" : "halo-shadow";
    return html`<ha-card class="${dark ? "dark" : ""} ${float ? "float" : ""} ${shadow}">
      <div class="inner">
        ${cfg.name ? html`<header><h2>${cfg.name}</h2></header>` : nothing}
        <div class="grid ${float && cfg.columns !== 2 ? "small" : ""}" style="--cols:${columnsFor(tiles.length, cfg.columns)}">${tiles.map((t) => (float ? this._floating(t) : this._tile(t)))}</div>
      </div>
    </ha-card>`;
  }
}
