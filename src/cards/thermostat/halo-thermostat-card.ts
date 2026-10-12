import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { GREY_DAY, GREY_NIGHT, registerBloomProps } from "../../shared/bloom";
import { shadesFromHex } from "../../shared/colour";
import type { HomeAssistant } from "../../shared/types";
import { observeSize } from "../../shared/util";
import { buildThermostat, dialAngle, fmtTemp, round05, stepTarget, watchedThermostat, type HaloThermostatConfig, type ThermoModel } from "./logic";
import { styles } from "./styles";

registerBloomProps();

const HEAT = { day: "#e8742f", night: "#ff9a5c" }, COOL = { day: "#2f86cf", night: "#6cc3ec" };
const CX = 173, CY = 152, RO = 142, RI = 120, TICKS = 76;
const pol = (r: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; };
const tick = (r1: number, r2: number, deg: number, cls: string, w: number) => {
  const [x1, y1] = pol(r1, deg), [x2, y2] = pol(r2, deg);
  return svg`<line class=${cls} x1=${x1.toFixed(2)} y1=${y1.toFixed(2)} x2=${x2.toFixed(2)} y2=${y2.toFixed(2)} stroke-width=${w}></line>`;
};

interface Pending { tgt?: number; low?: number; high?: number }

export class HaloThermostatCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-thermostat-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloThermostatConfig> {
    return { entity: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("climate.")) ?? "climate.example" };
  }

  @state() private _config?: HaloThermostatConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _pending?: Pending;
  private _unobserve?: () => void;
  private _send?: number;
  private _clear?: number;

  setConfig(config: HaloThermostatConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Choose a climate entity");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || watchedThermostat(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 7, min_columns: 4, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); clearTimeout(this._send); clearTimeout(this._clear); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /** + or -: moves the target by one step (both ends of a heat/cool range), then sends it once presses stop. */
  private _press(m: ThermoModel, dir: 1 | -1) {
    if (!m.available || m.mode === "off") return;
    const p = this._pending;
    let next: Pending;
    if (m.range) {
      const low = p?.low ?? m.low ?? m.min, high = p?.high ?? m.high ?? m.max;
      const d = stepTarget(0, dir, m.step, -Infinity, Infinity);
      const sh = Math.min(Math.max(d, m.min - low), m.max - high);
      next = { low: round05(low + sh), high: round05(high + sh) };
    } else {
      next = { tgt: stepTarget(p?.tgt ?? m.tgt ?? m.cur ?? m.min, dir, m.step, m.min, m.max) };
    }
    this._pending = next;
    clearTimeout(this._send); clearTimeout(this._clear);
    this._send = window.setTimeout(() => {
      const data = next.tgt !== undefined ? { temperature: next.tgt } : { target_temp_low: next.low, target_temp_high: next.high };
      this._hass!.callService("climate", "set_temperature", { entity_id: this._config!.entity, ...data });
    }, 700);
    this._clear = window.setTimeout(() => { this._pending = undefined; }, 4500);
  }

  private _setMode(mode: string) {
    this._pending = undefined;
    this._hass!.callService("climate", "set_hvac_mode", { entity_id: this._config!.entity, hvac_mode: mode });
  }

  /** The numbers as shown: pending presses win over the thermostat's own until it catches up. */
  private _shown(m: ThermoModel): ThermoModel {
    const p = this._pending;
    return p ? { ...m, ...(p.tgt !== undefined ? { tgt: p.tgt } : {}), ...(p.low !== undefined ? { low: p.low, high: p.high } : {}) } : m;
  }

  private _heroText(m: ThermoModel) {
    if (!m.available) return "–";
    if (m.mode === "off") return "Off";
    if (m.range && m.low !== undefined && m.high !== undefined) return `${fmtTemp(m.low)}–${fmtTemp(m.high)}`;
    return m.tgt === undefined ? "–" : fmtTemp(m.tgt);
  }
  private _nowText(m: ThermoModel) {
    if (!m.available) return "Unavailable";
    const parts = [m.cur === undefined ? undefined : `Now ${fmtTemp(m.cur)}°`, m.humidity === undefined ? undefined : `${m.humidity}% humidity`].filter(Boolean);
    return parts.join(" · ");
  }

  private _modes(m: ThermoModel) {
    if (m.modes.length < 2) return nothing;
    return html`<div class="seg" role="group" aria-label="Mode">${m.modes.map((x) => html`<button aria-pressed=${String(m.mode === x.id)} @click=${() => this._setMode(x.id)}>${x.label}</button>`)}</div>`;
  }

  private _ringTicks(m: ThermoModel) {
    const out = [];
    const lo = m.range ? m.low : m.cur !== undefined && m.tgt !== undefined ? Math.min(m.cur, m.tgt) : undefined;
    const hi = m.range ? m.high : m.cur !== undefined && m.tgt !== undefined ? Math.max(m.cur, m.tgt) : undefined;
    const active = m.available && m.mode !== "off" && lo !== undefined && hi !== undefined && (m.range || m.tone === "heat" || m.tone === "cool");
    for (let i = 0; i <= TICKS; i++) {
      const v = m.min + ((m.max - m.min) * i) / TICKS;
      const on = active && v >= lo! - 0.001 && v <= hi! + 0.001;
      out.push(tick(RI, RO, dialAngle(v, m.min, m.max), `tk ${on ? (m.range ? "band" : "lit") : ""}`, 2.2));
    }
    if (m.available && m.cur !== undefined) out.push(tick(RI - 12, RO + 6, dialAngle(m.cur, m.min, m.max), "mk-cur", 3));
    if (m.available && m.mode !== "off") {
      if (m.range && m.low !== undefined && m.high !== undefined) {
        out.push(tick(RI - 12, RO + 6, dialAngle(m.low, m.min, m.max), "mk-lo", 4));
        out.push(tick(RI - 12, RO + 6, dialAngle(m.high, m.min, m.max), "mk-hi", 4));
      } else if (m.tgt !== undefined) out.push(tick(RI - 12, RO + 6, dialAngle(m.tgt, m.min, m.max), "mk-tgt", 4.5));
    }
    return out;
  }

  private _btn(m: ThermoModel, x: number, dir: 1 | -1) {
    const off = !m.available || m.mode === "off";
    const d = dir < 0 ? `M${x - 7} 264 h14` : `M${x - 7} 264 h14 M${x} 257 v14`;
    return svg`<g class="rb" role="button" tabindex=${off ? -1 : 0} aria-label=${dir < 0 ? "Lower target" : "Raise target"} aria-disabled=${String(off)}
      @click=${() => this._press(m, dir)} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._press(m, dir); } }}>
      <circle cx=${x} cy="264" r="22"></circle><path d=${d}></path></g>`;
  }

  private _dial(m: ThermoModel) {
    const hero = this._heroText(m);
    const big = hero.length > 4 ? 52 : 76;
    return html`<div class="dialbox"><svg viewBox="0 0 346 292" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Thermostat dial">
      ${this._ringTicks(m)}
      <text class="lim" x="18" y="262" text-anchor="middle">${fmtTemp(Math.round(m.min))}°</text><text class="lim" x="328" y="262" text-anchor="middle">${fmtTemp(Math.round(m.max))}°</text>
      <text class="hero ${m.mode === "off" || !m.available ? "off" : ""}" x=${m.mode === "off" || hero.length > 3 ? 173 : 166} y=${CY + (big === 76 ? 22 : 14)} text-anchor="middle" font-size=${big}>${hero}${m.mode !== "off" && m.available && !m.range ? svg`<tspan font-size="34" dy="-22" letter-spacing="0">°</tspan>` : nothing}</text>
      <text class="sub" x="173" y=${CY + (big === 76 ? 52 : 44)} text-anchor="middle">${this._nowText(m)}</text>
      ${this._btn(m, 115, -1)}${this._btn(m, 231, 1)}
    </svg></div>`;
  }

  private _bar(m: ThermoModel) {
    const width = Math.max(this._w - 24, 120), n = Math.max(20, Math.floor(width / 5.5));
    const lo = m.range ? m.low : m.cur !== undefined && m.tgt !== undefined ? Math.min(m.cur, m.tgt) : undefined;
    const hi = m.range ? m.high : m.cur !== undefined && m.tgt !== undefined ? Math.max(m.cur, m.tgt) : undefined;
    const active = m.available && m.mode !== "off" && lo !== undefined && hi !== undefined && (m.range || m.tone === "heat" || m.tone === "cool");
    const pos = (v: number) => `calc(${(((v - m.min) / (m.max - m.min || 1)) * 100).toFixed(2)}% - 1.5px)`;
    const ticks = [];
    for (let i = 0; i <= n; i++) {
      const v = m.min + ((m.max - m.min) * i) / n;
      const on = active && v >= lo! - 0.001 && v <= hi! + 0.001;
      ticks.push(html`<i class=${on ? (m.range ? "band" : "lit") : ""} style="left:calc(${((i / n) * 100).toFixed(2)}% - 1px)"></i>`);
    }
    return html`<div class="bar">${ticks}
      ${m.available && m.cur !== undefined ? html`<i class="cur" style="left:${pos(m.cur)}"></i>` : nothing}
      ${m.available && m.mode !== "off" && !m.range && m.tgt !== undefined ? html`<i class="tgt" style="left:${pos(m.tgt)}"></i>` : nothing}</div>`;
  }

  private _compact(m: ThermoModel) {
    const off = !m.available || m.mode === "off";
    const hero = this._heroText(m);
    return html`<div class="inner c"><div class="nm">${m.name}</div>
      <div class="hr">
        <button class="rb2" ?disabled=${off} aria-label="Lower target" @click=${() => this._press(m, -1)}><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button>
        <div class="hv ${off ? "off" : ""}">${hero}${off || m.range ? nothing : html`<sup>°</sup>`}</div>
        <button class="rb2" ?disabled=${off} aria-label="Raise target" @click=${() => this._press(m, 1)}><svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10"/></svg></button>
      </div>
      <div class="nw">${this._nowText(m)}</div>
      ${this._bar(m)}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const m = this._shown(buildThermostat(hass, cfg));
    const dark = !!hass.themes?.darkMode;
    const compact = this._h > 0 && this._h < 230;
    const hex = m.tone === "heat" ? (dark ? HEAT.night : HEAT.day) : m.tone === "cool" ? (dark ? COOL.night : COOL.day) : undefined;
    const c = shadesFromHex(hex, dark) ?? (dark ? GREY_NIGHT : GREY_DAY);
    const vars = { "--x1": "50%", "--y1": compact ? "125%" : "112%", "--x2": "50%", "--y2": "50%", "--k": String(m.k), "--k2": "0", "--c0": c.c0, "--c1": c.c1, "--ca": c.ca };
    return html`<ha-card class="${dark ? "dark" : ""} ${m.tone} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)}>
      <div class="bg"></div><div class="grain"></div>
      ${compact ? this._compact(m) : html`<div class="inner"><header><h2>${m.name}</h2></header>${this._dial(m)}${this._modes(m)}</div>`}
    </ha-card>`;
  }
}
