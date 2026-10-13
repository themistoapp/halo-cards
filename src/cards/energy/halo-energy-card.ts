import { LitElement, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { STREAM_IMAGE } from "./stream";
import { bucket, graphMax, historyWindow, subscribeHistory, type Sample } from "../../shared/history";
import { clock, setLocale } from "../../shared/format";
import { figure, tileGraph } from "../../shared/tile";
import { ICONS } from "./icons";
import { buildModel, layoutFor, randomOrigin, watchedEntities, type Model, type Tile } from "./logic";
import { styles } from "./styles";
import { fireMoreInfo, observeHeight } from "../../shared/util";
import type { HaloEnergyConfig, HomeAssistant } from "../../shared/types";

// Registered at document level so the bloom sizes can animate (shadow-root @property is ignored).
for (const p of ["--is", "--ib", "--ig"]) {
  try { CSS.registerProperty({ name: p, syntax: "<number>", inherits: true, initialValue: "0" }); } catch { /* already registered, or unsupported */ }
}

const LABELS = { solar: "Solar", battery: "Battery", grid: "Grid", house: "House" } as const;
const BUCKETS = 48;
let uid = 0;

export class HaloEnergyCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-energy-card-editor"); }
  static getStubConfig(): Partial<HaloEnergyConfig> { return { name: "EcoFlow Stream" }; }

  @state() private _config?: HaloEnergyConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _history: Record<string, Sample[]> = {};
  @state() private _draft?: number;
  @state() private _height = 0;
  private _unobserve?: () => void;

  private _id = ++uid;
  private _origins = { s: randomOrigin(), b: randomOrigin(), g: randomOrigin() };
  private _unsub?: () => void;
  private _subKey = "";

  setConfig(config: HaloEnergyConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = config;
    this._subKey = "";
    this._resubscribe();
  }

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    const ids = watchedEntities(this._config);
    if (!old || ids.some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
    if (!old) this._resubscribe();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unobserve?.(); this._unobserve = undefined;
    this._unsub?.(); this._unsub = undefined; this._subKey = "";
  }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeHeight(this, (h) => { if (Math.abs(h - this._height) > 1) this._height = h; });
    this._resubscribe();
  }

  getCardSize() { return 12; }
  getGridOptions() { return { columns: 12, rows: 8, min_columns: 6, min_rows: 5 }; }

  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _resubscribe() {
    if (!this._hass || !this._config || !this.isConnected) return;
    const model = buildModel(this._hass, this._config);
    const ids = [...new Set(model.tiles.map((t) => t.history?.entity).filter((x): x is string => !!x))];
    const key = ids.join("|");
    if (key === this._subKey) return;
    this._unsub?.(); this._unsub = undefined; this._subKey = key;
    if (!ids.length) { this._history = {}; return; }
    const [start] = historyWindow(Date.now(), this._config.history_start_hour ?? 7);
    this._unsub = subscribeHistory(this._hass, ids, start, (d) => { this._history = { ...d }; });
  }

  override updated() { this._resubscribe(); }

  private _graph(t: Tile, hass: HomeAssistant) {
    if (!t.history || !this._config) return nothing;
    const samples = this._history[t.history.entity];
    if (!samples?.length) return nothing;
    const [start, end] = historyWindow(Date.now(), this._config.history_start_hour ?? 7);
    const unit = String(hass.states[t.history.entity]?.attributes?.unit_of_measurement ?? "W").toLowerCase();
    const div = t.history.scale === "kw" && unit === "w" ? 1000 : 1;
    const values = bucket(samples, start, end, BUCKETS).map((v) => (v === null ? null : v / div));
    const abs = t.history.scale === "kw" ? values.map((v) => (v === null ? null : Math.abs(v))) : values;
    return tileGraph(abs, 0, graphMax(t.history.scale, abs), `g${this._id}-${t.key}`);
  }

  private _tile(t: Tile, hass: HomeAssistant, span: boolean, tight: boolean) {
    const open = () => t.entity && fireMoreInfo(this, t.entity);
    return html`<div class="tile ${t.key} ${span ? "span" : ""} ${tight ? "tight" : ""} ${t.entity ? "tap" : ""}" role=${t.entity ? "button" : nothing} tabindex=${t.entity ? 0 : nothing}
      @click=${open} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <div class="top"><span class="tchip"><span class="ico"><svg viewBox="0 0 24 24">${ICONS[t.key]}</svg></span><span class="label">${LABELS[t.key]}</span></span></div>
      <div>${figure(t.figure, t.unit)}</div>
      ${t.detail ? html`<div class="det">${t.detail}</div>` : nothing}
      ${this._graph(t, hass)}
    </div>`;
  }

  private _controls(m: Model) {
    if (!m.reserve && !m.mode) return nothing;
    const r = m.reserve;
    const value = this._draft ?? r?.value ?? 0;
    const pct = r ? ((value - r.min) / Math.max(r.max - r.min, 1)) * 100 : 0;
    return html`<div class="ctl">
      ${r ? html`<div class="rsv">
        <div class="row"><span>Backup reserve</span><span>${Math.round(value)}%</span></div>
        <input type="range" aria-label="Backup reserve" min=${r.min} max=${r.max} step=${r.step} .value=${String(value)}
          style=${styleMap({ "--p": `${pct}%` })}
          @input=${(e: Event) => { this._draft = Number((e.target as HTMLInputElement).value); }}
          @change=${(e: Event) => this._setReserve(r.entity, Number((e.target as HTMLInputElement).value))} />
      </div>` : nothing}
      ${m.mode ? html`<div class="seg ${m.mode.selected ?? "none"}" role="radiogroup" aria-label="Operating mode">
        <i class="th"></i>
        <button class="ms" role="radio" aria-checked=${m.mode.selected === "self"} @click=${() => this._setMode(m.mode!, "self")}>Self-powered</button>
        <button class="ma" role="radio" aria-checked=${m.mode.selected === "ai"} @click=${() => this._setMode(m.mode!, "ai")}>AI</button>
      </div>` : nothing}
    </div>`;
  }

  private async _setReserve(entity: string, value: number) {
    try { await this._hass?.callService("number", "set_value", { entity_id: entity, value }); }
    finally { this._draft = undefined; }
  }
  private _setMode(mode: NonNullable<Model["mode"]>, which: "self" | "ai") {
    if (mode.selfEntity && mode.aiEntity) {
      // Two switches: turn the chosen one on, and the other off in case the device does not do that itself.
      const [on, off] = which === "self" ? [mode.selfEntity, mode.aiEntity] : [mode.aiEntity, mode.selfEntity];
      if (mode.selected === which) return;
      this._hass?.callService("homeassistant", "turn_on", { entity_id: on });
      if (this._hass?.states[off]?.state === "on") this._hass?.callService("homeassistant", "turn_off", { entity_id: off });
      return;
    }
    this._hass?.callService("select", "select_option", { entity_id: mode.entity, option: which === "self" ? mode.self : mode.ai });
  }

  override render() {
    const hass = this._hass!, cfg = this._config!;
    const m = buildModel(hass, cfg);
    const o = this._origins;
    const vars = {
      "--sx": o.s[0], "--sy": o.s[1], "--bx": o.b[0], "--by": o.b[1], "--gx": o.g[0], "--gy": o.g[1],
      "--ts": m.bloom.solar.toFixed(2), "--tb": m.bloom.battery.toFixed(2), "--tg": m.bloom.grid.toFixed(2),
    };
    const lay = layoutFor(m.tiles.length);
    const grid = { gridTemplateColumns: `repeat(${lay.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${lay.rows}, minmax(0, 1fr))` };
    const time = m.updated ? clock(m.updated.getTime()) : undefined;
    // Short slots lose the picture first, then everything tightens.
    const mode = !this._height || this._height >= 620 ? "full" : this._height >= 400 ? "regular" : "tight";
    return html`<ha-card class="${hass.themes?.darkMode ? "dark" : ""} ${mode} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)}>
      <div class="bg"></div><div class="grain"></div>
      <div class="inner">
        <header><h2>${cfg.name ?? "EcoFlow Stream"}</h2>${time ? html`<span class="chip">Updated ${time}</span>` : nothing}</header>
        ${mode === "tight" ? nothing : html`<div class="hero">
          <div class="halo"></div>
          <div class="stream"><img src=${STREAM_IMAGE} alt="EcoFlow STREAM" />
            ${m.soc !== undefined ? html`<div class="lb ${cfg.battery_soc ? "tap" : ""}" role="button" tabindex="0" aria-label="Battery ${Math.round(m.soc)}%" @click=${() => cfg.battery_soc && fireMoreInfo(this, cfg.battery_soc)}><i style=${styleMap({ height: `${m.soc}%` })}></i></div>` : nothing}
          </div>
        </div>`}
        ${m.tiles.length
          ? html`<div class="tiles ${m.tiles.length === 1 ? "one" : ""}" style=${styleMap(grid)}>
              ${m.tiles.map((t, i) => this._tile(t, hass, lay.spanLast && i === m.tiles.length - 1, mode !== "full"))}</div>`
          : !m.reserve && !m.mode ? html`<div class="empty">Choose your entities in the card editor.</div>` : html`<div style="flex:1"></div>`}
        ${this._controls(m)}
      </div>
    </ha-card>`;
  }
}
