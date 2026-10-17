import { LitElement, html, nothing, svg, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { gestures, runAction, type Gesture } from "../../shared/actions";
import { registerBloomProps } from "../../shared/bloom";
import { setLocale } from "../../shared/format";
import { isGradientName } from "../../shared/looks";
import { PALETTE, chartColour, graphColours } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { icon as weatherIcon } from "../weather/icons";
import {
  BADGE_BLOOM, badgeAction, buildBooleanBadge, buildGaugeBadge, buildThermostatBadge, buildWeatherBadge, canToggle, fmtTemp, showName, softBloom, stateColour, themeOf,
  type BadgeBase, type BooleanBadgeConfig, type GaugeBadgeConfig, type RainFc, type ThermostatBadgeConfig, type WeatherBadgeConfig,
} from "./logic";
import { badgeStyles } from "./styles";

const f2 = (n: number) => n.toFixed(2);

/** 270° ring, open at the bottom, filled to `frac`. pathLength 100 makes the fill a dash of frac * 100. */
const ARC = "M6.22 21.78A11 11 0 1 1 21.78 21.78";
function ring(frac: number, stroke: string, text?: string) {
  const size = text && text.length > 3 ? 7.5 : 8.5;
  return svg`<svg class="r" viewBox="0 0 28 28" aria-hidden="true"><path class="trk" d=${ARC} pathLength="100"></path>
    <path class="fil" d=${ARC} pathLength="100" style=${`stroke:${stroke}`} stroke-dasharray=${`${f2(frac * 100)} 100`}></path>
    ${text ? svg`<text x="14" y="17" text-anchor="middle" style=${`font-size:${size}px`}>${text}</text>` : nothing}</svg>`;
}

const GLYPHS: Record<string, string> = {
  sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 9V3M9 6l3 3 3-3M3 18h18M5 14l1.4 1M19 14l-1.4 1"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0M12 3v6M9 6l3-3 3 3M3 18h18M5 14l1.4 1M19 14l-1.4 1"/>',
};
const DROP = "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z";

/** Shared by the four badges: config, hass, the pill and its gestures. */
abstract class HaloBadge<C extends BadgeBase> extends LitElement {
  static override styles = badgeStyles;
  @state() protected _config?: C;
  @state() protected _hass?: HomeAssistant;
  private _g = gestures((g) => this._act(g), () => !!this._config?.double_tap_action?.action && this._config.double_tap_action.action !== "none");

  constructor() { super(); registerBloomProps(); }

  setConfig(config: C) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._check(config);
    this._config = config;
  }
  protected _check(_c: C) { /* each badge says what it needs */ }
  protected _watched(): string[] { return this._config?.entity ? [this._config.entity] : []; }

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || this._watched().some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  get hass() { return this._hass!; }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  protected _tapToggles() { return false; }
  private _act(g: Gesture) {
    if (!this._hass || !this._config) return;
    runAction(this, this._hass, badgeAction(this._config, g, this._tapToggles()), this._config.entity);
  }

  protected get _dark() { return !!this._hass?.themes?.darkMode; }

  /** The pill. `look` overrides the configured theme (the on/off badge's state colours). */
  protected _pill(o: { cls?: string; look?: string; style?: Record<string, string>; lead: unknown; name: string; value?: unknown; label: string; bloom?: unknown; available?: boolean; role?: string; pressed?: boolean }) {
    const cfg = this._config!, look = o.look ?? themeOf(cfg.theme), grad = isGradientName(look);
    const named = showName(cfg);
    const iconOnly = o.value === undefined && !named;
    const cls = ["hb", grad ? `grad g-${look}` : `t-${look}`, this._dark ? "dark" : "", cfg.shadow === false ? "" : "shadow", iconOnly ? "icon-only" : "",
      o.available === false ? "unavailable" : "", o.cls ?? ""].filter(Boolean).join(" ");
    const tx = iconOnly ? nothing : o.value === undefined
      ? html`<span class="tx only"><span class="nm">${o.name}</span></span>`
      : html`<span class="tx">${named ? html`<span class="nm">${o.name}</span>` : nothing}<span class="st">${o.value}</span></span>`;
    const g = this._g;
    return html`<div class=${cls} style=${styleMap(o.style ?? {})} role=${o.role ?? "button"} tabindex="0" aria-label=${`${o.name}: ${o.label}`}
      aria-checked=${o.role === "switch" ? String(!!o.pressed) : nothing}
      @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel} @pointerleave=${g.cancel} @keydown=${g.key}
      @contextmenu=${(e: Event) => e.preventDefault()}>${o.bloom ?? nothing}${o.lead}${tx}</div>`;
  }

  /** The configured mdi icon, else the entity's own icon for its state. */
  protected _icon(iconName?: string) {
    const s = this._hass?.states[this._config?.entity ?? ""];
    if (!iconName && s && customElements.get("ha-state-icon")) return html`<ha-state-icon .hass=${this._hass} .stateObj=${s}></ha-state-icon>`;
    return html`<ha-icon .icon=${iconName || "mdi:circle-outline"}></ha-icon>`;
  }
}

