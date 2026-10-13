import { LitElement, html, nothing, svg, type PropertyValues } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import type { HomeAssistant } from "../../shared/types";
import { fireMoreInfo, observeSize } from "../../shared/util";
import { position } from "../media/logic";
import { VEHICLE_IMAGES } from "../vehicle/images";
import { icon } from "../weather/icons";
import { forecastTypes, type Forecasts } from "../weather/logic";
import { linesFor, pickGreeting, toneAt } from "./greetings";
import {
  DEFAULTS, binDate, boxesOf, buildAgile, buildBins, buildCalendar, buildMediaBox, buildTodayWeather, buildVehicleBox, calendarsOf, colourOf,
  minutesOf, parseEvents, partOfDay, rank, startOfDay, triggersOf, watchedToday,
  type AgileModel, type BinsModel, type BoxId, type CalEvent, type CalendarModel, type HaloTodayConfig, type MediaModel, type Ranked, type VehicleModel, type WeatherModel,
} from "./logic";
import { styles } from "./styles";
import { language, setLocale } from "../../shared/format";

type Model = { k: "calendar"; m: CalendarModel } | { k: "weather"; m: WeatherModel } | { k: "bins"; m: BinsModel } | { k: "vehicle"; m: VehicleModel }
  | { k: "agile"; m: AgileModel } | { k: "media"; m: MediaModel };

/** Header glow by part of day: [day c0, day c1, night c0, night c1]. */
const GLOW = {
  morning: ["#f6c48a", "#fbe3c4", "#6b4a22", "#2e2316"], midday: ["#a9cdf2", "#d9e9f8", "#23466e", "#172838"],
  evening: ["#f0a08a", "#f6cfc4", "#6a2f3a", "#2a1a22"], night: ["#aab3ee", "#dfe3f8", "#26306b", "#161a33"],
};

const binIcon = (c: string) => svg`<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="11" y="2.5" width="8" height="2.4" rx="1.2" fill=${c} style="filter:brightness(.82)"/><rect x="4.5" y="4.6" width="21" height="4" rx="1.6" fill=${c} style="filter:brightness(.82)"/><path d="M6.4 9.6h17.2l-1.7 15.2a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z" fill=${c}/><path d="M11 13v9M15 13v9M19 13v9" stroke="rgba(255,255,255,.22)" stroke-width="1.2" stroke-linecap="round"/><circle cx="9.6" cy="26.6" r="2.1" fill="#2a2a2e" stroke=${c} stroke-width="1"/></svg>`;
const PAUSE = svg`<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>`;

export class HaloTodayCard extends LitElement {
  static override styles = [themeStyles, shadowStyles, styles];

