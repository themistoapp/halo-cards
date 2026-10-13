import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { observeSize } from "../../shared/util";
import { buildAgile, fmtP, watchedAgile, type AgileModel, type Figure, type HaloAgileConfig } from "./logic";
import { styles } from "./styles";
import { clockAt, hourLabel, setLocale } from "../../shared/format";

type Day = "today" | "tomorrow";
const MIN_FIGURE = 64;

/** Little icons beside the figure labels. The octopus is drawn here (Simple Icons has no Octopus Energy mark). */
const FIG_ICON: Record<string, ReturnType<typeof svg>> = {
  current: svg`<svg class="fi cur" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2.5c-4.3 0-7.2 3-7.2 6.9 0 2.1.8 3.6 2 4.7-.2 1.7-1.2 2.6-2.7 3.2-.9.4-.7 1.7.3 1.7 2.6 0 4.4-1.2 5.2-3 .5-.1 1-.1 1.4-.1v.1c.1 1.6-.4 2.9-1.6 3.9-.8.7-.3 1.9.7 1.7 2.2-.4 3.6-2.1 3.8-5.1.4 0 .7 0 1 .1.7 1.8 2.6 3 5.2 3 1 0 1.2-1.3.3-1.7-1.5-.6-2.5-1.5-2.7-3.2 1.2-1.1 2-2.6 2-4.7 0-3.9-2.9-6.9-7.2-6.9zM9.3 9.2a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0zM12.5 9.2a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z"/></svg>`,
  lowest: svg`<svg class="fi lo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m0 0-6-6m6 6 6-6"/></svg>`,
  average: svg`<svg class="fi avg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" transform="rotate(90 12 12)" d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  highest: svg`<svg class="fi hi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>`,
};

