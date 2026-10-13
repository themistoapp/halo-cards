import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import type { HassEntity, HomeAssistant } from "../../shared/types";
import { fireMoreInfo, isAvailable, unitOf } from "../../shared/util";
import { linesFor, pickGreeting, toneAt, type CustomGreeting, type Tone } from "../today/greetings";
import { DEFAULTS, buildTodayWeather, minutesOf, partOfDay, triggersOf } from "../today/logic";
import { icon } from "../weather/icons";

export type ChipRow = string | { entity: string; name?: string };
export interface HaloTitleConfig {
  type: string;
  /** Greeting (date and a greeting), date (the day as a big number), or heading (a section title on the dashboard, no card behind it). */
  style?: "greeting" | "date" | "heading";
  title?: string;
  /** Heading: plain text, or a template ({{ ... }}) rendered by Home Assistant. */
  subtitle?: string;
  chips?: ChipRow[];
  name?: string;
  greeting?: Tone;
  watershed?: boolean;
  watershed_from?: string;
  greetings?: CustomGreeting[];
  weather?: string;
  shadow?: boolean;
}

const GLOW = {
  morning: ["#f6c48a", "#fbe3c4", "#6b4a22", "#2e2316"], midday: ["#a9cdf2", "#d9e9f8", "#23466e", "#172838"],
  evening: ["#f0a08a", "#f6cfc4", "#6a2f3a", "#2a1a22"], night: ["#aab3ee", "#dfe3f8", "#26306b", "#161a33"],
};
const isTemplate = (s?: string) => !!s && /\{\{|\{%/.test(s);
const chipOf = (c: ChipRow) => (typeof c === "string" ? { entity: c } : c);

export class HaloTitleCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, css`
    ha-card { height: auto; min-height: 100%; background: var(--surface); border-radius: var(--ha-card-border-radius, 18px); isolation: isolate; }
    .bg { position: absolute; inset: 0; z-index: -2; background: radial-gradient(ellipse 90% 170px at 0% -40px, var(--c0) 0%, var(--c1) 45%, transparent 100%), var(--surface); }
    .grain { position: absolute; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: overlay; opacity: .3;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
    .ic { flex: none; display: block; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; color: var(--ink-2); }
    .ic.sun, .ic.pc { color: #c98a0e; } .ic.moon, .ic.pcn { color: #4a58c4; } .ic.rain, .ic.pour, .ic.snow { color: #2f86cf; }
    .dark .ic.sun, .dark .ic.pc { color: #f2b84a; } .dark .ic.moon, .dark .ic.pcn { color: #a9b4ff; } .dark .ic.rain, .dark .ic.pour, .dark .ic.snow { color: #6cc3ec; }
    .ttl { padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
    .tx { flex: 1; min-width: 0; }
    h2 { margin: 5px 0 0; font-size: 24px; line-height: 28px; font-weight: 600; letter-spacing: -.03em; text-wrap: balance; cursor: pointer; transition: opacity .25s; }
    .swap { opacity: 0; }
    .wx { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; cursor: pointer; }
    .wx .t { display: flex; align-items: center; gap: 6px; font-size: 24px; line-height: 28px; font-weight: 600; letter-spacing: -.04em; }
    .wx .c { font: 500 10.5px/14px var(--code-font-family, ui-monospace, monospace); color: var(--ink-2); white-space: nowrap; }
    .ttl.date { align-items: center; }
    .num { font-size: 60px; line-height: 52px; font-weight: 600; letter-spacing: -.06em; flex: none; font-variant-numeric: tabular-nums; }
    .ttl.date h3 { margin: 0; font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -.02em; }
    .ttl.date .mo { font-size: 13px; line-height: 18px; color: var(--ink-2); }
    .ttl.date p { margin: 4px 0 0; font-size: 13px; line-height: 18px; color: var(--ink-2); cursor: pointer; transition: opacity .25s; }
    /* Heading: no card, sits on the dashboard */
    ha-card.heading { background: none; box-shadow: none; border: 0; overflow: visible; }
    .head { display: flex; gap: 8px 12px; align-items: flex-end; flex-wrap: wrap; padding: 4px 4px 2px; }
    .head .tx { min-width: 140px; }
    .head h2 { margin: 0; font-size: 22px; line-height: 28px; cursor: default; }
    .head .sub { font-size: 13px; line-height: 18px; color: var(--ink-2); }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chips button { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; font: inherit; font-size: 12px; line-height: 16px; font-weight: 500; cursor: pointer;
      background: color-mix(in srgb, var(--surface) 80%, transparent); border: 1px solid var(--line); color: var(--ink); white-space: nowrap; }
    .chips ha-state-icon, .chips ha-icon { --mdc-icon-size: 14px; display: inline-flex; }
    @media (prefers-reduced-motion: reduce) { h2, .ttl.date p { transition: none; } }
  `];

  static getConfigElement() { return document.createElement("halo-title-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloTitleConfig> {
    return { style: "greeting", greeting: "cheeky", weather: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("weather.")) };
  }

  @state() private _config?: HaloTitleConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _sub?: string;
  @state() private _offset = 0;
  @state() private _swap = false;
  private _unsub?: () => void;
  private _tpl = "";
  private _timer?: number;

  setConfig(config: HaloTitleConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = config;
    this._template();
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    this._template();
    const ids = [this._config.weather, ...(this._config.chips ?? []).map((c) => chipOf(c).entity)].filter((x): x is string => !!x);
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || ids.some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return this._config?.style === "heading" ? 1 : 2; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 3 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._timer = window.setInterval(() => this.requestUpdate(), 60_000);
    this._template();
  }
  override disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._timer); this._unsub?.(); this._unsub = undefined; this._tpl = ""; }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /** A subtitle with {{ }} is rendered by Home Assistant and pushed again whenever it changes. */
  private _template() {
    const t = this._config?.style === "heading" && isTemplate(this._config.subtitle) ? this._config.subtitle! : "";
    if (t === this._tpl || !this._hass?.connection || !this.isConnected) return;
    this._unsub?.(); this._unsub = undefined; this._tpl = t; this._sub = undefined;
    if (!t) return;
    this._hass.connection.subscribeMessage<{ result?: unknown; error?: string }>(
      (m) => { if (this._tpl === t) this._sub = m.error ? undefined : String(m.result ?? ""); },
      { type: "render_template", template: t },
    ).then((u) => { if (this._tpl === t) this._unsub = u; else u(); }, () => { /* template error */ });
  }

  private _chip(c: { entity: string; name?: string }) {
    const hass = this._hass!, s: HassEntity | undefined = hass.states[c.entity];
    const value = !s ? "–" : hass.formatEntityState?.(s) ?? `${s.state}${unitOf(s) ? ` ${unitOf(s)}` : ""}`;
    const text = c.name ? `${c.name} ${value.charAt(0).toLowerCase()}${value.slice(1)}` : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    return html`<button @click=${() => fireMoreInfo(this, c.entity)} title=${String(s?.attributes.friendly_name ?? c.entity)}>
      ${s && customElements.get("ha-state-icon") ? html`<ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>` : nothing}${text}</button>`;
  }

  private _next() {
    this._swap = true;
    setTimeout(() => { this._offset++; this._swap = false; }, 200);
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const dark = !!hass.themes?.darkMode, locale = hass.locale?.language ?? "en-GB", now = new Date();
    const style = cfg.style ?? "greeting";
    if (style === "heading") {
      const sub = isTemplate(cfg.subtitle) ? this._sub : cfg.subtitle;
      const chips = (cfg.chips ?? []).map(chipOf).filter((c) => c.entity);
      return html`<ha-card class="heading ${dark ? "dark" : ""}"><div class="head">
        <div class="tx"><h2>${cfg.title ?? ""}</h2>${sub ? html`<div class="sub">${sub}</div>` : nothing}</div>
        ${chips.length ? html`<div class="chips">${chips.map((c) => this._chip(c))}</div>` : nothing}</div></ha-card>`;
    }
    const wx = cfg.weather && isAvailable(hass.states[cfg.weather]) ? buildTodayWeather(hass, cfg.weather, {}, now, 4) : undefined;
    const tone = toneAt(cfg.greeting ?? "cheeky", !!cfg.watershed, minutesOf(cfg.watershed_from, DEFAULTS.watershed_from), now);
    const fired = triggersOf({ now, weather: wx, vehicles: [], hasCalendars: false });
    const name = cfg.name ?? hass.user?.name?.split(" ")[0] ?? "";
    const text = cfg.title || pickGreeting(linesFor(fired, tone, name, cfg.greetings), now, this._offset, `${tone}|${fired.map((f) => f.id).join()}`);
    const g = GLOW[partOfDay(now)], c = dark ? [g[2], g[3]] : [g[0], g[1]];
    const weather = wx ? html`<div class="wx" @click=${() => fireMoreInfo(this, cfg.weather!)}><div class="t">${icon(wx.icon, 24, 1.6)}${wx.temp ?? "–"}°</div><div class="c">${wx.cond}</div></div>` : nothing;
    const body = style === "date"
      ? html`<div class="ttl date"><div class="num">${now.getDate()}</div><div class="tx"><h3>${now.toLocaleDateString(locale, { weekday: "long" })}</h3>
          <div class="mo">${now.toLocaleDateString(locale, { month: "long", year: "numeric" })}</div><p class=${this._swap ? "swap" : ""} @click=${this._next}>${text}</p></div>${weather}</div>`
      : html`<div class="ttl"><div class="tx"><div class="lab">${now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</div>
          <h2 class=${this._swap ? "swap" : ""} @click=${this._next}>${text}</h2></div>${weather}</div>`;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap({ "--c0": c[0], "--c1": c[1] })}>
      <div class="bg"></div><div class="grain"></div>${body}</ha-card>`;
  }
}
