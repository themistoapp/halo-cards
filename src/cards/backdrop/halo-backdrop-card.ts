import { LitElement, css, html, nothing, svg } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import { clock, setLocale } from "../../shared/format";
import { PALETTE, gaugeColours, tileStyles } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, observeSize } from "../../shared/util";
import { gaugeStyles, semiGauge } from "../entity/gauge";
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
  static override styles = [themeStyles, shadowStyles, tileStyles, gaugeStyles, css`
    :host([hidden-backdrop]) { display: none; }
    ha-card { height: 100%; min-height: 120px; display: flex; flex-direction: column; container-type: inline-size; border-radius: var(--ha-card-border-radius, 12px); background: var(--surface); --track: color-mix(in srgb, var(--ink) 8%, transparent); }
    ha-card.dark { --track: color-mix(in srgb, var(--ink) 12%, transparent); }
    .tile { flex: 1 1 auto; min-height: 0; cursor: pointer; --chip-bg: var(--sunken); --chip-ico: var(--surface); --fig: 32px; justify-content: space-between; gap: 0; }
    .tile:focus-visible { outline: 2px solid var(--action); outline-offset: -2px; border-radius: inherit; }
    .tchip .ico { color: var(--sun); }
    .det { margin-top: 4px; -webkit-line-clamp: 1; }
    /* The semicircle is the Entity card's gauge, beside the figure as on a short, wide entity tile. Narrow tiles leave it out. */
    @container (max-width: 300px) { .beside .gz { display: none; } }
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
  /** The gauge's fill, swept in and then eased along like the Entity card's. */
  @state() private _gf = 0;
  @state() private _w = 0;
  @state() private _h = 0;
  private _gTarget = -1;
  private _raf?: number;
  private _unobserve?: () => void;
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
    this._unobserve = observeSize(this, (w, h) => { this._w = w; this._h = h; });
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._unobserve?.(); this._unobserve = undefined;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = undefined; this._gTarget = -1; this._gf = 0;
    this._unpaint();
  }

  /** Sweeps the gauge from where it is to `target`: in from empty the first time, then along (same timing as the Entity card). */
  private _ease(target: number) {
    if (Math.abs(target - this._gTarget) < 1e-4) return;
    const from = this._gTarget < 0 ? 0 : this._gf;
    this._gTarget = target;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = undefined;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof requestAnimationFrame === "undefined") { this._gf = target; return; }
    const t0 = performance.now(), dur = from === 0 ? 1100 : 700;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      this._gf = from + (target - from) * (1 - Math.pow(1 - k, 3));
      this._raf = k < 1 ? requestAnimationFrame(step) : undefined;
    };
    this._raf = requestAnimationFrame(step);
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
    if (this._config && this._hass && this._config.show !== "hidden") {
      const now = new Date(), d = daylight(sunTimes(this._hass.states[this._config.entity ?? "sun.sun"], now), now.getTime());
      this._ease(d?.p ?? 0);
    }
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
    // The Entity card's semicircle, sized as on a short, wide entity tile: the day's progress in orange, the night's in teal.
    const w = this._w || 378, h = this._h || 120, innerW = w - 28, bodyH = h - 28 - 32 - 6;
    const gw = Math.min(2 * (bodyH - 2), innerW * 0.4);
    const gauge = d && gw > 24 ? semiGauge(gw, Math.max(5, Math.round(gw * 0.1)), this._gf, gaugeColours(up ? "orange" : "teal", dark ? "night" : "day"), []) : nothing;
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap({ "--sun": colour })}>
      <div class="tile" role="button" tabindex="0" aria-label=${title} @click=${() => fireMoreInfo(this, cfg.entity ?? "sun.sun")}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fireMoreInfo(this, cfg.entity ?? "sun.sun"); } }}>
        <div class="top"><span class="tchip"><span class="ico"><svg viewBox="0 0 24 24">${up ? SUN_ICON : MOON_ICON}</svg></span><span class="label">${title}</span></span></div>
        <div class="beside"><div class="col">${fig}<div class="det">${det}</div></div>${gauge}</div>
      </div></ha-card>`;
  }
}

const stageName: Record<string, string> = {
  night: "night", predawn: "first light", sunrise: "sunrise", morning: "morning", midday: "midday", afternoon: "afternoon", golden: "golden hour", sunset: "sunset", dusk: "dusk",
};