  static getConfigElement() { return document.createElement("halo-today-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloTodayConfig> {
    const ids = Object.keys(hass?.states ?? {});
    return {
      greeting: "cheeky", weather: ids.find((e) => e.startsWith("weather.")), calendars: ids.filter((e) => e.startsWith("calendar.")).slice(0, 3),
      rates_today: ids.find((e) => /^(event|sensor)\..*current_day_rates$/.test(e)), rates_tomorrow: ids.find((e) => /^(event|sensor)\..*next_day_rates$/.test(e)),
    };
  }

  @state() private _config?: HaloTodayConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _fc: Forecasts = {};
  @state() private _events: CalEvent[] = [];
  @state() private _binEvents: CalEvent[] = [];
  @state() private _w = 0;
  @state() private _offset = 0;
  @state() private _swap = false;

  private _unobserve?: () => void;
  private _timer?: number;
  private _subs: (() => void)[] = [];
  private _subKey = "";
  private _gen = 0;
  private _fetchKey = "";
  private _fetchedAt = 0;
  private _plays: { title: string; t: number }[] = [];
  private _lastTitle = "";
  private _lastStamp = "";
  private _rects?: Map<string, DOMRect>;

  setConfig(config: HaloTodayConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (this._config?.weather !== config.weather) this._unsubscribe();
    this._config = config;
    this._subscribe();
    this._fetch();
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    this._subscribe();
    this._trackPlays(hass);
    const cals = [...calendarsOf(this._config).map((c) => c.entity), ...(this._config.bins ?? []).map((b) => b.entity).filter((e) => e.startsWith("calendar."))];
    // A calendar's state changes when an event starts or ends: look again.
    if (!old || cals.some((id) => old.states[id] !== hass.states[id])) this._fetch(!!old && Date.now() - this._fetchedAt > 30_000);
    if (!old || old.themes?.darkMode !== hass.themes?.darkMode || watchedToday(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w) => { if (Math.abs(w - this._w) > 1) this._w = w; });
    // Countdowns tick each minute; calendars are fetched again every five.
    this._timer = window.setInterval(() => { this.requestUpdate(); this._fetch(); }, 60_000);
    this._subscribe();
    this._fetch(true);
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); clearInterval(this._timer); this._unsubscribe(); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /* ---------- Data ---------- */

  private async _fetch(force = false) {
    const hass = this._hass, cfg = this._config;
    if (!hass?.callApi || !cfg || !this.isConnected) return;
    const cals = calendarsOf(cfg);
    const binCals = [...new Set((cfg.bins ?? []).map((b) => b.entity).filter((e) => e?.startsWith("calendar.")))];
    if (!cals.length && !binCals.length) { this._events = []; this._binEvents = []; return; }
    const key = JSON.stringify([cals, binCals, cfg.calendar_days]);
    if (!force && key === this._fetchKey && Date.now() - this._fetchedAt < 5 * 60_000) return;
    this._fetchKey = key; this._fetchedAt = Date.now();
    const now = Date.now(), start = new Date(startOfDay(now)).toISOString();
    const days = Math.min(Math.max(cfg.calendar_days ?? DEFAULTS.calendar_days, 1), 31);
    const get = (id: string, end: number) => hass.callApi!<unknown>("GET", `calendars/${id}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(new Date(end).toISOString())}`).catch(() => []);
    const name = (id: string) => String(hass.states[id]?.attributes.friendly_name ?? id.split(".")[1]);
    const [evs, bins] = await Promise.all([
      Promise.all(cals.map((c, i) => get(c.entity, startOfDay(now, days + 1)).then((r) => parseEvents(r, { entity: c.entity, colour: colourOf(cals, i), name: c.name || name(c.entity) })))),
      Promise.all(binCals.map((id) => get(id, startOfDay(now, 36)).then((r) => parseEvents(r, { entity: id, colour: "", name: "" })))),
    ]);
    if (key !== this._fetchKey) return;
    this._events = evs.flat();
    this._binEvents = bins.flat();
  }

  /** Same forecast subscription as the Weather card. */
  private _subscribe() {
    const hass = this._hass, cfg = this._config;
    if (!hass?.connection?.subscribeMessage || !cfg?.weather || !this.isConnected || !boxesOf(cfg).includes("weather")) return;
    const types = forecastTypes(hass.states[cfg.weather]);
    const key = `${cfg.weather}|${types.join()}`;
    if (key === this._subKey) return;
    this._unsubscribe();
    this._subKey = key;
    const gen = this._gen;
    for (const type of types) {
      hass.connection.subscribeMessage<{ forecast: Forecasts["daily"] | null }>(
        (msg) => { if (gen === this._gen) this._fc = { ...this._fc, [type]: msg.forecast ?? [] }; },
        { type: "weather/subscribe_forecast", forecast_type: type, entity_id: cfg.weather },
      ).then((unsub) => { if (gen === this._gen) this._subs.push(unsub); else unsub(); }, () => { /* no such forecast */ });
    }
  }
  private _unsubscribe() {
    this._gen++;
    this._subKey = "";
    for (const u of this._subs) { try { u(); } catch { /* already closed */ } }
    this._subs = [];
    this._fc = {};
  }

  /** Notes each time a track starts (a new title, or the same one back at the start), to spot one played three times in an hour. */
  private _trackPlays(hass: HomeAssistant) {
    for (const id of this._config?.media ?? []) {
      const s = hass.states[id];
      if (s?.state !== "playing" || !s.attributes.media_title) continue;
      const title = String(s.attributes.media_title), stamp = String(s.attributes.media_position_updated_at ?? ""), atStart = position(s) < 15;
      const fresh = title !== this._lastTitle || (atStart && stamp !== this._lastStamp);
      this._lastTitle = title;
      if (atStart) this._lastStamp = stamp;
      const last = this._plays[this._plays.length - 1];
      if (fresh && !(last && last.title === title && Date.now() - last.t < 90_000)) this._plays.push({ title, t: Date.now() });
    }
    this._plays = this._plays.filter((p) => Date.now() - p.t < 3_600_000);
  }
  private _repeat(): string | undefined {
    const counts = new Map<string, number>();
    for (const p of this._plays) counts.set(p.title, (counts.get(p.title) ?? 0) + 1);
    return [...counts].find(([, n]) => n >= 3)?.[0];
  }

  /* ---------- Slide boxes to their new place when the order changes ---------- */

  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    if (!this.hasUpdated || matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rects = new Map<string, DOMRect>();
    this.renderRoot.querySelectorAll<HTMLElement>(".bx[data-k]").forEach((el) => rects.set(el.dataset.k!, el.getBoundingClientRect()));
    this._rects = rects;
  }
  protected override updated() {
    const before = this._rects;
    this._rects = undefined;
    if (!before?.size) return;
    this.renderRoot.querySelectorAll<HTMLElement>(".bx[data-k]").forEach((el) => {
      const a = el.getBoundingClientRect(), b = before.get(el.dataset.k!);
      if (!el.animate) return;
      if (!b) { el.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" }); return; }
      const dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
  }

  /* ---------- Boxes ---------- */

  private _calendar(m: CalendarModel) {
    return html`<div class="hd"><span class="lab">${m.header}</span>${m.pill ? html`<span class="pill ${m.pill.solid ? "" : "soft"}">${m.pill.text}</span>` : nothing}</div>
      <ol class="evs">${m.events.map((e) => html`<li class="e" style=${styleMap({ "--c": e.colour })}><i class="cb"></i><div class="tm">${e.start}<span>${e.end}</span></div>
        <div class="bd"><div class="tt">${e.title}</div>${e.meta ? html`<div class="mt">${e.meta}</div>` : nothing}${e.progress !== undefined ? html`<div class="prog"><i style="width:${e.progress}%"></i></div>` : nothing}</div></li>`)}</ol>
      ${m.more ? html`<div class="more">${m.more}</div>` : nothing}`;
  }

  private _weather(m: WeatherModel) {
    return html`<div class="hd"><span class="lab">Weather</span><span class="pill ${m.tier === 2 ? "" : "soft"}">${m.pill}</span></div>
      <div class="wnow">${icon(m.icon, 28, 1.6)}<span class="big">${m.temp ?? "–"}°</span><div class="cond">${m.cond}${m.hilo ? html`<span>${m.hilo}</span>` : nothing}</div></div>
      ${m.hours.length > 1 ? html`<div class="hrs" style="--n:${m.hours.length}">${m.hours.map((h, i) => html`<div class="hr"><span class="t ${i ? "" : "now"}">${h.label}</span>${icon(h.icon, 18)}
        <span class="v">${h.temp === undefined ? "–" : `${h.temp}°`}</span><span class="rb"><i style="height:${Math.max(1, Math.round(h.rain * 14))}px"></i></span><span class="p">${h.note ?? ""}</span></div>`)}</div>` : nothing}`;
  }

  private _bins(m: BinsModel) {
    return html`<div class="hd"><span class="lab">Bins</span>${m.pill ? html`<span class="pill">${m.pill}</span>` : nothing}</div>
      ${m.bins.map((b) => html`<div class="brow ${b.later ? "later" : ""}">${binIcon(b.colour)}<div class="nm"><b>${b.name}</b><span class=${b.out ? "out" : ""}>${b.line}</span></div>
        <div class="cd"><span class="big ${b.unit ? "" : "word"}">${b.count}</span>${b.unit ? html`<span class="u">${b.unit}</span>` : nothing}</div></div>`)}`;
  }

  private _vehicle(m: VehicleModel) {
    const src = m.image || (m.preset && m.preset !== "none" ? VEHICLE_IMAGES[m.preset] : undefined);
    return html`<div class="hd"><span class="lab">${m.name}</span><span class="pill">${m.kind === "ev" ? "Plug in" : "Fill up"}</span></div>
      ${src ? html`<img src=${src} alt="" />` : nothing}<div class="fill"></div>
      <div class="row"><span class="big">${m.pct}<small>%</small></span>${m.range ? html`<span class="sub">${m.range}</span>` : nothing}</div>
      <div class="stripe"><i style="width:${m.pct}%"></i></div>`;
  }

  private _agile(m: AgileModel) {
    return html`<div class="hd"><span class="lab">${m.title}</span></div>
      <ul class="slots">${m.slots.map((s) => html`<li class="slot"><span class="tm">${s.start}<span>–${s.end}</span></span>${s.pill ? html`<span class="pill">${s.pill}</span>` : nothing}<span class="pr">${s.price}</span></li>`)}</ul>
      <div class="dayb" aria-hidden="true">${m.bars.map((b) => html`<i class=${b.pick ? "pick" : ""} style="height:${Math.round(b.h * 100)}%"></i>`)}</div>`;
  }

  private _media(m: MediaModel) {
    const art = m.art ? { backgroundImage: `url("${m.art}")` } : {};
    return html`<div class="art" style=${styleMap(art)}></div>
      <div class="meta" @click=${() => fireMoreInfo(this, m.entity)}><b>${m.title}</b><span>${[m.artist, m.room].filter(Boolean).join(" · ")}</span>
        ${m.progress !== undefined ? html`<div class="prog"><i style="width:${m.progress}%"></i></div>` : nothing}</div>
      <button class="pp" aria-label="Pause" @click=${(e: Event) => { e.stopPropagation(); this._hass!.callService("media_player", "media_play_pause", { entity_id: m.entity }); }}><svg viewBox="0 0 24 24">${PAUSE}</svg></button>`;
  }

  private _box(r: Ranked<Model>) {
    const d = r.data, full = !r.half || r.solo ? "full" : "";
    if (d.k === "media") return html`<div class="bx np ${full}" data-k=${r.key}>${this._media(d.m)}</div>`;
    const [body, cls, entity, tint] =
      d.k === "calendar" ? [this._calendar(d.m), "tall", d.m.entity, ""]
      : d.k === "weather" ? [this._weather(d.m), "tall", d.m.entity, ""]
      : d.k === "bins" ? [this._bins(d.m), `mid ${d.m.tier === 1 ? "hot" : ""}`, d.m.entity, d.m.tint]
      : d.k === "vehicle" ? [this._vehicle(d.m), "veh mid hot", d.m.entity, "#d6453d"]
      : [this._agile(d.m), "mid", d.m.entity, ""];
    return html`<button class="bx ${cls} ${full}" data-k=${r.key} style=${styleMap(tint ? { "--t": tint } : {})} @click=${() => fireMoreInfo(this, entity)}>${body}</button>`;
  }

  private _next() {
    this._swap = true;
    setTimeout(() => { this._offset++; this._swap = false; }, 200);
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const now = new Date(), ms = now.getTime(), dark = !!hass.themes?.darkMode, locale = language();
    const order = boxesOf(cfg), on = (b: BoxId) => order.includes(b), at = (b: BoxId) => order.indexOf(b);
    const cals = calendarsOf(cfg);

    const cal = on("calendar") && cals.length ? buildCalendar(this._events, ms, locale) : undefined;
    const wx = on("weather") && cfg.weather ? buildTodayWeather(hass, cfg.weather, this._fc, now, Math.min(Math.max(cfg.weather_hours ?? DEFAULTS.weather_hours, 4), 12)) : undefined;
    const binRows = (cfg.bins ?? []).filter((b) => b?.entity && b.name);
    const bins = on("bins") && binRows.length ? buildBins(binRows, binRows.map((b) => binDate(hass, b, ms, this._binEvents)), ms, {
      within: cfg.bins_within ?? DEFAULTS.bins_within, outFrom: minutesOf(cfg.bins_out_from, DEFAULTS.bins_out_from), dark, locale,
    }) : undefined;
    const vehicles = on("vehicles") ? (cfg.vehicles ?? []).filter((v) => v?.level).map((v) => buildVehicleBox(hass, v, cfg.low_below ?? DEFAULTS.low_below)).filter((v): v is VehicleModel => !!v) : [];
    const agile = on("agile") ? buildAgile(hass, cfg, ms) : undefined;
    const media = on("media") ? buildMediaBox(hass, cfg.media, ms) : undefined;

    const items: Ranked<Model>[] = [];
    if (media) items.push({ key: "media", box: "media", half: false, tier: 0, order: at("media"), data: { k: "media", m: media } });
    if (cal) items.push({ key: "calendar", box: "calendar", half: false, tier: cal.tier, order: at("calendar"), data: { k: "calendar", m: cal } });
    if (wx) items.push({ key: "weather", box: "weather", half: false, tier: wx.tier, order: at("weather"), data: { k: "weather", m: wx } });
    if (bins) items.push({ key: "bins", box: "bins", half: true, tier: bins.tier, order: at("bins"), data: { k: "bins", m: bins } });
    vehicles.forEach((v, i) => items.push({ key: `vehicle-${i}-${v.entity}`, box: "vehicles", half: true, tier: 1, order: at("vehicles") + i / 10, data: { k: "vehicle", m: v } }));
    if (agile) items.push({ key: "agile", box: "agile", half: true, tier: agile.tier, order: at("agile"), data: { k: "agile", m: agile } });
    const ranked = rank(items);

    const tone = toneAt(cfg.greeting ?? "cheeky", !!cfg.watershed, minutesOf(cfg.watershed_from, DEFAULTS.watershed_from), now);
    const fired = triggersOf({ now, calendar: cal, weather: wx, bins, agile, vehicles, media, repeat: this._repeat(), hasCalendars: cals.length > 0 });
    const name = cfg.name ?? hass.user?.name?.split(" ")[0] ?? "";
    const greeting = pickGreeting(linesFor(fired, tone, name, cfg.greetings), now, this._offset, `${tone}|${fired.map((f) => f.id).join()}`);

    const g = GLOW[partOfDay(now)], c = dark ? [g[2], g[3]] : [g[0], g[1]];
    const date = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    const header = cfg.header ?? "greeting";
    const title = header === "none" ? html`<div class="ttl none"></div>`
      : header === "date" ? html`<div class="ttl date"><div class="num">${now.getDate()}</div><div class="tx"><h3>${now.toLocaleDateString(locale, { weekday: "long" })} · ${now.toLocaleDateString(locale, { month: "long" })}</h3>
          <p class=${this._swap ? "swap" : ""} @click=${this._next}>${greeting}</p></div></div>`
      : html`<div class="ttl"><div class="lab">${date}</div><h2 class=${this._swap ? "swap" : ""} @click=${this._next} title="Tap for another">${greeting}</h2></div>`;
    const configured = cals.length || cfg.weather || binRows.length || cfg.vehicles?.length || cfg.rates_today || cfg.media?.length;

    return html`<ha-card class="${dark ? "dark" : ""} ${this._w >= 640 ? "w" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap({ "--c0": c[0], "--c1": c[1] })}>
      <div class="bg"></div><div class="grain"></div>
      ${title}
      ${ranked.length ? html`<div class="grid">${ranked.map((r) => this._box(r))}</div>`
        : html`<div class="empty">${configured ? "Nothing to show right now." : "Add your calendars, weather, bins, vehicles, Agile rates and speakers in the editor."}</div>`}
    </ha-card>`;
  }
}
