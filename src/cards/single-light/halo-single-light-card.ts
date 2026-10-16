import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { registerBloomProps } from "../../shared/bloom";
import type { HomeAssistant } from "../../shared/types";
import { clamp, fireMoreInfo, observeSize } from "../../shared/util";
import { fitting } from "./fitting";
import {
  capsOf, css, headline, hsRgb, intensity, isSelected, kelvinRgb, nameOf, pickLayout, presetCss, presetName, presetService, presetsFor, readLight,
  type Caps, type HaloSingleLightConfig, type LightState, type Preset,
} from "./logic";
import { styles } from "./styles";

registerBloomProps();

const BULB = svg`<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>`;
const POWER = svg`<path d="M12 3v8M6.3 6.9a8 8 0 1 0 11.4 0"/>`;
const SUN_LO = svg`<circle cx="12" cy="12" r="3"/><path d="M12 5v1M12 18v1M5 12h1M18 12h1"/>`;
const SUN_HI = svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`;
const line = (p: unknown) => html`<svg class="ln" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

type Tab = "b" | "k" | "h";
/** Values being dragged to, shown until Home Assistant catches up. */
interface Pending { pct?: number; kelvin?: number; hue?: number; on?: boolean }

export class HaloSingleLightCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-single-light-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloSingleLightConfig> {
    return { entity: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("light.")) ?? "light.example" };
  }

  @state() private _config?: HaloSingleLightConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _tab: Tab = "b";
  @state() private _pend: Pending = {};
  @state() private _dragging = false;
  private _unobserve?: () => void;
  private _clear?: number;

  setConfig(config: HaloSingleLightConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Choose a light");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (this._config && (!old || old.states[this._config.entity] !== hass.states[this._config.entity] || old.themes?.darkMode !== hass.themes?.darkMode)) this.requestUpdate();
  }
  getCardSize() { return this._config?.layout === "compact" || this._config?.layout === "mini" ? 2 : 4; }
  /** The size the card starts at follows the chosen layout, so picking Compact or Mini in the config shrinks it too. */
  getGridOptions() {
    switch (this._config?.layout) {
      case "mini": return { columns: 6, rows: 2, min_columns: 3, min_rows: 2 };
      case "compact": return { columns: 12, rows: 2, min_columns: 6, min_rows: 2 };
      case "full": return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
      default: return { columns: 12, rows: 4, min_columns: 3, min_rows: 2 };
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); clearTimeout(this._clear); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private get _id() { return this._config!.entity; }
  private _call(service: string, data: Record<string, unknown> = {}) { this._hass!.callService("light", service, { entity_id: this._id, ...data }); }
  private _toggle() { this._call("toggle"); }
  /** What HA says, with anything being dragged laid over it. */
  private _shown(l: LightState): LightState {
    const p = this._pend;
    if (p.pct === undefined && p.kelvin === undefined && p.hue === undefined) return l;
    const out = { ...l, on: l.available, pct: p.pct ?? (l.pct || 100) };
    if (p.kelvin !== undefined) Object.assign(out, { mode: "temp", kelvin: p.kelvin, glow: kelvinRgb(p.kelvin) });
    if (p.hue !== undefined) Object.assign(out, { mode: "colour", hue: p.hue, sat: 1, glow: hsRgb(p.hue, 1) });
    return out;
  }
  private _settle() { clearTimeout(this._clear); this._clear = window.setTimeout(() => { this._pend = {}; }, 1500); }

  /** Tap toggles, holding opens more-info. */
  private _press(e: PointerEvent) {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement, x0 = e.clientX, y0 = e.clientY;
    let held = false;
    const timer = window.setTimeout(() => { held = true; fireMoreInfo(this, this._id); }, 500);
    const move = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) { clearTimeout(timer); held = true; } };
    const up = () => {
      clearTimeout(timer);
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", cancel);
      if (!held) this._toggle();
    };
    const cancel = () => { held = true; up(); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", cancel);
  }
  private _key(e: KeyboardEvent) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggle(); } }

  /** Drag along a track (brightness, warmth or colour). The value follows the finger and is sent every 250 ms and on release. */
  private _drag(e: PointerEvent, tab: Tab, caps: Caps) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    let last = 0;
    const at = (ev: PointerEvent) => {
      const f = clamp((ev.clientX - r.left - (tab === "b" ? 0 : 14)) / (r.width - (tab === "b" ? 0 : 28)), 0, 1);
      if (tab === "b") return { pct: clamp(Math.round(f * 100), 1, 100) };
      if (tab === "k") return { kelvin: Math.round((caps.kMin + f * (caps.kMax - caps.kMin)) / 50) * 50 };
      return { hue: Math.round(f * 359) };
    };
    const send = (p: Pending) => {
      if (p.pct !== undefined) this._call("turn_on", { brightness_pct: p.pct });
      else if (p.kelvin !== undefined) this._call("turn_on", { color_temp_kelvin: p.kelvin });
      else if (p.hue !== undefined) this._call("turn_on", { hs_color: [p.hue, 100] });
    };
    const move = (ev: PointerEvent) => {
      this._pend = { ...this._pend, ...at(ev) };
      if (Date.now() - last > 250) { last = Date.now(); send(at(ev)); }
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      this._dragging = false;
      send(at(ev)); this._settle();
    };
    clearTimeout(this._clear);
    el.setPointerCapture(e.pointerId);
    this._dragging = true;
    this._pend = { ...this._pend, ...at(e) };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }
  private _trackKey(e: KeyboardEvent, tab: Tab, l: LightState, caps: Caps) {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    if (tab === "b") { const pct = clamp((l.on ? l.pct : 0) + d * 5, 1, 100); this._pend = { pct }; this._call("turn_on", { brightness_pct: pct }); }
    else if (tab === "k") { const kelvin = clamp(l.kelvin + d * 100, caps.kMin, caps.kMax); this._pend = { kelvin }; this._call("turn_on", { color_temp_kelvin: kelvin }); }
    else { const hue = (Math.round(l.hue) + d * 5 + 360) % 360; this._pend = { hue }; this._call("turn_on", { hs_color: [hue, 100] }); }
    this._settle();
  }

  /** Mini: tap toggles, hold opens more-info, sliding sideways dims. */
  private _miniDown(e: PointerEvent, l: LightState, caps: Caps) {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, b0 = l.on ? l.pct : 0;
    let dragging = false, held = false, last = 0;
    const timer = window.setTimeout(() => { held = true; fireMoreInfo(this, this._id); }, 500);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(timer);
      if (!caps.dimmable || held) return;
      if (!dragging && Math.abs(ev.clientX - x0) > 8 && Math.abs(ev.clientX - x0) > Math.abs(ev.clientY - y0)) { dragging = true; el.setPointerCapture(ev.pointerId); this._dragging = true; }
      if (!dragging) return;
      const pct = clamp(Math.round(b0 + ((ev.clientX - x0) / r.width) * 100), 1, 100);
      this._pend = { pct };
      if (Date.now() - last > 250) { last = Date.now(); this._call("turn_on", { brightness_pct: pct }); }
    };
    const up = () => {
      clearTimeout(timer);
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      if (dragging) { this._dragging = false; this._call("turn_on", { brightness_pct: this._pend.pct }); this._settle(); }
      else if (!held) this._toggle();
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }

  private _icon() {
    return this._config!.icon ? html`<ha-icon .icon=${this._config!.icon}></ha-icon>` : line(BULB);
  }
  private _track(tab: Tab, l: LightState, caps: Caps) {
    const down = (e: PointerEvent) => this._drag(e, tab, caps), key = (e: KeyboardEvent) => this._trackKey(e, tab, l, caps);
    const drag = this._dragging ? "drag" : "";
    if (tab === "b") {
      const pct = l.on ? l.pct : 0;
      return html`<div class="track ${drag}" role="slider" tabindex="0" aria-label="Brightness" aria-valuemin="1" aria-valuemax="100" aria-valuenow=${pct} @pointerdown=${down} @keydown=${key}>
        <div class="fill" style="width:${pct}%"></div>${pct ? html`<div class="grip" style="left:${pct}%"></div>` : nothing}
        <span class="ti l">${line(SUN_LO)}</span><span class="ti r">${line(SUN_HI)}</span></div>`;
    }
    const temp = tab === "k", p = temp ? (l.kelvin - caps.kMin) / (caps.kMax - caps.kMin) : l.hue / 360;
    const active = l.on && (temp ? l.mode === "temp" : l.mode === "colour");
    const scale = temp ? [0, .2, .4, .6, .8, 1].map((f) => `${css(kelvinRgb(caps.kMin + f * (caps.kMax - caps.kMin)))} ${f * 100}%`).join(", ") : "";
    return html`<div class="track ${tab} ${drag}" role="slider" tabindex="0" aria-label=${temp ? "Warmth" : "Colour"} aria-valuenow=${Math.round(temp ? l.kelvin : l.hue)}
      style=${temp ? `--kscale:${scale}` : ""} @pointerdown=${down} @keydown=${key}>
      <div class="knob ${active ? "" : "idle"}" style="left:calc(14px + ${(clamp(p, 0, 1) * 100).toFixed(1)} * (100% - 28px) / 100)"></div></div>`;
  }
  private _swatches(list: Preset[], l: LightState, caps: Caps, small = false) {
    if (!list.length) return nothing;
    const one = (p: Preset) => html`<button aria-label=${presetName(p)} title=${presetName(p)} aria-pressed=${isSelected(p, l) ? "true" : "false"} style="--c:${presetCss(p)}"
      @click=${() => { this._pend = {}; this._call("turn_on", presetService(p, caps)); }}></button>`;
    const whites = list.filter((p) => p.kelvin), colours = list.filter((p) => !p.kelvin);
    return html`<div class="sw ${small ? "sm" : ""} ${list.length < 6 ? "few" : ""}">${whites.map(one)}${!small && whites.length && colours.length ? html`<span class="div"></span>` : nothing}${colours.map(one)}</div>`;
  }
  private _tabs(caps: Caps): Tab[] {
    const t: Tab[] = [];
    if (caps.dimmable) t.push("b");
    if (caps.temp) t.push("k");
    if (caps.colour) t.push("h");
    return t;
  }

  private _full(name: string, title: string, l: LightState, caps: Caps, presets: Preset[]) {
    const fit = this._config!.fitting;
    const pic = !!fit && fit !== "none";
    const tabs = this._tabs(caps), tab = tabs.includes(this._tab) ? this._tab : tabs[0];
    const labels: Record<Tab, string> = { b: "Brightness", k: "Warmth", h: "Colour" };
    const press = (e: PointerEvent) => this._press(e), key = (e: KeyboardEvent) => this._key(e);
    return html`<div class="inner ${pic ? "pic" : ""}">
      ${pic ? html`<div class="corner ${fit}" role="button" tabindex="0" aria-label="${name}: turn on or off" @pointerdown=${press} @keydown=${key} @contextmenu=${(e: Event) => e.preventDefault()}>${fitting(fit)}</div>` : nothing}
      <header>
        ${pic ? html`<span class="tchip bare"><span class="label">${name}</span></span>`
          : html`<button class="tchip" aria-label="${name}: turn on or off" @pointerdown=${press} @keydown=${key} @contextmenu=${(e: Event) => e.preventDefault()}><span class="ico">${this._icon()}</span><span class="label">${name}</span></button>`}
        ${pic ? nothing : html`<button class="pw" aria-label="Power" aria-pressed=${l.on ? "true" : "false"} ?disabled=${!l.available} @click=${() => this._toggle()}>${line(POWER)}</button>`}
      </header>
      <div class="head"><div class="hl">${title}</div></div>
      <div class="spacer"></div>
      ${tabs.length > 1 ? html`<div class="seg" role="group" aria-label="Adjust">${tabs.map((t) => html`<button aria-pressed=${t === tab ? "true" : "false"} @click=${() => { this._tab = t; }}>${labels[t]}</button>`)}</div>` : nothing}
      ${tab && l.available ? this._track(tab, l, caps) : nothing}
      ${l.available ? this._swatches(presets, l, caps) : nothing}
    </div>`;
  }
  private _thumb(name: string) {
    const fit = this._config!.fitting;
    return fit && fit !== "none" ? html`<span class="thumb">${fitting(fit)}</span>` : html`<span class="cico">${this._icon()}</span>`;
  }
  private _compact(name: string, title: string, l: LightState, caps: Caps, presets: Preset[]) {
    return html`<div class="inner compact"><div class="crow">
        <button class="tog" aria-label="${name}: turn on or off" @pointerdown=${(e: PointerEvent) => this._press(e)} @keydown=${(e: KeyboardEvent) => this._key(e)} @contextmenu=${(e: Event) => e.preventDefault()}>${this._thumb(name)}</button>
        <div class="ctx"><div class="nm">${name}</div><div class="st">${title}</div></div>
        ${l.available ? this._swatches(presets.slice(0, 3), l, caps, true) : nothing}
      </div>${caps.dimmable && l.available ? this._track("b", l, caps) : nothing}</div>`;
  }
  private _mini(name: string, title: string, l: LightState, caps: Caps) {
    return html`<div class="inner mini" role="button" tabindex="0" aria-label="${name}, ${title}" @pointerdown=${(e: PointerEvent) => this._miniDown(e, l, caps)}
      @keydown=${(e: KeyboardEvent) => this._key(e)} @contextmenu=${(e: Event) => e.preventDefault()}>
      ${this._thumb(name)}<div class="nm">${name}</div>
      ${this._dragging ? html`<div class="lvl"><i style="width:${l.pct}%"></i></div>` : nothing}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const s = hass.states[cfg.entity];
    const caps = capsOf(s), presets = presetsFor(cfg, caps);
    const l = this._shown(readLight(s, cfg));
    const name = nameOf(hass, cfg), title = headline(l, presets);
    const dark = !!hass.themes?.darkMode;
    const layout = pickLayout(cfg, this._w, this._h);
    const i = intensity(l.on, caps.dimmable, l.pct);
    const pic = !!cfg.fitting && cfg.fitting !== "none";
    // The glow: gathered behind the picture in the top-right corner, or spreading from the icon on the small sizes.
    const [bx, by, bw, bh] = layout === "full" ? (pic ? ["92%", "4%", 120, 130] : ["14%", "6%", 130, 120]) : layout === "compact" ? ["0%", "40%", 130, 170] : ["8%", "10%", 170, 190];
    const vars = { "--glow": css(l.glow), "--c0": css(l.glow), "--i": i.toFixed(2), "--bx": bx, "--by": by, "--bw": (bw * i).toFixed(1), "--bh": (bh * i).toFixed(1) };
    const body = layout === "mini" ? this._mini(name, title, l, caps) : layout === "compact" ? this._compact(name, title, l, caps, presets) : this._full(name, title, l, caps, presets);
    return html`<ha-card class="${dark ? "dark" : ""} ${l.on ? "on" : "off"} ${l.available ? "" : "na"} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)}>
      <div class="bg"></div><div class="grain"></div>${body}
    </ha-card>`;
  }
}