/* ---------- Thermostat ---------- */

export class HaloThermostatBadge extends HaloBadge<ThermostatBadgeConfig> {
  static getConfigElement() { return document.createElement("halo-thermostat-badge-editor"); }
  static getStubConfig(hass?: HomeAssistant) {
    const id = Object.keys(hass?.states ?? {}).find((e) => e.startsWith("climate.")) ?? Object.keys(hass?.states ?? {}).find((e) => hass!.states[e].attributes.device_class === "temperature");
    return { entity: id ?? "" };
  }
  protected override _check(c: ThermostatBadgeConfig) { if (!c.entity) throw new Error("Choose a climate entity or a temperature sensor"); }

  private _dial(m: ReturnType<typeof buildThermostatBadge>) {
    const N = 28, C = 16, span = m.max - m.min || 1;
    const ang = (v: number) => ((-135 + (270 * Math.min(Math.max(v - m.min, 0), span)) / span) * Math.PI) / 180;
    const ln = (a: number, r1: number, r2: number, cls: string) =>
      svg`<line class=${cls} x1=${f2(C + r1 * Math.sin(a))} y1=${f2(C - r1 * Math.cos(a))} x2=${f2(C + r2 * Math.sin(a))} y2=${f2(C - r2 * Math.cos(a))}></line>`;
    const ticks = [];
    for (let i = 0; i <= N; i++) {
      const v = m.min + (span * i) / N, on = m.lit && v >= m.lit.from - 0.001 && v <= m.lit.to + 0.001;
      ticks.push(ln(ang(v), 12.6, 15.4, on ? (m.lit!.band ? "tk band" : "tk lit") : "tk"));
    }
    const marks = [
      m.low !== undefined ? ln(ang(m.low), 10.6, 16.6, "lo") : nothing, m.high !== undefined ? ln(ang(m.high), 10.6, 16.6, "hi") : nothing,
      m.tgt !== undefined ? ln(ang(m.tgt), 10.6, 16.6, "tgt") : nothing, m.cur !== undefined ? ln(ang(m.cur), 10.6, 16.6, "cur") : nothing,
    ];
    const t = m.cur === undefined ? "–" : fmtTemp(m.cur);
    return html`<span class="ic dial"><svg viewBox="0 0 32 32" aria-hidden="true">${ticks}${marks}
      <text x="16" y="19.4" text-anchor="middle" style=${`font-size:${t.length > 3 ? 8.5 : 9.5}px`}>${t}</text></svg></span>`;
  }