export class HaloAgileCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-agile-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloAgileConfig> {
    const ids = Object.keys(hass?.states ?? {});
    return {
      rates_today: ids.find((e) => /^(event|sensor)\..*current_day_rates$/.test(e)),
      rates_tomorrow: ids.find((e) => /^(event|sensor)\..*next_day_rates$/.test(e)),
    };
  }

  @state() private _config?: HaloAgileConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _day: Day = "today";
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _cs = { w: 0, h: 0 };
  @state() private _sel?: number;
  private _selTimer?: number;
  private _unobserve?: () => void;
  private _timer?: number;

  setConfig(config: HaloAgileConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.rates_today) throw new Error("Choose the Octopus Energy current day rates entity (rates_today)");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (!old || watchedAgile(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 5; }
  getGridOptions() { return { columns: 12, rows: 6, min_columns: 4, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
    // The current and next rate change on the half hour.
    this._timer = window.setInterval(() => this.requestUpdate(), 60_000);
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); clearInterval(this._timer); clearTimeout(this._selTimer); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  override updated() {
    const el = this.shadowRoot?.querySelector(".chart") as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - this._cs.w) > 1 || Math.abs(r.height - this._cs.h) > 1) this._cs = { w: r.width, h: r.height };
  }

  private _seg(has: boolean) {
    if (!has) return nothing;
    return html`<div class="seg" role="group" aria-label="Day">${(["today", "tomorrow"] as Day[]).map((d) =>
      html`<button aria-pressed=${String(this._day === d)} @click=${() => { this._day = d; }}>${d === "today" ? "Today" : "Tomorrow"}</button>`)}</div>`;
  }

  private _figure(f: Figure, tight = false) {
    const label = tight ? ({ current: "Current", next: "Next" } as Record<string, string>)[f.id] ?? f.label : f.label;
    return html`<div><div class="lab">${FIG_ICON[f.id] ?? nothing}${label}</div><div class="big">${f.value}${f.value === "–" ? nothing : html`<small>p</small>`}</div></div>`;
  }

  /** Points at the bar under the finger or mouse. Mouse readouts clear on leave; touch ones fade after a few seconds. */
  private _point = (e: PointerEvent, m: AgileModel) => {
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    const L = 30, R = 4, hr = ((e.clientX - r.left - L) / (r.width - L - R)) * 24;
    const i = m.bars.findIndex((b) => hr >= b.x && hr < b.x + b.w);
    this._sel = i >= 0 ? i : undefined;
    clearTimeout(this._selTimer);
    if (e.pointerType !== "mouse") this._selTimer = window.setTimeout(() => (this._sel = undefined), 4000);
  };
  private _clearMouse = (e: PointerEvent) => { if (e.pointerType === "mouse") this._sel = undefined; };

  private _readout(m: AgileModel) {
    if (m.empty) return html`<div class="readout"></div>`;
    const hhmm = clockAt;
    const b = this._sel !== undefined ? m.bars[this._sel] : undefined;
    if (b) return html`<div class="readout">${hhmm(b.x)} - ${fmtP(b.p)}p</div>`;
    const lo = m.bars.reduce((a, c) => (c.p < a.p ? c : a));
    return html`<div class="readout">LOWEST - ${fmtP(lo.p)}p at ${hhmm(lo.x)}</div>`;
  }

  private _chart(m: AgileModel, compact: boolean) {
    const { w, h } = this._cs;
    if (w < 10 || h < 10) return nothing;
    if (m.empty) return html`<div class="empty"><b>No rates</b><span>Check the rates entity in the card settings.</span></div>`;
    const L = compact ? 0 : 30, R = compact ? 0 : 4, T = compact ? 3 : 8, B = compact ? 3 : 20;
    const X = (hr: number) => L + (hr / 24) * (w - L - R);
    const Y = (p: number) => T + (1 - (p - m.yMin) / (m.yMax - m.yMin)) * (h - T - B);
    const y0 = Y(0), gap = compact ? 0.6 : 1;
    const grid = compact ? nothing : m.ticks.map((t) => svg`<line class="grid ${t === 0 ? "zero" : "dash"}" x1=${L} x2=${w - R} y1=${Y(t)} y2=${Y(t)}></line><text class="ax" x=${L - 6} y=${Y(t) + 3.5} text-anchor="end">${t}</text>`);
    const xs = compact ? nothing : [0, 6, 12, 18].map((t) => svg`<text class="ax" x=${X(t)} y=${h - 4} text-anchor=${t === 0 ? "start" : "middle"}>${hourLabel(t)}</text>`);
    const bars = m.bars.map((b, i) => {
      const top = Y(Math.max(b.p, 0)), bottom = Y(Math.min(b.p, 0)), x = X(b.x) + gap / 2, bw = Math.max(X(b.x + b.w) - X(b.x) - gap, 1);
      return svg`<rect class="bar ${b.band} ${b.current ? "now" : ""} ${i === this._sel ? "sel" : ""}" x=${x} y=${top} width=${bw} height=${Math.max(bottom - top, 1)} rx=${compact ? 0.8 : 1.5}></rect>`;
    });
    return html`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Agile rates chart">
      ${grid}${xs}${bars}
      ${m.nowX !== undefined ? svg`<line class="nowline" x1=${X(m.nowX)} x2=${X(m.nowX)} y1=${compact ? 0 : T} y2=${y0}></line>` : nothing}
    </svg>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const dark = !!hass.themes?.darkMode, now = Date.now();
    const compact = this._h > 0 && this._h < 230;
    const today = buildAgile({ hass, cfg, day: "today", now });
    const hasTomorrow = today.hasTomorrow;
    const day: Day = this._day === "tomorrow" && hasTomorrow ? "tomorrow" : "today";
    const m = day === "today" ? today : buildAgile({ hass, cfg, day, now });
    const cls = `${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}`;

    if (compact) {
      const [first, second] = m.figures;
      return html`<ha-card class=${cls}><div class="inner c"><div class="l"><div class="lab">${first ? first.label : "Agile"}</div>
        <div class="big">${first?.value ?? "–"}${first && first.value !== "–" ? html`<small>p</small>` : nothing}</div>
        ${second ? html`<div class="note">${second.label} ${second.value === "–" ? "–" : `${second.value}p`}</div>` : nothing}</div>
        <div class="r">${this._seg(hasTomorrow)}<div class="chart">${this._chart(m, true)}</div></div></div></ha-card>`;
    }
    // As many of the ticked figures as fit, in order.
    const fit = this._w > 0 ? Math.max(Math.floor((this._w - 32) / MIN_FIGURE), 1) : m.figures.length;
    const shown = m.figures.slice(0, fit);
    const tight = this._w > 0 && (this._w - 32) / Math.max(shown.length, 1) < 88;
    return html`<ha-card class=${cls}><div class="inner">
      <header><h2>${cfg.name ?? "Agile rates"}</h2></header>
      ${shown.length ? html`<div class="stats ${tight ? "tight" : ""}">${shown.map((f) => this._figure(f, tight))}</div>` : nothing}
      ${this._seg(hasTomorrow)}
      <div class="chart" @pointermove=${(e: PointerEvent) => this._point(e, m)} @pointerdown=${(e: PointerEvent) => this._point(e, m)} @pointerleave=${this._clearMouse}>${this._chart(m, false)}</div>
      ${this._readout(m)}
    </div></ha-card>`;
  }
}
