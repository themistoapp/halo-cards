import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import type { HomeAssistant } from "../../shared/types";
import { clamp, fireMoreInfo } from "../../shared/util";
import { fixture } from "./fixture";
import { brightnessPct, buildLights, isDimmable, watchedLights, type HaloLightConfig, type LightTile } from "./logic";
import { styles } from "./styles";

const BULB = svg`<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>`;

export class HaloLightCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-light-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloLightConfig> {
    const ids = Object.keys(hass?.states ?? {}).filter((e) => e.startsWith("light.")).slice(0, 3);
    return { name: "Lights", lights: ids.map((entity) => ({ entity, type: "downlight" as const })) };
  }

  @state() private _config?: HaloLightConfig;
  @state() private _hass?: HomeAssistant;
  /** Brightness being dragged to, per light, until HA catches up. */
  @state() private _drag: Record<string, number> = {};

  setConfig(config: HaloLightConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!Array.isArray(config.lights) || !config.lights.length) throw new Error("Add at least one light");
    this._config = config;
  }

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || watchedLights(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }

  getCardSize() { return 1 + Math.ceil((this._config?.lights.length ?? 1) / 3) * 2; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 4 }; }

  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _set(entity: string, pct: number) {
    if (pct <= 0) this._hass!.callService("light", "turn_off", { entity_id: entity });
    else this._hass!.callService("light", "turn_on", { entity_id: entity, brightness_pct: pct });
  }

  /** Tap toggles, holding opens the light's more-info, dragging sideways dims. */
  private _down(e: PointerEvent, t: LightTile) {
    if (!t.available || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement, rect = el.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY, b0 = brightnessPct(this._hass!.states[t.entity]);
    const dim = isDimmable(this._hass!.states[t.entity]);
    let dragging = false, held = false, last = 0;
    const timer = window.setTimeout(() => { held = true; fireMoreInfo(this, t.entity); }, 500);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(timer);
      if (!dim || held) return;
      if (!dragging && Math.abs(ev.clientX - x0) > 8 && Math.abs(ev.clientX - x0) > Math.abs(ev.clientY - y0)) {
        dragging = true; el.setPointerCapture(ev.pointerId);
      }
      if (!dragging) return;
      const v = clamp(Math.round(b0 + ((ev.clientX - x0) / rect.width) * 100), 0, 100);
      this._drag = { ...this._drag, [t.entity]: v };
      if (Date.now() - last > 250) { last = Date.now(); this._set(t.entity, v); }
    };
    const up = () => {
      clearTimeout(timer);
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      if (dragging) {
        const v = this._drag[t.entity];
        this._set(t.entity, v);
        setTimeout(() => { const { [t.entity]: _, ...rest } = this._drag; this._drag = rest; }, 1500);
      } else if (!held) this._hass!.callService("light", "toggle", { entity_id: t.entity });
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }

  private _tile(t: LightTile) {
    const d = this._drag[t.entity];
    const shown: LightTile = d === undefined ? t : { ...t, on: d > 0, pct: d, intensity: d > 0 ? 0.4 + 0.6 * (d / 100) : 0, status: d > 0 ? `${d}%` : "Off" };
    const art = shown.type === "none"
      ? html`<span class="bulb-i"><svg viewBox="0 0 24 24">${BULB}</svg></span>`
      : fixture(shown, shown.type === "pole" ? 64 : 60);
    return html`<div class="tile ${shown.on ? "on" : ""} ${t.available ? "" : "na"} ${d !== undefined ? "drag" : ""}" role="button" tabindex="0"
      aria-label="${t.name}, ${shown.status}" style=${styleMap({ "--glow": shown.glow, "--i": shown.intensity.toFixed(2) })}
      @pointerdown=${(e: PointerEvent) => this._down(e, t)} @contextmenu=${(e: Event) => e.preventDefault()}
      @keydown=${(e: KeyboardEvent) => { if (t.available && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this._hass!.callService("light", "toggle", { entity_id: t.entity }); } }}>
      <div class="art">${art}</div>
      <div class="tx"><div class="nm">${t.name}</div><div class="st">${shown.status}</div></div>
      ${t.dimmable ? html`<div class="lvl"><i style="width:${shown.on ? shown.pct : 0}%"></i></div>` : nothing}
    </div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const m = buildLights(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    const allOff = cfg.show_all_off !== false && m.total > 1
      ? html`<button class="chip" ?disabled=${!m.nOn} @click=${() => hass.callService("light", "turn_off", { entity_id: m.tiles.filter((t) => t.on).map((t) => t.entity) })}>All off</button>` : nothing;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}">
      <div class="inner">
        <header><h2>${m.name}</h2><div class="r"><span class="chip ${m.nOn ? "" : "off"}"><i></i><span>${m.nOn} of ${m.total} on</span></span>${allOff}</div></header>
        <div class="grid">${m.tiles.map((t) => this._tile(t))}</div>
      </div>
    </ha-card>`;
  }
}
