import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, numState } from "../../shared/util";
import { buildTiles, columnsFor, rowsFor, rowsOf, watchedEntities, type EntityTile, type HaloEntitiesConfig } from "./logic";

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
    .t:active { transform: scale(.96); }
    .t:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
    .t.off { opacity: .5; }
    .ic { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c, var(--ink)) 16%, transparent); color: var(--c, var(--ink)); }
    ha-icon, ha-state-icon { --mdc-icon-size: 18px; }
    halo-svg-icon { width: 20px; height: 20px; }
    .v { max-width: 100%; font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .v small { font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); margin-left: 2px; }
    .t .lab { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
    return { columns: 12, rows: rowsFor(n, !!this._config?.name), min_columns: 4, min_rows: 2 };
  }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _icon(t: EntityTile) {
    if (t.svg) return html`<halo-svg-icon .src=${t.svg}></halo-svg-icon>`;
    const s = this._hass!.states[t.entity];
    if (t.stateIcon && s && customElements.get("ha-state-icon")) return html`<ha-state-icon .hass=${this._hass} .stateObj=${s}></ha-state-icon>`;
    return html`<ha-icon .icon=${t.icon}></ha-icon>`;
  }

  private _tile(t: EntityTile) {
    const style = styleMap(t.colour ? { "--c": t.colour } : {});
    return html`<button class="t ${t.available ? "" : "off"}" style=${style} aria-label="${t.name}: ${t.value} ${t.unit}" @click=${() => fireMoreInfo(this, t.entity)}>
      <span class="ic">${this._icon(t)}</span>
      <span class="v">${t.value}${t.unit ? html`<small>${t.unit}</small>` : nothing}</span>
      <span class="lab">${t.name}</span></button>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const tiles = buildTiles(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}">
      <div class="inner">
        ${cfg.name ? html`<header><h2>${cfg.name}</h2></header>` : nothing}
        <div class="grid" style="--cols:${columnsFor(tiles.length)}">${tiles.map((t) => this._tile(t))}</div>
      </div>
    </ha-card>`;
  }
}
