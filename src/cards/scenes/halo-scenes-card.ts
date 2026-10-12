import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import type { HomeAssistant } from "../../shared/types";
import { buildScenes, columnsFor, runService, watchedScenes, type HaloScenesConfig, type SceneButton } from "./logic";

export class HaloScenesCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, css`
    ha-card { background: var(--surface); border-radius: var(--ha-card-border-radius, 12px); }
    .inner { gap: 8px; padding: 12px; justify-content: center; }
    .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 8px; }
    .s { position: relative; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-width: 0; padding: 6px 4px;
      border-radius: 14px; border: 1px solid var(--line); background: var(--sunken); color: inherit; font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform .12s, border-color .3s, background .3s; }
    /* Each button carries a soft glow of its own colour, fixed at the bottom centre. */
    .s::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: var(--g, .85); transition: opacity .3s;
      background: radial-gradient(ellipse 85% 75% at 50% 100%, color-mix(in srgb, var(--c, var(--ink)) 34%, transparent), transparent 78%); }
    .s:not([style*="--c"]) { --g: .3; }
    .s > * { position: relative; }
    .s { border-color: color-mix(in srgb, var(--c, var(--ink)) 22%, var(--line)); }
    .s:active { transform: scale(.96); }
    .s:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
    .s:disabled { opacity: .5; cursor: default; }
    .ic { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c, var(--ink)) 16%, transparent); color: var(--c, var(--ink)); transition: background .3s, color .3s, box-shadow .3s; }
    .ic svg { width: 20px; height: 20px; fill: currentColor; }
    ha-icon { --mdc-icon-size: 20px; }
    .nm { max-width: 100%; font-size: 12px; line-height: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* After a tap: the button lights in its colour for a moment. */
    .s.fired { --g: 1.6; border-color: color-mix(in srgb, var(--c, var(--action)) 55%, var(--line)); }
    .s.fired .ic { background: var(--c, var(--action)); color: #fff; box-shadow: 0 0 14px 2px color-mix(in srgb, var(--c, var(--action)) 55%, transparent); }
    .empty { flex: 1; display: grid; place-items: center; color: var(--ink-2); font-size: 13px; text-align: center; }
  `];

  static getConfigElement() { return document.createElement("halo-scenes-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloScenesConfig> {
    const ids = Object.keys(hass?.states ?? {}).filter((e) => e.startsWith("scene.")).slice(0, 4);
    return { scenes: ids.map((entity) => ({ entity })) };
  }

  @state() private _config?: HaloScenesConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _fired?: string;
  private _timer?: number;

  setConfig(config: HaloScenesConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!Array.isArray(config.scenes) || !config.scenes.length) throw new Error("Add at least one scene");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || watchedScenes(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 2; }
  getGridOptions() { return { columns: 12, rows: this._config?.name ? 3 : 2, min_columns: 4, min_rows: 2 }; }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _run(b: SceneButton) {
    if (!b.available) return;
    const [d, s] = runService(b.domain);
    this._hass!.callService(d, s, { entity_id: b.entity });
    this._fired = b.entity;
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => { this._fired = undefined; }, 1200);
  }

  private _button(b: SceneButton) {
    const style = styleMap(b.colour ? { "--c": b.colour } : {});
    return html`<button class="s ${this._fired === b.entity ? "fired" : ""}" style=${style} ?disabled=${!b.available} aria-label=${b.name} @click=${() => this._run(b)}>
      <span class="ic"><ha-icon .icon=${b.icon}></ha-icon></span><span class="nm">${b.name}</span></button>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const list = buildScenes(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}">
      <div class="inner">
        ${cfg.name ? html`<header><h2>${cfg.name}</h2></header>` : nothing}
        <div class="grid" style="--cols:${columnsFor(list.length)}">${list.map((b) => this._button(b))}</div>
      </div>
    </ha-card>`;
  }
}
