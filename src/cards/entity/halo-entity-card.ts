import { LitElement, css, html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { actionFor, gestures, hasAction, runAction, type Gesture } from "../../shared/actions";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import { currencyAfter, setLocale } from "../../shared/format";
import { bucket, fetchStatistics, graphRange, subscribeHistory, type Sample } from "../../shared/history";
import { fmtNum } from "../../shared/format";
import { figure, gaugeColours, graphColours, iconColour, tileGraph, tileStyles, unitParts, type ColourMode } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { numState, observeSize } from "../../shared/util";
import { gaugeStyles, lineGauge, ringGauge, semiGauge } from "./gauge";
import { buildTile, isGradient, watchedEntities, type EntityTile, type Gauge, type HaloEntityConfig } from "./logic";

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const BUCKETS = 48;
/** Narrower than this is a small tile (three columns of a section); shorter than GRAPH_FROM has no room for a graph. */
const SMALL_BELOW = 136;
const GRAPH_FROM = 150;
/** With less room than this under the chip, a ring or semicircle sits beside the figure instead of around it. */
const BESIDE_BELOW = 100;
let uid = 0;

/** A value with its unit for the line below: currency before or after as the language writes it, % and degrees joined on, anything else after a space. */
const withUnit = (v: string, unit: string) =>
  !unit ? v : /^[£$€¥]$/.test(unit) && !currencyAfter() ? `${unit}${v}` : unit === "%" || unit.startsWith("°") ? `${v}${unit}` : `${v} ${unit}`;
/** A gauge's min or max: currency, % and degrees joined on, other units left off. */
const endLabel = (n: number, unit: string) => { const u = unitParts(unit); return `${u.pre}${fmtNum(n)}${u.inline}`; };
/** Rough width of the figure in em, to shrink it into a ring or beside a gauge. */
const figEm = (value: string, unit: string) => {
  const u = unitParts(unit);
  return (u.pre + value + u.inline).length * 0.62 + (u.small ? u.small.length * 0.38 * 0.62 + 0.16 : 0);
};
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One entity as a tile: small (3 × 2) or large (6 × 3), arranged like any other card in a sections view. */
export class HaloEntityCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, tileStyles, gaugeStyles, css`
    ha-card { --track: color-mix(in srgb, var(--ink) 8%, transparent); height: 100%; display: flex; flex-direction: column; container-type: inline-size; border-radius: var(--ha-card-border-radius, 12px); background: var(--surface); transition: transform .12s; }
    ha-card:active { transform: scale(.98); }
    /* Outside a sections view nothing gives the card a height, so it takes its usual one. */
    ha-card.m-s { min-height: 120px; }
    ha-card.m-l { min-height: 184px; }
    .tile { position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
      --fig: clamp(18px, 26cqw, 38px); --chip-bg: var(--sunken); --chip-ico: var(--surface); }
    .tile:focus-visible { outline: 2px solid var(--action); outline-offset: -2px; border-radius: inherit; }
    /* With no graph, the figure sits low. */
    .nog .val { margin-top: auto; }
    .off .val, .off .det { opacity: .5; }
    .tchip .ico ha-icon, .tchip .ico ha-state-icon { --mdc-icon-size: 16px; display: inline-flex; }
    .tight .tchip .ico ha-icon, .tight .tchip .ico ha-state-icon { --mdc-icon-size: 13px; }
    halo-svg-icon { width: 16px; height: 16px; }
    .tight halo-svg-icon { width: 13px; height: 13px; }

    ha-card.dark { --track: color-mix(in srgb, var(--ink) 12%, transparent); }
    /* Black on white and white on black are fixed: they don't change at night. */
    ha-card.t-light { --surface: #fff; --ink: #1b1b1f; --ink-2: #5c5c66; --line: rgba(0, 0, 0, .06); --sunken: #f0f0f3; --track: rgba(0, 0, 0, .07); border: 1px solid var(--line); }
    ha-card.t-dark { --surface: #141416; --ink: #f4f4f6; --ink-2: rgba(255, 255, 255, .66); --line: rgba(255, 255, 255, .08); --sunken: rgba(255, 255, 255, .1); --track: rgba(255, 255, 255, .12); border: 1px solid var(--line); }
    .t-dark .tile { --chip-ico: rgba(255, 255, 255, .14); }
    ha-card.grad { --ink: #fff; --ink-2: rgba(255, 255, 255, .86); --track: rgba(255, 255, 255, .3); background: var(--g); border: 0; }
    .grad .tile { --t-det: rgba(255, 255, 255, .88); --chip-bg: rgba(255, 255, 255, .82); --chip-ink: #1b1b1f; --chip-ico: #fff; }
    ha-card.grad::before { content: ""; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .55; background-image: ${unsafeCSS(GRAIN)}; }
    /* Gradients go a little deeper at night, as the blooms do. */
    ha-card.grad.dark::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(0, 0, 0, .34); }
    /* Full-coverage gradients. Grid, battery and solar use the colours those things have on the other cards. */
    .g-dusk { --g: radial-gradient(110% 80% at 0% 0%, #eab58e 0%, transparent 62%), radial-gradient(110% 90% at 100% 100%, #2b3fd8 0%, transparent 66%), linear-gradient(165deg, #d8a7a4 0%, #9e9ce8 48%, #3d52e2 100%); }
    .g-slate { --g: radial-gradient(120% 70% at 20% 0%, #b3bbd6 0%, transparent 70%), linear-gradient(175deg, #9aa5c6 0%, #6f7ea9 55%, #56669a 100%); }
    .g-ember { --g: radial-gradient(110% 80% at 0% 0%, #f09a4e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #7c44e4 0%, transparent 66%), linear-gradient(165deg, #ea8a56 0%, #dc4e7c 52%, #8f47dc 100%); }
    .g-solar { --g: radial-gradient(110% 80% at 0% 0%, #f6cf62 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #e0568a 0%, transparent 62%), linear-gradient(165deg, #f0bd52 0%, #e88a3e 55%, #dd5f78 100%); }
    .g-battery { --g: radial-gradient(110% 80% at 0% 0%, #7fd6a8 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1f7894 0%, transparent 64%), linear-gradient(165deg, #5cc596 0%, #2f9f86 55%, #22809a 100%); }
    .g-grid { --g: radial-gradient(110% 80% at 0% 0%, #b9aefc 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #2f6bff 0%, transparent 64%), linear-gradient(165deg, #9a8cf7 0%, #6f5cff 52%, #3c6cf5 100%); }
    .g-ocean { --g: radial-gradient(110% 80% at 0% 0%, #7cc8ef 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1b46a0 0%, transparent 64%), linear-gradient(165deg, #5fb3e6 0%, #2f7fd0 52%, #1f52aa 100%); }
    .g-glacier { --g: radial-gradient(110% 80% at 0% 0%, #d2e8f4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4c74ad 0%, transparent 64%), linear-gradient(165deg, #a9cbe4 0%, #7fa6cf 50%, #5a80b6 100%); }
    .g-aurora { --g: radial-gradient(110% 80% at 0% 0%, #66e3c2 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #7a52e6 0%, transparent 64%), linear-gradient(165deg, #4fd1b6 0%, #44a2e0 50%, #6f5ae4 100%); }
    .g-forest { --g: radial-gradient(110% 80% at 0% 0%, #9ccd7e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #255f53 0%, transparent 64%), linear-gradient(165deg, #82bd6e 0%, #4b9660 52%, #2c6d5a 100%); }
    .g-rose { --g: radial-gradient(110% 80% at 0% 0%, #f8b3c0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #a8356f 0%, transparent 64%), linear-gradient(165deg, #f0a0b2 0%, #e2668c 52%, #b5407a 100%); }
    .g-plum { --g: radial-gradient(110% 80% at 0% 0%, #c39be0 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #4b2580 0%, transparent 64%), linear-gradient(165deg, #b085d6 0%, #8650b8 52%, #5c308c 100%); }
    .g-sunset { --g: radial-gradient(110% 80% at 0% 0%, #ffc06f 0%, transparent 58%), radial-gradient(100% 90% at 100% 100%, #c2405e 0%, transparent 64%), linear-gradient(165deg, #ffab62 0%, #f26d5e 52%, #c94466 100%); }
    .g-sand { --g: radial-gradient(110% 80% at 0% 0%, #efd3a4 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #946640 0%, transparent 64%), linear-gradient(165deg, #dfbe8c 0%, #c49763 52%, #a0734a 100%); }
    .g-graphite { --g: radial-gradient(110% 80% at 0% 0%, #7d828e 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1d1f24 0%, transparent 64%), linear-gradient(165deg, #6a6e79 0%, #44474f 52%, #2a2c32 100%); }
    @media (prefers-reduced-motion: reduce) { ha-card { transition: none; } }
  `];

  static getConfigElement() { return document.createElement("halo-entity-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloEntityConfig> {
    const id = Object.keys(hass?.states ?? {}).find((e) => e.startsWith("sensor.") && numState(hass!.states[e]) !== undefined);
    return { entity: id ?? "", size: "small" };
  }

  /** Set by Home Assistant to "grid" in a sections view, where the card fills the space it is given. */
  @property({ attribute: false }) layout?: string;
  @state() private _config?: HaloEntityConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _samples: Sample[] = [];
  @state() private _w = 0;
  @state() private _h = 0;
  /** The gauge's fill as drawn, which eases towards the reading. */
  @state() private _gf = 0;
  private _gTarget = -1;
  private _raf?: number;
  private _tile?: EntityTile;
  private _id = ++uid;
  private _unobserve?: () => void;
  private _unsub?: () => void;
  private _timer?: number;
  private _subKey = "";
  private _g = gestures((g) => this._act(g), () => !!this._config && hasAction(this._config, "double_tap"));

  setConfig(config: HaloEntityConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Choose an entity");
    this._config = config;
    this._resubscribe();
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || old.locale !== hass.locale || watchedEntities(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
    if (!old) this._resubscribe();
  }

  getCardSize() { return this._config?.size === "large" ? 3 : 2; }
  getGridOptions() {
    return this._config?.size === "large" ? { columns: 6, rows: 3, min_columns: 3, min_rows: 2 } : { columns: 3, rows: 2, min_columns: 3, min_rows: 2 };
  }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => {
      if (Math.abs(w - this._w) > 1) this._w = w;
      if (Math.abs(h - this._h) > 1) this._h = h;
    });
    this._resubscribe();
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unobserve?.(); this._unobserve = undefined;
    this._stop();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = undefined; this._gTarget = -1; this._gf = 0;
  }
  override willUpdate() {
    if (!this._config || !this._hass) return;
    this._tile = buildTile(this._hass, this._config);
    this._ease(this._tile.gauge?.frac ?? 0);
  }
  override updated() { this._resubscribe(); }

  private get _small() { return this._w ? this._w < SMALL_BELOW : this._config?.size !== "large"; }
  private _graphShown(t: EntityTile) {
    return !!t.graph && !this._small && (this._h ? this._h >= GRAPH_FROM : this._config?.size === "large");
  }

  private _stop() {
    this._unsub?.(); this._unsub = undefined;
    clearInterval(this._timer); this._timer = undefined;
    this._subKey = "";
  }

  /** History while the graph is shown: live history up to a day, hourly statistics beyond (refreshed every ten minutes). */
  private _resubscribe() {
    const hass = this._hass, cfg = this._config;
    if (!hass || !cfg || !this.isConnected) return;
    const t = buildTile(hass, cfg);
    const g = this._graphShown(t) ? t.graph : undefined;
    const key = g ? `${cfg.entity}|${g.hours}|${g.statistics}` : "";
    if (key === this._subKey) return;
    this._stop();
    this._subKey = key;
    this._samples = [];
    if (!g) return;
    const history = () => {
      this._unsub = subscribeHistory(hass, [cfg.entity], Date.now() - g.hours * 3600_000, (d) => { if (this._subKey === key) this._samples = [...(d[cfg.entity] ?? [])]; });
    };
    if (!g.statistics) { history(); return; }
    const load = () => fetchStatistics(this._hass ?? hass, cfg.entity, Date.now() - g.hours * 3600_000).then((s) => {
      if (this._subKey !== key) return;
      if (s.length) { this._samples = s; return; }
      // No statistics after all: live history instead.
      clearInterval(this._timer); this._timer = undefined;
      if (!this._unsub) history();
    }, () => { if (this._subKey === key && !this._unsub) { clearInterval(this._timer); this._timer = undefined; history(); } });
    load();
    this._timer = window.setInterval(load, 10 * 60_000);
  }

  /** Sweeps the gauge from where it is to `target`: in from empty the first time, then along to each new reading. */
  private _ease(target: number) {
    if (target === this._gTarget) return;
    const from = this._gTarget < 0 ? 0 : this._gf;
    this._gTarget = target;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = undefined;
    if (reducedMotion() || typeof requestAnimationFrame === "undefined") { this._gf = target; return; }
    const t0 = performance.now(), dur = from === 0 ? 1100 : 700;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      this._gf = from + (target - from) * (1 - Math.pow(1 - k, 3));
      this._raf = k < 1 ? requestAnimationFrame(step) : undefined;
    };
    this._raf = requestAnimationFrame(step);
  }

  private _act(g: Gesture) {
    if (!this._hass || !this._config) return;
    runAction(this, this._hass, actionFor(this._config, g), this._config.entity);
  }

  private _icon(t: EntityTile) {
    if (t.svg) return html`<halo-svg-icon .src=${t.svg}></halo-svg-icon>`;
    const s = this._hass!.states[t.entity];
    if (t.stateIcon && s && customElements.get("ha-state-icon")) return html`<ha-state-icon .hass=${this._hass} .stateObj=${s}></ha-state-icon>`;
    return html`<ha-icon .icon=${t.icon}></ha-icon>`;
  }

  private _graph(t: EntityTile, mode: ColourMode) {
    // Nothing until history arrives, so the graph doesn't start as a flat line.
    if (!t.graph || !this._samples.length) return nothing;
    const now = Date.now(), start = now - t.graph.hours * 3600_000;
    const samples = t.num === undefined ? this._samples : [...this._samples, { t: now - 1, v: t.num }];
    const values = bucket(samples, start, now, BUCKETS);
    const [lo, hi] = graphRange(values, t.graph.scale, t.graph.min, t.graph.max);
    return tileGraph(values, lo, hi, `eg${this._id}`, graphColours(t.graphColour, mode));
  }

  private _det(t: EntityTile) {
    const sec = t.secondary;
    if (!sec) return nothing;
    return "text" in sec ? sec.text : html`${sec.name ? html`<b>${sec.name}</b> ` : nothing}${withUnit(sec.value, sec.unit)}`;
  }

  /** The figure, the line below and the gauge, laid out for the room the tile has. */
  private _gaugeBody(t: EntityTile, g: Gauge, mode: ColourMode, small: boolean) {
    const large = this._config?.size === "large";
    const w = this._w || (large ? 216 : 104), h = this._h || (large ? 184 : 120);
    const px = small ? 9 : 14, chipH = small ? 24 : 32, gap = small ? 3 : 6;
    const innerW = w - 2 * px, bodyH = h - 2 * px - chipH - gap;
    const base = Math.min(Math.max(0.26 * w, 18), 38);
    const fit = (fs: number, room: number) => Math.max(10, Math.min(fs, room / figEm(t.value, t.unit)));
    const val = (fs: number, cls = "") => html`<div class="val ${cls}" style="--fig:${fs.toFixed(1)}px">${figure(t.value, t.unit)}</div>`;
    const c = gaugeColours(g.colour, mode);
    const bands = g.bands.map((b) => ({ ...b, colour: mode === "white" ? "#fff" : iconColour(b.colour, mode) ?? b.colour }));
    const sec = this._det(t), hasDet = sec !== nothing;
    const det = html`<div class="det">${sec}</div>`;
    const frac = this._gf;

    if (g.style === "line") {
      // The bar always shows; to keep the figure a fair size, the labels go first, then the line below.
      const barH = small ? 6 : 8, detH = small ? 17 : 22, labH = small ? 13 : 16, minFs = small ? 18 : 24;
      let withDet = hasDet, withLab = g.labels;
      const room = () => bodyH - (barH + gap + 2) - (withDet ? detH : 0) - (withLab ? labH : 0);
      if (room() < minFs) withLab = false;
      if (room() < minFs) withDet = false;
      return html`${val(fit(Math.min(base, room()), innerW), "low")}${withDet ? det : nothing}
        <div class="gl">${lineGauge(barH, frac, c, bands)}${withLab ? html`<div class="glab"><span>${endLabel(g.min, t.unit)}</span><span>${endLabel(g.max, t.unit)}</span></div>` : nothing}</div>`;
    }
    if (!small && bodyH < BESIDE_BELOW) {
      // A short, wide tile: the gauge beside the figure.
      const withDet = hasDet && bodyH - 22 >= 24;
      const gw = g.style === "ring" ? Math.min(bodyH, innerW * 0.32) : Math.min(2 * (bodyH - 2), innerW * 0.4);
      const gauge = g.style === "ring" ? ringGauge(gw, Math.max(5, Math.round(gw * 0.11)), frac, c, bands) : semiGauge(gw, Math.max(5, Math.round(gw * 0.1)), frac, c, bands);
      return html`<div class="beside"><div class="col">${val(fit(Math.min(base, withDet ? bodyH - 22 : bodyH), innerW - gw - 12))}${withDet ? det : nothing}</div>${gauge}</div>`;
    }
    if (g.style === "ring") {
      const d = Math.floor(Math.min(bodyH, innerW)), sw = Math.max(5, Math.round(d * 0.085)), inner = d - 2 * sw;
      const withDet = !small && d >= 104 && hasDet;
      const fs = fit(Math.min(base, Math.max(14, d * 0.26)), inner * 0.8);
      const inside = html`<div class="in">${val(fs)}${withDet ? html`<div class="det" style="max-width:${Math.round(inner * 0.78)}px">${sec}</div>` : nothing}</div>`;
      return html`<div class="gwrap">${ringGauge(d, sw, frac, c, bands, inside)}</div>`;
    }
    // Semicircle: the figure in the bowl, then min, the line below and max along the feet (small tiles: the line below alone).
    const labH = !small && (g.labels || hasDet) ? 16 : 0, detBelow = small && hasDet ? 15 : 0;
    const wa = Math.floor(Math.min(innerW, 2 * (bodyH - labH - detBelow - 4)));
    const sw = Math.min(Math.max(Math.round(wa * 0.08), 5), 13);
    const fs = fit(Math.min(base, Math.max(14, wa * 0.2)), (wa / 2 - sw) * 1.7);
    const inside = html`<div class="in" style="justify-content:flex-end;padding-bottom:${(sw / 2).toFixed(1)}px">${val(fs)}</div>`;
    const under = labH
      ? html`<div class="glab" style="width:${wa}px;margin-top:4px">${g.labels ? html`<span>${endLabel(g.min, t.unit)}</span>` : nothing}<span class="d">${sec}</span>${g.labels ? html`<span>${endLabel(g.max, t.unit)}</span>` : nothing}</div>`
      : detBelow ? html`<div class="det c" style="max-width:${innerW}px;margin-top:3px">${sec}</div>` : nothing;
    return html`<div class="gwrap end">${semiGauge(wa, sw, frac, c, bands, inside)}${under}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const t = this._tile ?? buildTile(hass, cfg);
    const dark = !!hass.themes?.darkMode, grad = isGradient(t.theme), small = this._small, showGraph = this._graphShown(t);
    // Which palette: white on gradients, fixed for black on white / white on black, otherwise day or night.
    const mode: ColourMode = grad ? "white" : t.theme === "light" ? "day" : t.theme === "dark" ? "night" : dark ? "night" : "day";
    const ic = iconColour(t.iconColour, mode === "white" ? "day" : mode);
    const sec = this._det(t);
    const g = this._g;
    const classes = [
      dark ? "dark" : "", `t-${t.theme}`, grad ? `grad g-${t.theme}` : "", this.layout === "grid" ? "" : small ? "m-s" : "m-l",
      cfg.shadow === false ? "" : "halo-shadow", t.available ? "" : "off",
    ].join(" ");
    return html`<ha-card class=${classes}>
      <div class="tile ${small ? "tight" : ""} ${showGraph || t.gauge ? "" : "nog"}" role="button" tabindex="0" aria-label="${t.name}: ${t.value} ${t.unit}"
        @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel} @pointerleave=${g.cancel} @keydown=${g.key}
        @contextmenu=${(e: Event) => e.preventDefault()}>
        <div class="top"><span class="tchip ${t.showIcon ? "" : "bare"}">
          ${t.showIcon ? html`<span class="ico" style=${styleMap(ic ? { color: ic } : {})}>${this._icon(t)}</span>` : nothing}<span class="label">${t.name}</span>
        </span></div>
        ${t.gauge ? this._gaugeBody(t, t.gauge, mode, small) : html`
          <div class="val">${figure(t.value, t.unit)}</div>
          ${sec !== nothing ? html`<div class="det">${sec}</div>` : nothing}
          ${showGraph ? this._graph(t, mode) : nothing}`}
      </div>
    </ha-card>`;
  }
}
