import { LitElement, html, nothing, svg, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { clock, fmtNum, hourLabel, setLocale } from "../../shared/format";
import { bucket, fetchStatistics, subscribeHistory, type Sample } from "../../shared/history";
import { chartColour, iconColour } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { observeSize, startOfDay } from "../../shared/util";
import {
  MAX_FIGURES, agilePreset, axesOf, barColour, buildFigure, buildSeries, chartWindow, entitiesOf, fitWindow, hasTomorrow, inWindow,
  niceAxis, rangeOf, sideOf, slotFor, solarPreset, sourceOf, useStatistics, valueAt, type Figure, type HaloGraphConfig, type Series,
} from "./logic";
import type { RawForecast } from "./sources";
import { styles } from "./styles";

type Day = "today" | "tomorrow";
const HOUR = 3600_000;
const REFRESH = 10 * 60_000;
const MIN_FIGURE = 64;
let uid = 0;

/** Cubic path through the points (Catmull-Rom), never dipping below `floor` (the zero line). */
function smooth(pts: [number, number][], floor: number): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(p1[1] + (p2[1] - p0[1]) / 6, floor), c2y = Math.min(p2[1] - (p3[1] - p1[1]) / 6, floor);
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const withUnit = (v: string, unit: string) => (unit === "p" ? `${v}p` : unit ? `${v} ${unit}` : v);

/** Up to four figures over a chart of several series: lines, shaded areas and bars, over a period you choose. */
export class HaloGraphCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-graph-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloGraphConfig> {
    const agile = Object.keys(hass?.states ?? {}).some((e) => /current_day_rates$/.test(e));
    return agile ? agilePreset(hass) : solarPreset(hass);
  }

  @state() private _config?: HaloGraphConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _history: Record<string, Sample[]> = {};
  @state() private _stats: Record<string, Sample[]> = {};
  @state() private _forecast?: RawForecast;
  @state() private _loaded = false;
  @state() private _day: Day = "today";
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _cs = { w: 0, h: 0 };
  @state() private _hov?: number;
  private _id = ++uid;
  private _hovTimer?: number;
  private _timer?: number;
  private _unobserve?: () => void;
  private _unsub?: () => void;
  private _histKey = "";
  private _statsKey = "";
  private _gen = 0;

  setConfig(config: HaloGraphConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!Array.isArray(config.series)) throw new Error("Add a series: an entity, or the solar forecast");
    this._config = config;
    this._histKey = ""; this._statsKey = ""; this._gen++;
    this._load(true);
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (!old) this._load(true);
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || this._watched().some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 5; }
  getGridOptions() { return { columns: 12, rows: 6, min_columns: 4, min_rows: 2 }; }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  private _watched() {
    const c = this._config!;
    return [...(c.series ?? []).flatMap(entitiesOf), ...(c.figures ?? []).map((f) => f.entity)].filter((x): x is string => !!x);
  }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
    this._timer = window.setInterval(() => this._load(true), REFRESH);
    this._load(true);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unobserve?.(); clearInterval(this._timer); clearTimeout(this._hovTimer); this._gen++;
    this._unsub?.(); this._unsub = undefined; this._histKey = ""; this._statsKey = "";
  }

  /** What to fetch: history from the start of today (or of the chart, if earlier), long-term statistics, the solar forecast. */
  private _needs() {
    const hass = this._hass!, cfg = this._config!, now = Date.now();
    const from = Math.floor(Math.max(Math.min(chartWindow(cfg, now, "today")[0], startOfDay(now)), now - 168 * HOUR) / HOUR) * HOUR;
    const hist = new Set<string>(), stats = new Set<string>();
    for (const s of cfg.series ?? []) {
      const src = sourceOf(hass, s), id = entitiesOf(s)[0];
      if ((src !== "history" && src !== "statistics") || !id) continue;
      (useStatistics(hass, s, from, now) ? stats : hist).add(id);
    }
    return { from, hist: [...hist], stats: [...stats], forecast: (cfg.series ?? []).some((s) => sourceOf(hass, s) === "energy_forecast") };
  }

  /** Subscribes or fetches what changed; `refresh` also re-reads the forecast and statistics. */
  private _load(refresh = false) {
    const hass = this._hass, cfg = this._config;
    if (!hass?.connection || !cfg || !this.isConnected) return;
    const n = this._needs(), gen = this._gen;
    const hk = n.hist.length ? `${n.hist.join("|")}@${n.from}` : "";
    if (hk !== this._histKey) {
      this._unsub?.(); this._unsub = undefined; this._histKey = hk; this._history = {};
      if (hk) this._unsub = subscribeHistory(hass, n.hist, n.from, (d) => { if (gen === this._gen) this._history = { ...d }; });
    }
    const sk = n.stats.length ? `${n.stats.join("|")}@${n.from}` : "";
    if (sk !== this._statsKey || (refresh && sk)) {
      this._statsKey = sk;
      if (!sk) this._stats = {};
      for (const id of n.stats) fetchStatistics(hass, id, n.from).then((s) => { if (gen === this._gen) this._stats = { ...this._stats, [id]: s }; }, () => {});
    }
    if (n.forecast && (refresh || !this._forecast) && hass.callWS) {
      hass.callWS<RawForecast>({ type: "energy/solar_forecast" }).then(
        (raw) => { if (gen === this._gen) { this._forecast = raw; this._loaded = true; } },
        () => { if (gen === this._gen) { this._forecast = undefined; this._loaded = true; } },
      );
    } else if (!n.forecast) this._loaded = true;
  }

  override updated() {
    this._load();
    const el = this.shadowRoot?.querySelector(".chart") as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - this._cs.w) > 1 || Math.abs(r.height - this._cs.h) > 1) this._cs = { w: r.width, h: r.height };
  }

  private _geo(series: Series[], compact: boolean) {
    const right = axesOf(series).length > 1;
    return { L: compact ? 0 : 30, R: compact ? 0 : right ? 30 : 6, T: compact ? 3 : right ? 20 : 10, B: compact ? 3 : 20 };
  }

  private _point(e: PointerEvent, series: Series[], w: [number, number]) {
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect(), g = this._geo(series, false);
    const t = w[0] + ((e.clientX - r.left - g.L) / (r.width - g.L - g.R)) * (w[1] - w[0]);
    this._hov = t >= w[0] && t <= w[1] ? t : undefined;
    clearTimeout(this._hovTimer);
    if (e.pointerType !== "mouse") this._hovTimer = window.setTimeout(() => (this._hov = undefined), 4000);
  }
  private _clearMouse = (e: PointerEvent) => { if (e.pointerType === "mouse") this._hov = undefined; };

  private _chart(series: Series[], w: [number, number], compact: boolean, dark: boolean) {
    const { w: W, h: H } = this._cs;
    if (W < 10 || H < 10) return nothing;
    if (!series.length) return html`<div class="empty"><b>Nothing to draw</b><span>Add a series in the card settings.</span></div>`;
    if (!series.some((s) => inWindow(s, w).length)) return this._loaded ? html`<div class="empty"><b>No data</b><span>Nothing for this period yet.</span></div>` : nothing;
    const g = this._geo(series, compact), units = axesOf(series);
    const axes = (["L", "R"] as const).slice(0, units.length).map((side) => niceAxis(...rangeOf(series.filter((s) => sideOf(series, s) === side), w)));
    const X = (t: number) => g.L + ((t - w[0]) / (w[1] - w[0])) * (W - g.L - g.R);
    const Y = (v: number, a: { min: number; max: number }) => g.T + (1 - (v - a.min) / (a.max - a.min || 1)) * (H - g.T - g.B);
    const parts: TemplateResult[] = [];
    const aL = axes[0], aR = axes[1];
    if (!compact) {
      for (const t of aL.ticks) parts.push(svg`<line class="grid ${t === 0 ? (aL.min < 0 ? "zero" : "") : "dash"}" x1=${g.L} x2=${W - g.R} y1=${Y(t, aL)} y2=${Y(t, aL)}></line><text class="ax" x=${g.L - 6} y=${Y(t, aL) + 3.5} text-anchor="end">${fmtNum(t, undefined, { max: 2 })}</text>`);
      if (aR) {
        for (const t of aR.ticks) parts.push(svg`<text class="ax" x=${W - g.R + 6} y=${Y(t, aR) + 3.5}>${fmtNum(t, undefined, { max: 2 })}</text>`);
        parts.push(svg`<text class="ax" x=${g.L - 6} y="8" text-anchor="end">${units[0]}</text><text class="ax" x=${W - g.R + 6} y="8">${units[1]}</text>`);
      }
      const span = (w[1] - w[0]) / HOUR;
      const every = span <= 3 ? 1 : span <= 10 ? 2 : span <= 16 ? 3 : span <= 36 ? 6 : span <= 72 ? 12 : 24;
      const first = new Date(w[0]); first.setMinutes(0, 0, 0);
      for (let t = first.getTime(); t <= w[1]; t += HOUR) {
        const d = new Date(t), hh = d.getHours();
        if (t < w[0] || hh % every) continue;
        const label = every >= 24 ? d.toLocaleDateString(undefined, { weekday: "short" }) : hourLabel(hh);
        const anchor = X(t) - g.L < 10 ? "start" : W - g.R - X(t) < 10 ? "end" : "middle";
        parts.push(svg`<text class="ax" x=${X(t)} y=${H - 4} text-anchor=${anchor}>${label}</text>`);
      }
    }
    series.forEach((s, i) => {
      const a = sideOf(series, s) === "L" ? aL : aR ?? aL, y0 = Y(Math.max(0, a.min), a);
      const c = chartColour(s.colour, dark);
      if (s.style === "bars") {
        const gap = compact ? 0.6 : 1;
        for (const x of s.slots) {
          if (x.t1 <= w[0] || x.t0 >= w[1]) continue;
          const x0 = Math.max(X(x.t0), g.L), x1 = Math.min(X(x.t1), W - g.R), top = Y(Math.max(x.v, 0), a), bot = Y(Math.min(x.v, 0), a);
          const sel = !compact && this._hov !== undefined && x.t0 <= this._hov && this._hov < x.t1;
          const fill = chartColour(barColour(s, x.v), dark) ?? chartColour("grey", dark)!;
          parts.push(svg`<rect class="bar ${sel ? "sel" : ""}" x=${x0 + gap / 2} y=${top} width=${Math.max(x1 - x0 - gap, 1)} height=${Math.max(bot - top, 1)} rx=${compact ? 0.8 : 1.5} fill=${fill}></rect>`);
        }
        return;
      }
      const pts: [number, number][] = s.kind === "slots"
        ? s.slots.filter((x) => x.t1 > w[0] - HOUR && x.t0 < w[1] + HOUR).map((x) => [X((x.t0 + x.t1) / 2), Y(x.v, a)])
        : thin(s.points.filter((x) => x.t >= w[0] && x.t <= w[1]), W).map((x) => [X(x.t), Y(x.v, a)]);
      if (pts.length < 2) return;
      const line = smooth(pts, y0);
      if (s.style === "area") {
        const fill = c ?? chartColour("grey", dark)!, id = `ga${this._id}-${i}-${compact ? "c" : "f"}`;
        parts.push(svg`<defs><linearGradient id=${id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color=${fill} stop-opacity=".38"></stop><stop offset="1" stop-color=${fill} stop-opacity=".04"></stop></linearGradient>
          <clipPath id="${id}k"><rect x=${g.L} y="0" width=${Math.max(W - g.L - g.R, 0)} height=${H}></rect></clipPath></defs>
          <g clip-path="url(#${id}k)"><path d="${line} L${pts[pts.length - 1][0].toFixed(1)},${y0.toFixed(1)} L${pts[0][0].toFixed(1)},${y0.toFixed(1)}Z" fill="url(#${id})"></path><path class="edge" d=${line} stroke=${fill}></path></g>`);
      } else {
        parts.push(svg`<path class="line" d=${line} style=${styleMap({ stroke: c ?? "var(--ink)", strokeWidth: compact ? "1.8" : "" })}></path>`);
      }
    });
    const now = Date.now();
    if (now > w[0] && now < w[1]) parts.push(svg`<line class="nowline" x1=${X(now)} x2=${X(now)} y1=${compact ? 0 : g.T} y2=${H - g.B}></line>`);
    if (!compact && this._hov !== undefined) {
      parts.push(svg`<line class="hovline" x1=${X(this._hov)} x2=${X(this._hov)} y1=${g.T} y2=${H - g.B}></line>`);
      for (const s of series) {
        if (s.style === "bars") continue;
        const v = valueAt(s, this._hov);
        if (v === undefined) continue;
        parts.push(svg`<circle class="dot" cx=${X(this._hov)} cy=${Y(v, sideOf(series, s) === "L" ? aL : aR ?? aL)} r="4" style=${styleMap({ fill: chartColour(s.colour, dark) ?? "var(--ink)" })}></circle>`);
      }
    }
    return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart">${parts}</svg>`;
  }

  private _readout(series: Series[], dark: boolean) {
    const t = this._hov;
    if (t === undefined) return html`<div class="readout"></div>`;
    const slot = slotFor(series, t);
    const time = slot ? `${clock(slot.t0)}–${clock(slot.t1)}` : clock(Math.round(t / 300_000) * 300_000);
    const vals = series.map((s) => {
      const v = valueAt(s, t);
      if (v === undefined) return nothing;
      const c = (s.style === "bars" ? chartColour(barColour(s, v), dark) : chartColour(s.colour, dark)) ?? (s.style === "line" ? "var(--ink)" : chartColour("grey", dark));
      return html`<span><i style=${styleMap({ background: c ?? "" })}></i>${s.name} ${withUnit(fmtNum(v, s.decimals), s.unit)}</span>`;
    });
    return html`<div class="readout" aria-live="polite"><span>${time}</span>${vals}</div>`;
  }

  private _icon(f: Figure, dark: boolean) {
    if (!f.icon && !f.icon_svg) return nothing;
    const c = iconColour(f.icon_colour, dark ? "night" : "day");
    return html`<span class="fi" style=${styleMap(c ? { color: c } : {})}>${f.icon_svg ? html`<halo-svg-icon .src=${f.icon_svg}></halo-svg-icon>` : html`<ha-icon .icon=${f.icon}></ha-icon>`}</span>`;
  }
  private _figure(f: Figure, dark: boolean) {
    return html`<div><div class="lab">${this._icon(f, dark)}${f.label}</div>
      <div class="big">${f.value}${f.value !== "–" && f.unit ? html`<small>${f.unit}</small>` : nothing}</div>
      ${f.note ? html`<div class="note ${f.good ? "good" : ""}">${f.note}</div>` : nothing}</div>`;
  }

  private _seg(show: boolean) {
    if (!show) return nothing;
    return html`<div class="seg" role="group" aria-label="Day">${(["today", "tomorrow"] as Day[]).map((d) =>
      html`<button aria-pressed=${String(this._day === d)} @click=${() => { this._day = d; this._hov = undefined; }}>${d === "today" ? "Today" : "Tomorrow"}</button>`)}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!, now = Date.now(), dark = !!hass.themes?.darkMode;
    const series = buildSeries(hass, cfg, { history: this._history, statistics: this._stats, forecast: this._forecast }, now);
    const dayPill = (cfg.period ?? "day") === "day" && hasTomorrow(series, now);
    const day: Day = this._day === "tomorrow" && dayPill ? "tomorrow" : "today";
    const period = chartWindow(cfg, now, day);
    const w = cfg.fit ? fitWindow(series, period) : period;
    const compact = this._h > 0 && this._h < 230;
    const figs = (cfg.figures ?? []).slice(0, MAX_FIGURES).map((f) => buildFigure(hass, cfg, series, f, now, period, compact ? undefined : this._hov));
    const cls = `${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}`;

    if (compact) {
      const [a, b] = figs;
      return html`<ha-card class=${cls}><div class="inner c">
        <div class="l">${a ? html`<div class="lab">${this._icon(a, dark)}${a.label}</div><div class="big">${a.value}${a.value !== "–" && a.unit ? html`<small>${a.unit}</small>` : nothing}</div>` : html`<div class="lab">${cfg.name ?? "Graph"}</div>`}
          ${b ? html`<div class="note">${b.label} ${b.value === "–" ? "–" : withUnit(b.value, b.unit)}</div>` : nothing}</div>
        <div class="r">${this._seg(dayPill)}<div class="chart">${this._chart(series, w, true, dark)}</div></div>
      </div></ha-card>`;
    }
    // As many figures as fit, in order.
    const fit = this._w > 0 ? Math.max(Math.floor((this._w - 32) / MIN_FIGURE), 1) : figs.length;
    const shown = figs.slice(0, fit);
    const tight = this._w > 0 && (this._w - 32) / Math.max(shown.length, 1) < 88;
    return html`<ha-card class=${cls}><div class="inner">
      ${cfg.name ? html`<header><h2>${cfg.name}</h2></header>` : nothing}
      ${shown.length ? html`<div class="stats ${tight ? "tight" : ""}">${shown.map((f) => this._figure(f, dark))}</div>` : nothing}
      ${this._seg(dayPill)}
      <div class="chart" @pointermove=${(e: PointerEvent) => this._point(e, series, w)} @pointerdown=${(e: PointerEvent) => this._point(e, series, w)} @pointerleave=${this._clearMouse}>${this._chart(series, w, false, dark)}</div>
      ${this._readout(series, dark)}
    </div></ha-card>`;
  }
}

/** About one point every two pixels, each the average of what it covers: a week of history has far more points than the chart has room for. */
function thin(pts: { t: number; v: number }[], width: number): { t: number; v: number }[] {
  const max = Math.max(Math.floor(width / 2), 24);
  if (pts.length <= max) return pts;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, step = (t1 - t0) / max;
  const out = bucket(pts, t0, t1, max).flatMap((v, i) => (v === null ? [] : [{ t: t0 + (i + 0.5) * step, v }]));
  return [...out, pts[pts.length - 1]];
}
