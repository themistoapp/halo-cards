import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { GREY_DAY, GREY_NIGHT, randomOrigin, registerBloomProps } from "../../shared/bloom";
import { shadesFromHex } from "../../shared/colour";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, observeHeight } from "../../shared/util";
import { VEHICLE_IMAGES } from "./images";
import { buildVehicle, watchedVehicle, type HaloVehicleConfig, type Stat } from "./logic";
import { styles } from "./styles";

registerBloomProps();

const ICONS = {
  locked: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  unlocked: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>`,
  charging: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>`,
  idle: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>`,
  pin: svg`<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>`,
};

export class HaloVehicleCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-vehicle-card-editor"); }
  static getStubConfig(): Partial<HaloVehicleConfig> { return { name: "My car", fuel_type: "ice", image_preset: "m140i" }; }

  @state() private _config?: HaloVehicleConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _height = 0;

  private _origins = { a: randomOrigin(), b: randomOrigin() };
  private _unobserve?: () => void;

  setConfig(config: HaloVehicleConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = config;
  }

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const ids = [...watchedVehicle(this._config), ...(this._config.location ? [`zone.${old?.states[this._config.location]?.state}`] : [])];
    if (!old || ids.some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, rows: 4, min_columns: 6, min_rows: 3, max_rows: 4 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeHeight(this, (h) => { if (Math.abs(h - this._height) > 1) this._height = h; });
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _stat(s: Stat) {
    return html`<div><div class="lab">${s.label}</div><div class="v ${s.tone ?? ""}">${s.value}<small>${s.unit}</small></div></div>`;
  }

  override render() {
    const hass = this._hass!, cfg = this._config!;
    const m = buildVehicle(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    const c = shadesFromHex(cfg.colour, dark) ?? (dark ? GREY_NIGHT : GREY_DAY);
    const vars = {
      "--x1": this._origins.a[0], "--y1": this._origins.a[1], "--x2": this._origins.b[0], "--y2": this._origins.b[1],
      "--k": String(m.k), "--k2": "0", "--c0": c.c0, "--c1": c.c1, "--ca": c.ca,
    };
    const compact3 = this._height > 0 && this._height < 220;
    const src = cfg.image || (cfg.image_preset && cfg.image_preset !== "none" ? VEHICLE_IMAGES[cfg.image_preset] : undefined);
    const imgH = compact3 ? 50 : 82;
    const pic = src ? html`<div class="pic">${m.charging ? html`<div class="ring"></div>` : nothing}<img src=${src} style=${styleMap({ height: `${imgH}px` })} alt="" /></div>` : nothing;
    const cols = compact3 ? ".8fr .95fr 1.35fr" : `repeat(${Math.max(m.stats.length, 1)}, 1fr)`;
    const barCls = m.charging ? "chg" : m.kind === "ice" ? "fuel" : `ev ${m.tone ?? ""}`;
    const tile = m.stats.length || m.pct !== undefined || m.status
      ? html`<div class="glass tile">
          ${m.stats.length ? html`<div class="stats" style=${styleMap({ gridTemplateColumns: cols })}>${m.stats.map((s) => this._stat(compact3 && s.label === "Odometer" ? { ...s, label: "Odo" } : s))}</div>` : nothing}
          ${m.pct !== undefined || m.status ? html`<div class="br">
            ${m.pct !== undefined ? html`<div class="bar ${barCls}"><i style=${styleMap({ width: `${m.pct}%` })}></i></div>` : html`<div style="flex:1"></div>`}
            ${m.status ? html`<button class="pill ${m.status.kind}" @click=${() => fireMoreInfo(this, m.status!.entity)}><svg viewBox="0 0 24 24">${ICONS[m.status.kind]}</svg>${m.status.label}</button>` : nothing}
          </div>` : nothing}
        </div>`
      : html`<div class="empty">Choose your vehicle's entities in the editor.</div>`;
    const head = html`<header><h2>${m.name}</h2>${m.chip ? html`<span class="chip"><svg viewBox="0 0 24 24">${ICONS.pin}</svg><span>${m.chip}</span></span>` : nothing}</header>`;
    return html`<ha-card class="${dark ? "dark" : ""} ${compact3 ? "compact3" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)}>
      <div class="bg"></div><div class="grain"></div>
      <div class="inner">${head}${compact3 ? html`<div class="row3">${pic}${tile}</div>` : html`${pic}${tile}`}</div>
    </ha-card>`;
  }
}