  override render() {
    const m = buildThermostatBadge(this._hass!, this._config!), look = themeOf(this._config!.theme);
    // Black on white and white on black keep their own day or night bloom whatever the dashboard's mode.
    const night = look === "light" ? false : look === "dark" ? true : this._dark;
    const c = m.bloomHex && !isGradientName(look) && m.bloom !== "none" ? softBloom(m.bloomHex, night) : undefined;
    const style: Record<string, string> = m.tone ? { "--tone": m.tone } : {};
    if (c) { const [bw, bh] = BADGE_BLOOM[m.bloom as "rest" | "active"]; Object.assign(style, { "--c0": c.c0, "--c1": c.c1, "--bw": String(bw), "--bh": String(bh) }); }
    return this._pill({ cls: "th", style, lead: this._dial(m), name: m.name, label: m.label, available: m.available, bloom: c ? html`<i class="bloom"></i>` : undefined });
  }
}

/* ---------- Gauge ---------- */

export class HaloGaugeBadge extends HaloBadge<GaugeBadgeConfig> {
  static getConfigElement() { return document.createElement("halo-gauge-badge-editor"); }
  static getStubConfig(hass?: HomeAssistant) {
    const id = Object.keys(hass?.states ?? {}).find((e) => e.startsWith("sensor.") && hass!.states[e].attributes.unit_of_measurement === "%");
    return { entity: id ?? "" };
  }
  protected override _check(c: GaugeBadgeConfig) { if (!c.entity) throw new Error("Choose an entity"); }

  override render() {
    const cfg = this._config!, m = buildGaugeBadge(this._hass!, cfg);
    const look = themeOf(cfg.theme), grad = isGradientName(look);
    const stroke = grad ? "#fff" : chartColour(m.colour ?? "grey", look === "light" ? false : look === "dark" ? true : this._dark) ?? "var(--ink-2)";
    if ((cfg.inside ?? "value") === "value") {
      const txt = m.unit === "%" && m.value.length < 3 ? `${m.value}%` : m.value;
      return this._pill({ cls: "ga", lead: html`<span class="ic ring">${ring(m.frac, stroke, txt)}</span>`, name: m.name, label: m.label, available: m.available });
    }
    const unit = m.unit === "%" || /^°/.test(m.unit) ? html`${m.unit}` : m.unit ? html`<small>${m.unit}</small>` : nothing;
    return this._pill({ cls: "ga", lead: html`<span class="ic ring" style=${grad ? "" : `color:${stroke}`}>${ring(m.frac, stroke)}${this._icon(cfg.icon)}</span>`,
      name: m.name, value: html`${m.value}${unit}`, label: m.label, available: m.available });
  }
}

/* ---------- Weather ---------- */

