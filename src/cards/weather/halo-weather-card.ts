import { LitElement, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { GREY_DAY, GREY_NIGHT, registerBloomProps } from "../../shared/bloom";
import { shadesFromHex } from "../../shared/colour";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, observeSize } from "../../shared/util";
import { icon } from "./icons";
import { buildWeather, forecastTypes, neededHeight, rowsFor, sectionsOf, watchedWeather, weeklyRows, type Forecasts, type HaloWeatherConfig, type WeatherModel } from "./logic";
import { styles } from "./styles";
import { setLocale } from "../../shared/format";

registerBloomProps();

const deg = (v: number | undefined) => (v === undefined ? "–" : `${v}°`);

export class HaloWeatherCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-weather-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloWeatherConfig> {
    return { entity: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("weather.")) ?? "weather.home" };
  }

  @state() private _config?: HaloWeatherConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _fc: Forecasts = {};
  @state() private _w = 0;
  @state() private _h = 0;
  private _unobserve?: () => void;
  private _subs: (() => void)[] = [];
  private _subKey = "";
  private _gen = 0;

  setConfig(config: HaloWeatherConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Choose a weather entity");
    if (this._config?.entity !== config.entity) this._unsubscribe();
    this._config = config;
    this._subscribe();
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    this._subscribe();
    if (!old || watchedWeather(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 6; }
  getGridOptions() {
    const cfg = this._config;
    const rows = cfg ? rowsFor(neededHeight(sectionsOf(cfg))) : 6;
    return { columns: 12, rows, min_columns: 4, min_rows: 2 };
  }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
    this._subscribe();
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); this._unsubscribe(); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /** Home Assistant no longer keeps the forecast in the entity: ask for it, and it is pushed whenever it changes. */
  private _subscribe() {
    const hass = this._hass, cfg = this._config;
    if (!hass?.connection?.subscribeMessage || !cfg || !this.isConnected) return;
    const types = forecastTypes(hass.states[cfg.entity]);
    const key = `${cfg.entity}|${types.join()}`;
    if (key === this._subKey) return;
    this._unsubscribe();
    this._subKey = key;
    const gen = this._gen;
    for (const type of types) {
      hass.connection.subscribeMessage<{ forecast: Forecasts["daily"] | null }>(
        (msg) => { if (gen === this._gen) this._fc = { ...this._fc, [type]: msg.forecast ?? [] }; },
        { type: "weather/subscribe_forecast", forecast_type: type, entity_id: cfg.entity },
      ).then((unsub) => { if (gen === this._gen) this._subs.push(unsub); else unsub(); }, () => { /* this entity has no such forecast */ });
    }
  }
  private _unsubscribe() {
    this._gen++;
    this._subKey = "";
    for (const u of this._subs) { try { u(); } catch { /* already closed */ } }
    this._subs = [];
    this._fc = {};
  }


  private _details(m: WeatherModel) {
    if (!m.details.length) return nothing;
    return html`<div class="stats glass">${m.details.map((d) => html`<div><div class="lab">${d.label}</div><div class="v">${d.value}${d.unit ? html`<small>${d.unit}</small>` : nothing}</div></div>`)}</div>`;
  }

  private _hoursRow(m: WeatherModel) {
    if (m.hours.length < 2) return nothing;
    return html`<div class="hours glass">${m.hours.map((h) => html`<div class="hr"><span class="lab">${h.label}</span>${icon(h.icon, 22)}<b>${deg(h.temp)}</b></div>`)}</div>`;
  }

  private _daysList(m: WeatherModel, n: number) {
    const rows = m.days.slice(0, n);
    if (!rows.length) return nothing;
    const [lo, hi] = m.scale, pc = (v: number) => ((v - lo) / (hi - lo)) * 100;
    return html`<div class="days glass">${rows.map((d) => {
      const a = pc(d.lo ?? d.hi ?? lo), b = pc(d.hi ?? d.lo ?? hi);
      return html`<div class="day"><span class="dn">${d.label}</span>${icon(d.icon, 20)}<span class="dl">${deg(d.lo)}</span>
        <div class="rng"><i style="left:${a.toFixed(1)}%;width:${Math.max(b - a, 4).toFixed(1)}%"></i>${d.today && m.temp !== undefined ? html`<u style="left:calc(${pc(m.temp).toFixed(1)}% - 3px)"></u>` : nothing}</div>
        <span class="dh">${deg(d.hi)}</span></div>`;
    })}</div>`;
  }

  /** Header, then whichever of current, hourly and weekly are ticked, one under the other. */
  private _full(m: WeatherModel, tight: boolean) {
    const cfg = this._config!, sec = sectionsOf(cfg);
    const cur = sec.includes("current");
    const hl = [m.feels !== undefined ? `Feels like ${m.feels}°` : undefined, m.hi !== undefined ? `H ${m.hi}°` : undefined, m.lo !== undefined ? `L ${m.lo}°` : undefined].filter(Boolean).join(" · ");
    const showDetails = true;
    return html`<div class="inner ${tight ? "tight" : ""}"><header><h2>${m.name}</h2>${cur ? nothing : icon(m.icon, 28, 1.6)}</header>
      ${cur ? html`<div class="big">${icon(m.icon, tight ? 56 : 64, 1.4)}</div>
        <div class="hero"><div class="t">${m.temp === undefined ? "–" : html`${m.temp}<sup>°</sup>`}</div><div class="cond">${m.conditionLabel}</div>${hl ? html`<div class="sub">${hl}</div>` : nothing}</div>
        <div class="grow"></div>${showDetails ? this._details(m) : nothing}` : html`<div class="grow"></div>`}
      ${sec.includes("hourly") ? this._hoursRow(m) : nothing}
      ${sec.includes("weekly") ? this._daysList(m, this._h > 0 ? weeklyRows(this._h, sec, cur && showDetails, tight) : 5) : nothing}</div>`;
  }

  private _compact(m: WeatherModel) {
    const sub = [m.conditionLabel, m.hi !== undefined ? `H ${m.hi}°` : undefined, m.lo !== undefined ? `L ${m.lo}°` : undefined].filter(Boolean).join(" · ");
    const n = Math.min(Math.max(Math.floor((this._w - 200) / 58), 0), 5);
    const slots = m.hours.slice(1, 1 + n);
    return html`<div class="inner c"><div class="main"><div class="lab">${m.name}</div>
      <div class="row"><div class="t">${m.temp === undefined ? "–" : html`${m.temp}<sup>°</sup>`}</div>${icon(m.icon, 32, 1.5)}</div><div class="sub">${sub}</div></div>
      ${slots.length ? html`<div class="hours glass">${slots.map((h) => html`<div class="hr"><span class="lab">${h.label}</span>${icon(h.icon, 20)}<b>${deg(h.temp)}</b></div>`)}</div>` : nothing}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const compact = this._h > 0 && this._h < 230 && sectionsOf(cfg).includes("current"), tight = this._h > 0 && this._h < 400;
    const slots = this._w > 0 && this._w < 340 ? 5 : 6;
    const m = buildWeather(hass, cfg, this._fc, { hours: slots, days: 7 });
    const dark = !!hass.themes?.darkMode;
    const c = shadesFromHex(m.glow, dark) ?? (dark ? GREY_NIGHT : GREY_DAY);
    const vars = { "--x1": "86%", "--y1": "-10%", "--x2": "50%", "--y2": "50%", "--k": String(m.available ? m.k : 0.4), "--k2": "0", "--c0": c.c0, "--c1": c.c1, "--ca": c.ca };
    return html`<ha-card class="${dark ? "dark" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)} @click=${() => fireMoreInfo(this, cfg.entity)}>
      <div class="bg"></div><div class="grain"></div>
      ${compact ? this._compact(m) : this._full(m, tight)}
    </ha-card>`;
  }
}
