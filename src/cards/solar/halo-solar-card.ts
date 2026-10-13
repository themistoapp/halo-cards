import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { observeSize } from "../../shared/util";
import { subscribeHistory, type Sample } from "../../shared/history";
import { buildSolar, fmtKwh, parseForecast, smoothPath, startOfDay, type Hour, type HaloSolarConfig, type RawForecast, type SolarModel } from "./logic";
import { styles } from "./styles";
import { clockAt, fmtNum, hourLabel, setLocale } from "../../shared/format";

type Day = "today" | "tomorrow";
const REFRESH = 30 * 60_000;

export class HaloSolarCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-solar-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloSolarConfig> {
    return { actual: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("sensor.") && /solar|pv/.test(e) && hass?.states[e].attributes.device_class === "power") };
  }

  @state() private _config?: HaloSolarConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _hours: Hour[] = [];
  @state() private _loaded = false;
  @state() private _samples: Sample[] = [];
  @state() private _day: Day = "today";
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _cs = { w: 0, h: 0 };
  @state() private _hov?: number;
  private _hovTimer?: number;
  private _unobserve?: () => void;
  private _unsub?: () => void;
  private _timer?: number;
  private _histKey = "";
  private _gen = 0;

  setConfig(config: HaloSolarConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = config;
    this._load(); this._resubscribe();
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass, first = !old;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (first) { this._load(); this._resubscribe(); }
    const a = this._config.actual;
    if (first || (a && old!.states[a] !== hass.states[a])) this.requestUpdate();
  }
  getCardSize() { return 5; }
  getGridOptions() { return { columns: 12, rows: 6, min_columns: 4, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
    this._timer = window.setInterval(() => { this._load(); this._resubscribe(); }, REFRESH);
    this._load(); this._resubscribe();
  }
  override disconnectedCallback() {
    super.disconnectedCallback(); this._unobserve?.(); clearInterval(this._timer); clearTimeout(this._hovTimer); this._gen++;
    this._unsub?.(); this._unsub = undefined; this._histKey = "";
  }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /** Forecast.Solar's hourly forecast, through the same call the Energy dashboard uses. */
  private _load() {
    const hass = this._hass, cfg = this._config;
    if (!hass?.callWS || !cfg || !this.isConnected) return;
    const gen = this._gen;
    hass.callWS<RawForecast>({ type: "energy/solar_forecast" }).then(
      (raw) => { if (gen === this._gen) { this._hours = parseForecast(raw, cfg.forecast_entry || undefined); this._loaded = true; } },
      () => { if (gen === this._gen) { this._hours = []; this._loaded = true; } },
    );
  }

  /** Today's generation from midnight; starts again when the day changes. */
  private _resubscribe() {
    const hass = this._hass, cfg = this._config;
    if (!hass?.connection || !cfg || !this.isConnected) return;
    const start = startOfDay(Date.now());
    const key = cfg.actual ? `${cfg.actual}|${start}` : "";
    if (key === this._histKey) return;
    this._unsub?.(); this._unsub = undefined; this._histKey = key;
    if (!cfg.actual) { this._samples = []; return; }
    this._samples = [];
    this._unsub = subscribeHistory(hass, [cfg.actual], start, (d) => { this._samples = [...(d[cfg.actual!] ?? [])]; });
  }

  override updated() {
    const el = this.shadowRoot?.querySelector(".chart") as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - this._cs.w) > 1 || Math.abs(r.height - this._cs.h) > 1) this._cs = { w: r.width, h: r.height };
  }

  /** Value of a piecewise-linear series at hour x. */
  private _at(pts: { x: number; kw: number }[], x: number): number | undefined {
    if (pts.length < 2 || x < pts[0].x || x > pts[pts.length - 1].x) return undefined;
    const i = pts.findIndex((p) => p.x >= x);
    if (i <= 0) return pts[0].kw;
    const a = pts[i - 1], b = pts[i];
    return b.x === a.x ? b.kw : a.kw + ((b.kw - a.kw) * (x - a.x)) / (b.x - a.x);
  }

  private _point = (e: PointerEvent, m: SolarModel) => {
    if (m.empty) return;
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    const L = 28, R = 6, x = m.x0 + ((e.clientX - r.left - L) / (r.width - L - R)) * (m.x1 - m.x0);
    this._hov = x >= m.x0 && x <= m.x1 ? x : undefined;
    clearTimeout(this._hovTimer);
    if (e.pointerType !== "mouse") this._hovTimer = window.setTimeout(() => (this._hov = undefined), 4000);
  };
  private _clearMouse = (e: PointerEvent) => { if (e.pointerType === "mouse") this._hov = undefined; };

  private _readout(m: SolarModel, day: Day) {
    if (m.empty) return html`<div class="readout"></div>`;
    const hhmm = clockAt;
    const kw = (v: number) => fmtNum(v, 2);
    const at = this._hov ?? (day === "today" ? m.nowX : undefined);
    if (at === undefined) return html`<div class="readout">TOMORROW - ${fmtKwh(m.forecastKwh)} kWh forecast</div>`;
    const f = this._at(m.forecast, at) ?? 0;
    const a = day === "today" && at <= (m.nowX ?? -1) ? this._at(m.actual, at) : undefined;
    const label = this._hov !== undefined ? hhmm(at) : "NOW";
    return html`<div class="readout">${label} - ${kw(f)} kW forecast${a !== undefined ? `, ${kw(a)} actual` : ""}</div>`;
  }

  private _chart(m: SolarModel, compact: boolean) {
    const { w, h } = this._cs;
    if (w < 10 || h < 10) return nothing;
    if (m.empty) {
      return this._loaded ? html`<div class="empty"><b>No forecast</b><span>Add Forecast.Solar to the solar panels in the Energy dashboard.</span></div>` : nothing;
    }
    const L = compact ? 0 : 28, R = compact ? 0 : 6, T = compact ? 4 : 10, B = compact ? 4 : 20;
    const X = (x: number) => L + ((x - m.x0) / (m.x1 - m.x0)) * (w - L - R);
    const Y = (kw: number) => T + (1 - kw / m.axis.max) * (h - T - B);
    const y0 = Y(0);
    const fp = m.forecast.map((p): [number, number] => [X(p.x), Y(p.kw)]);
    const line = smoothPath(fp, y0), area = `${line} L${fp[fp.length - 1][0].toFixed(1)},${y0.toFixed(1)} L${fp[0][0].toFixed(1)},${y0.toFixed(1)}Z`;
    const ap = m.actual.map((p): [number, number] => [X(p.x), Y(p.kw)]);
    const grid = compact ? nothing : [0, 1, 2, 3].map((i) => {
      const v = i * m.axis.step, y = Y(v);
      return svg`<line class="grid ${i ? "dash" : ""}" x1=${L} x2=${w - R} y1=${y} y2=${y}></line><text class="ax" x=${L - 6} y=${y + 3.5} text-anchor="end">${fmtNum(v, undefined, { max: 2 })}</text>`;
    });
    const xs = compact ? nothing : m.ticks.map((t) => svg`<text class="ax" x=${X(t)} y=${h - 4} text-anchor="middle">${hourLabel(t)}</text>`);
    return html`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Solar forecast chart">
      <defs><linearGradient id="fa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sol)" stop-opacity=".38"></stop><stop offset="1" stop-color="var(--sol)" stop-opacity=".04"></stop></linearGradient></defs>
      ${grid}${xs}
      <path d=${area} fill="url(#fa)"></path><path class="fa" d=${line}></path>
      ${this._hov !== undefined ? svg`<line class="hovline" x1=${X(this._hov)} x2=${X(this._hov)} y1=${T} y2=${y0}></line><circle class="dot" cx=${X(this._hov)} cy=${Y(this._at(m.forecast, this._hov) ?? 0)} r="4"></circle>` : nothing}
      ${ap.length > 1 && m.nowX !== undefined ? svg`<line class="nowline" x1=${X(m.nowX)} x2=${X(m.nowX)} y1=${compact ? 0 : T} y2=${y0}></line>
        <path class="act" d=${smoothPath(ap, y0)}></path><circle class="dot" cx=${X(m.nowX)} cy=${Y(m.nowKw ?? 0)} r=${compact ? 3 : 4}></circle>` : nothing}
    </svg>`;
  }

  /** One pill with both days, like the thermostat's modes. */
  private _seg(hasTomorrow: boolean) {
    if (!hasTomorrow) return nothing;
    return html`<div class="seg" role="group" aria-label="Day">${(["today", "tomorrow"] as Day[]).map((d) =>
      html`<button aria-pressed=${String(this._day === d)} @click=${() => { this._day = d; }}>${d === "today" ? "Today" : "Tomorrow"}</button>`)}</div>`;
  }

  private _stat(label: string, value: string, note?: string, cls = "") {
    return html`<div><div class="lab">${label}</div><div class="big">${value}<small>kWh</small></div>${note ? html`<div class="note ${cls}">${note}</div>` : nothing}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const now = Date.now(), dark = !!hass.themes?.darkMode;
    const compact = this._h > 0 && this._h < 230;
    const actualEnt = cfg.actual ? hass.states[cfg.actual] : undefined;
    const today = buildSolar({ hours: this._hours, day: "today", now, samples: cfg.actual ? this._samples : undefined, entity: actualEnt });
    const tomorrow = buildSolar({ hours: this._hours, day: "tomorrow", now });
    const hasTomorrow = !tomorrow.empty;
    const day: Day = this._day === "tomorrow" && hasTomorrow ? "tomorrow" : "today";
    const m = day === "today" ? today : tomorrow;
    const gen = day === "today" && cfg.actual && m.generatedKwh !== undefined;
    const vs = day === "tomorrow" && !today.empty && today.forecastKwh > 0 ? Math.round(((tomorrow.forecastKwh - today.forecastKwh) / today.forecastKwh) * 100) : undefined;
    const cls = `${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}`;
    const total = m.empty ? "–" : fmtKwh(m.forecastKwh);

    if (compact) {
      const sub = day === "today" ? (gen ? `${fmtKwh(m.generatedKwh!)} generated${m.pct !== undefined ? ` · ${m.pct}%` : ""}` : "") : vs !== undefined ? `${vs > 0 ? "+" : ""}${vs}% vs today` : "";
      return html`<ha-card class=${cls}><div class="inner c"><div class="l"><div class="lab">Solar · forecast</div>
        <div class="big">${total}<small>kWh</small></div>${sub ? html`<div class="note">${sub}</div>` : nothing}</div>
        <div class="r">${this._seg(hasTomorrow)}<div class="chart">${this._chart(m, true)}</div></div></div></ha-card>`;
    }
    // Four figures that do not depend on the chosen day: generated, remaining, today's forecast, tomorrow's.
    const fc = (v?: number) => (v === undefined ? "–" : fmtKwh(v));
    const stats = html`${cfg.actual && today.generatedKwh !== undefined ? this._stat("Generated", fmtKwh(today.generatedKwh), today.pct !== undefined ? `${today.pct}%` : undefined, today.pct !== undefined && today.pct >= 90 ? "good" : "") : nothing}
      ${this._stat("Remaining", today.empty ? "–" : fc(today.remainingKwh))}${this._stat("Today", today.empty ? "–" : fmtKwh(today.forecastKwh))}${hasTomorrow ? this._stat("Tomorrow", fmtKwh(tomorrow.forecastKwh)) : nothing}`;
    return html`<ha-card class=${cls}><div class="inner">
      <header><h2>${cfg.name ?? "Solar forecast"}</h2></header>
      <div class="stats">${stats}</div>
      ${this._seg(hasTomorrow)}
      <div class="chart" @pointermove=${(e: PointerEvent) => this._point(e, m)} @pointerdown=${(e: PointerEvent) => this._point(e, m)} @pointerleave=${this._clearMouse}>${this._chart(m, false)}</div>
      ${this._readout(m, day)}
    </div></ha-card>`;
  }
}