export class HaloWeatherBadge extends HaloBadge<WeatherBadgeConfig> {
  static getConfigElement() { return document.createElement("halo-weather-badge-editor"); }
  static getStubConfig(hass?: HomeAssistant) { return { entity: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("weather.")) ?? "", show: "now" }; }
  protected override _check(c: WeatherBadgeConfig) { if ((c.show ?? "now") !== "sun" && !c.entity) throw new Error("Choose a weather entity"); }
  protected override _watched() { return [...super._watched(), "sun.sun"]; }

  @state() private _fc: { daily?: RainFc[]; hourly?: RainFc[] } = {};
  private _subs: (() => void)[] = [];
  private _subKey = "";
  private _gen = 0;

  override setConfig(config: WeatherBadgeConfig) { super.setConfig(config); this._subscribe(); }
  override set hass(hass: HomeAssistant) { super.hass = hass; this._subscribe(); }
  override get hass() { return super.hass; }
  override connectedCallback() { super.connectedCallback(); this._subscribe(); }
  override disconnectedCallback() { super.disconnectedCallback(); this._unsubscribe(); }

  /** Rain needs the forecast, which Home Assistant only sends on request: daily and hourly, as the entity has them (not every daily forecast has a chance of rain). */
  private _subscribe() {
    const hass = this._hass, cfg = this._config;
    if (!hass?.connection?.subscribeMessage || !cfg || !this.isConnected || cfg.show !== "rain" || !cfg.entity) { if (cfg?.show !== "rain") this._unsubscribe(); return; }
    const f = Number(hass.states[cfg.entity]?.attributes.supported_features ?? 0);
    const types = [...(f & 1 ? ["daily"] : []), ...(f & 2 ? ["hourly"] : [])];
    const key = `${cfg.entity}|${types.join()}`;
    if (!types.length || key === this._subKey) return;
    this._unsubscribe();
    this._subKey = key;
    const gen = this._gen;
    for (const type of types) {
      hass.connection.subscribeMessage<{ forecast: RainFc[] | null }>(
        (msg) => { if (gen === this._gen) this._fc = { ...this._fc, [type]: msg.forecast ?? [] }; },
        { type: "weather/subscribe_forecast", forecast_type: type, entity_id: cfg.entity },
      ).then((unsub) => { if (gen === this._gen) this._subs.push(unsub); else unsub(); }, () => { /* no forecast of that type */ });
    }
  }
  private _unsubscribe() {
    this._gen++;
    this._subKey = "";
    for (const u of this._subs) { try { u(); } catch { /* already closed */ } }
    this._subs = [];
    this._fc = {};
  }

  override render() {
    const cfg = this._config!, m = buildWeatherBadge(this._hass!, cfg, this._fc);
    let glyph: TemplateResult;
    if (m.icon === "drop") {
      // Fixed paths, never from config. The drop fills from the bottom to today's chance of rain.
      const y = f2(21 - (18 * (m.rain ?? 0)) / 100);
      glyph = html`<svg class="g drop" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="rain"><rect x="0" y=${y} width="24" height="24"></rect></clipPath></defs>
        <path d=${DROP} fill="currentColor" stroke="none" clip-path="url(#rain)" opacity=".85"></path><path d=${DROP}></path></svg>`;
    } else if (m.icon === "sunrise" || m.icon === "sunset") {
      glyph = html`<svg class="g" viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(GLYPHS[m.icon])}</svg>`;
    } else glyph = html`${weatherIcon(m.icon, 15)}`;
    return this._pill({ cls: "we", lead: html`<span class="ic">${glyph}</span>`, name: m.name, value: m.value, label: m.label, available: m.available });
  }
}

/* ---------- On / off ---------- */

export class HaloBooleanBadge extends HaloBadge<BooleanBadgeConfig> {
  static getConfigElement() { return document.createElement("halo-boolean-badge-editor"); }
  static getStubConfig(hass?: HomeAssistant) {
    return { entity: Object.keys(hass?.states ?? {}).find((e) => /^(light|switch|input_boolean)\./.test(e)) ?? "" };
  }
  protected override _check(c: BooleanBadgeConfig) { if (!c.entity) throw new Error("Choose an entity"); }
  protected override _tapToggles() { return canToggle(this._config?.entity); }

  override render() {
    const cfg = this._config!, m = buildBooleanBadge(this._hass!, cfg);
    const sc = stateColour(m.on ? cfg.on_colour : cfg.off_colour);
    const style: Record<string, string> = {};
    if (sc.colour) {
      const named = sc.colour.toLowerCase() in PALETTE ? PALETTE[sc.colour.toLowerCase() as keyof typeof PALETTE][this._dark ? 1 : 0] : undefined;
      const g0 = named?.g0 ?? graphColours(sc.colour, this._dark ? "night" : "day").g0, ln = named?.ln ?? sc.colour;
      if (m.on) Object.assign(style, { "--on-bg": `color-mix(in srgb, ${g0} ${this._dark ? 40 : 30}%, var(--surface))`, "--on-ic-bg": ln, "--on-ic": this._dark ? "#141416" : "#fff" });
      else style["--surface"] = `color-mix(in srgb, ${g0} 22%, var(--ha-card-background, var(--card-background-color, #fff)))`;
    }
    const toggles = this._tapToggles() && !cfg.tap_action;
    return this._pill({ cls: `bool ${m.on ? "on" : "off"}`, look: sc.look, style, lead: html`<span class="ic">${this._icon(cfg.icon)}</span>`,
      name: m.name, value: m.state, label: m.label, available: m.available, role: toggles ? "switch" : "button", pressed: m.on });
  }
}
