import { LitElement, css, html, nothing, svg } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import { clock, setLocale } from "../../shared/format";
import { PALETTE, tileStyles } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo } from "../../shared/util";
import { daylight, duration, skyAt, skyBackground, sunTimes, type HaloBackdropConfig } from "./logic";

const SUN_ICON = svg`<path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`;
const MOON_ICON = svg`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`;
const VAR = "--lovelace-background";

/** The dashboard element whose --lovelace-background the view's background reads, found by climbing out of each shadow root. */
function dashboardOf(el: Element): HTMLElement | undefined {
  let n: Node | null = el;
  while (n) {
    if (n instanceof HTMLElement && (n.localName === "hui-root" || n.localName === "ha-panel-lovelace")) return n;
    n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
  }
  return undefined;
}

/** Paints the view behind the other cards with a sky that follows the sun, and can show a daylight tile. */
export class HaloBackdropCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, tileStyles, css`
    :host([hidden-backdrop]) { display: none; }
    ha-card { height: 100%; min-height: 120px; display: flex; flex-direction: column; container-type: inline-size; border-radius: var(--ha-card-border-radius, 12px); background: var(--surface); --track: color-mix(in srgb, var(--ink) 8%, transparent); }
    ha-card.dark { --track: color-mix(in srgb, var(--ink) 12%, transparent); }
    .tile { flex: 1 1 auto; min-height: 0; cursor: pointer; --chip-bg: var(--sunken); --chip-ico: var(--surface); --fig: 32px; justify-content: space-between; gap: 0; }
    .tile:focus-visible { outline: 2px solid var(--action); outline-offset: -2px; border-radius: inherit; }
    .tchip .ico { color: var(--sun); }
    .row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; min-width: 0; }
    .row > div:first-child { min-width: 0; }
    .det { margin-top: 4px; -webkit-line-clamp: 1; }
    .arc { flex: none; width: 32%; max-width: 160px; }
    .arc svg { display: block; width: 100%; height: auto; overflow: visible; }
    .arc .trk { stroke: var(--track); }
    .times { display: flex; justify-content: space-between; font-size: 11px; line-height: 14px; color: var(--ink-2); font-variant-numeric: tabular-nums; margin-top: 2px; }
    @container (max-width: 300px) { .arc { display: none; } }
    /* Hidden, while editing: a strip of the sky so the card can be found and picked. */
    ha-card.ph { min-height: 56px; justify-content: center; padding: 10px 14px; background: var(--sky); color: var(--ink); }
    .ph .lab { color: inherit; opacity: .75; }
    .ph b { font-size: 14px; font-weight: 600; }
  `];

  static getConfigElement() { return document.createElement("halo-backdrop-card-editor"); }
  static getStubConfig(): Partial<HaloBackdropConfig> { return { show: "tile" }; }

  @state() private _config?: HaloBackdropConfig;
  @state() private _hass?: HomeAssistant;
  /** Set by Home Assistant in the card editor and (on newer versions) while the dashboard is being edited. */
  @property({ type: Boolean }) preview = false;
  @property({ type: Boolean }) editMode = false;
  private _timer?: number;
  private _target?: HTMLElement;
  private _painted = "";

  setConfig(config: HaloBackdropConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass, id = this._config?.entity ?? "sun.sun";
    this._hass = hass;
    setLocale(hass);
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || old.states[id] !== hass.states[id]) this.requestUpdate();
  }
  getCardSize() { return this._config?.show === "hidden" ? 0 : 2; }
  getGridOptions() { return this._config?.show === "hidden" ? { columns: 12, rows: "auto" } : { columns: 12, rows: 2, min_columns: 6, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    // The sky moves a little every minute.
    this._timer = window.setInterval(() => this.requestUpdate(), 60_000);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._unpaint();
  }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _sky(now: Date) {
    const cfg = this._config!, hass = this._hass!, sun = sunTimes(hass.states[cfg.entity ?? "sun.sun"], now);
    const sky = skyAt(now.getHours() * 60 + now.getMinutes(), sun.rise, sun.set, !!hass.themes?.darkMode, { strength: cfg.strength, fixed: cfg.sun === "fixed" });
    return { sun, sky, bg: skyBackground(sky, cfg.grain !== false) };
  }

  /** Puts the sky on the dashboard; only a card that is really on a dashboard view (not the editor's preview) does. */
  private _paint(bg: string) {
    if (this.preview) return this._unpaint();
    const target = dashboardOf(this);
    if (target !== this._target) this._unpaint();
    if (!target) return;
    this._target = target;
    if (this._painted !== bg) { target.style.setProperty(VAR, bg); this._painted = bg; }
  }
  private _unpaint() {
    // Leave it alone if another backdrop has painted since.
    if (this._target && this._target.style.getPropertyValue(VAR) === this._painted) this._target.style.removeProperty(VAR);
    this._target = undefined; this._painted = "";
  }

  private get _editing() { return this.preview || this.editMode; }
  override willUpdate() {
    // Hidden, it takes no room on the dashboard (except while editing, so it can still be picked).
    this.toggleAttribute("hidden-backdrop", this._config?.show === "hidden" && !this._editing);
  }
  override updated() {
    if (this._config && this._hass) this._paint(this._sky(new Date()).bg);
  }

  override render() {
    const cfg = this._config!, hass = this._hass!, now = new Date(), dark = !!hass.themes?.darkMode;
    const { sun, sky, bg } = this._sky(now);
    if (cfg.show === "hidden") {
      if (!this._editing) return nothing;
      return html`<ha-card class="ph ${dark ? "dark" : ""}" style=${styleMap({ "--sky": bg })}><div class="lab">Halo Backdrop</div><b>Paints this view's background · ${stageName[sky.stage]}</b></ha-card>`;
    }
    const d = daylight(sun, now.getTime()), up = d?.up ?? sun.up;
    const colour = (up ? PALETTE.orange : PALETTE.teal)[dark ? 1 : 0].ln;
    const title = cfg.name ?? (up ? "Daylight" : "Night");
    let fig, det;
    if (!d) { fig = html`<span class="fig">–</span>`; det = html`Needs the Sun integration (${cfg.entity ?? "sun.sun"})`; }
    else if (up) { fig = html`<span class="fig">${duration(d.until)}<span class="unit">left</span></span>`; det = html`<b>Up ${duration(d.since)}</b> · sunset ${clock(sun.nextSet!)}`; }
    else { fig = html`<span class="fig">${duration(d.until)}<span class="unit">to sunrise</span></span>`; det = html`<b>Sunrise ${clock(sun.nextRise!)}</b> · ${duration(d.length)} of daylight`; }
    // Arc: the sun's way across the sky, a half-ellipse 200 wide and 50 high. At night the dot waits at sunrise or sunset.
    const p = d ? (up ? d.p : (now.getHours() * 60 + now.getMinutes() < sun.rise ? 0 : 1)) : 0, a = Math.PI * (1 - p);
    const px = 100 + 100 * Math.cos(a), py = 56 - 50 * Math.sin(a);
    const arc = d ? html`<div class="arc"><svg viewBox="-8 -8 216 68" aria-hidden="true">
        <path class="trk" d="M0 56 A100 50 0 0 1 200 56" fill="none" stroke-width="6" stroke-linecap="round"></path>
        ${up && p > 0.002 ? svg`<path d="M0 56 A100 50 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}" fill="none" stroke=${colour} stroke-width="6" stroke-linecap="round"></path>` : nothing}
        <circle cx=${px.toFixed(1)} cy=${py.toFixed(1)} r="7" fill=${colour} stroke="var(--surface)" stroke-width="3" opacity=${up ? 1 : 0.4}></circle></svg>
        <div class="times"><span>${clock(sun.nextRise!)}</span><span>${clock(sun.nextSet!)}</span></div></div>` : nothing;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap({ "--sun": colour })}>
      <div class="tile" role="button" tabindex="0" aria-label=${title} @click=${() => fireMoreInfo(this, cfg.entity ?? "sun.sun")}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fireMoreInfo(this, cfg.entity ?? "sun.sun"); } }}>
        <div class="top"><span class="tchip"><span class="ico"><svg viewBox="0 0 24 24">${up ? SUN_ICON : MOON_ICON}</svg></span><span class="label">${title}</span></span></div>
        <div class="row"><div>${fig}<div class="det">${det}</div></div>${arc}</div>
      </div></ha-card>`;
  }
}

const stageName: Record<string, string> = {
  night: "night", predawn: "first light", sunrise: "sunrise", morning: "morning", midday: "midday", afternoon: "afternoon", golden: "golden hour", sunset: "sunset", dusk: "dusk",
};
