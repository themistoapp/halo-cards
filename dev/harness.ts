import "../src/index";
import { MDI } from "./mdi-sample";
import { agilePreset, solarPreset } from "../src/cards/graph/logic";
import type { HomeAssistant } from "../src/shared/types";

// Browser-only mock of Home Assistant: static states, a synthetic history, and a gallery of every card and size.
if (!customElements.get("ha-icon")) customElements.define("ha-icon", class extends HTMLElement {
  private _i = "";
  set icon(v: string) { this._i = v; this._draw(); }
  get icon() { return this._i; }
  connectedCallback() { this.style.cssText = "display:inline-flex;width:var(--mdc-icon-size,20px);height:var(--mdc-icon-size,20px)"; this._draw(); }
  private _draw() { const d = MDI[this._i] ?? MDI["mdi:palette"]; (this.shadowRoot ?? this.attachShadow({ mode: "open" })).innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="${d}"/></svg>`; }
});
// Home Assistant's own ha-card gives every card its rounded corners; the cards' own styles win over these.
if (!customElements.get("ha-card")) customElements.define("ha-card", class extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:block;border-radius:var(--ha-card-border-radius,12px)}</style><slot></slot>`; }
});
const q = new URLSearchParams(location.search);
const only = q.get("only");
// ?now=14:05 pins the clock so solar screenshots are repeatable.
const pin = q.get("now");
if (pin) {
  const RealDate = Date, [hh, mm] = pin.split(":").map(Number), t = new RealDate(); t.setHours(hh, mm, 0, 0);
  const off = t.getTime() - RealDate.now();
  (globalThis as any).Date = class extends RealDate {
    constructor(...a: any[]) { if (a.length === 0) super(RealDate.now() + off); else super(...(a as [any])); }
    static override now() { return RealDate.now() + off; }
  };
}
const now = new Date().toISOString();
const e = (id: string, state: string, attributes: Record<string, unknown> = {}) => [id, { entity_id: id, state, attributes, last_updated: now, last_changed: now }] as const;

function art(c1: string, c2: string) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!; const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return c.toDataURL();
}

const FEATS = 1 | 4 | 8 | 16 | 32 | 512 | 16384 | 32768 | 262144;
function states(over: Record<string, ReturnType<typeof e>[1]> = {}) {
  return {
    ...Object.fromEntries([
      e("sensor.solar_power", "820", { unit_of_measurement: "W" }), e("sensor.solar_today", "5.4", { unit_of_measurement: "kWh" }),
      e("sensor.solar_forecast", "9.1", { unit_of_measurement: "kWh" }), e("sensor.soc", "62", { unit_of_measurement: "%" }),
      e("sensor.battery_power", "350", { unit_of_measurement: "W" }), e("sensor.grid_power", "630", { unit_of_measurement: "W" }),
      e("sensor.grid_cost", "1.59", { unit_of_measurement: "£" }), e("sensor.home_power", "1800", { unit_of_measurement: "W", device_class: "power", state_class: "measurement" }),
      e("number.reserve", "65", { min: 0, max: 100, step: 5 }), e("select.mode", "Self-powered", { options: ["Self-powered", "AI"] }),
      e("media_player.lounge", "playing", { friendly_name: "Living room", supported_features: FEATS, media_title: "Sample track title", media_artist: "Sample artist", media_album_name: "Sample album", media_duration: 238, media_position: 102, media_position_updated_at: now, volume_level: 0.34, entity_picture: q.has("red") ? art("#d4202a", "#7a0f16") : art("#f2a03d", "#e0407a"), group_members: ["media_player.lounge", "media_player.kitchen"], repeat: "all" }),
      e("media_player.kitchen", "playing", { friendly_name: "Kitchen", supported_features: FEATS }),
      e("media_player.bedroom", "idle", { friendly_name: "Bedroom", supported_features: FEATS }),
      e("media_player.study", "idle", { friendly_name: "Study", supported_features: FEATS, volume_level: 0.4 }),
      e("sensor.sonos_favorites", "5", { items: { a: "Morning Mix", b: "Chill Evenings", c: "Radio 6", d: "Jazz Classics", e: "Focus" } }),
      e("sensor.fuel", "32", { unit_of_measurement: "L" }), e("sensor.petrol_range", "312", { unit_of_measurement: "mi" }), e("sensor.petrol_odo", "24310", { unit_of_measurement: "mi" }),
      e("lock.m140i", "locked"), e("device_tracker.m140i", "home"), e("zone.home", "0", { friendly_name: "Home" }),
      e("sensor.van_soc", "64", { unit_of_measurement: "%" }), e("sensor.van_range", "148", { unit_of_measurement: "mi" }), e("sensor.van_odo", "18902", { unit_of_measurement: "mi" }),
      e("binary_sensor.van_charging", "on"), e("device_tracker.van", "depot"),
      e("scene.movie", "2026-10-12T19:00:00Z", { friendly_name: "Movie", icon: "mdi:movie-open" }), e("scene.relax", "2026-10-12T18:00:00Z", { friendly_name: "Relax", icon: "mdi:sofa" }),
      e("scene.bright", "2026-10-12T08:00:00Z", { friendly_name: "Bright", icon: "mdi:white-balance-sunny" }), e("scene.night", "2026-10-12T22:00:00Z", { friendly_name: "Night", icon: "mdi:weather-night" }),
      e("climate.hallway", "heat", { friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], hvac_action: "heating", current_temperature: 19.4, temperature: 22, min_temp: 9, max_temp: 32, target_temp_step: 0.5, current_humidity: 48 }),
      e("climate.cooling", "cool", { friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], hvac_action: "cooling", current_temperature: 24.1, temperature: 21, min_temp: 9, max_temp: 32, current_humidity: 52 }),
      e("climate.idle", "heat", { friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], hvac_action: "idle", current_temperature: 21.5, temperature: 21, min_temp: 9, max_temp: 32, current_humidity: 47 }),
      e("climate.off", "off", { friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], hvac_action: "off", current_temperature: 20.5, temperature: 21, min_temp: 9, max_temp: 32, current_humidity: 47 }),
      e("climate.range", "heat_cool", { friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], hvac_action: "heating", current_temperature: 18.7, target_temp_low: 19.5, target_temp_high: 24, min_temp: 9, max_temp: 32, current_humidity: 50 }),
      e("sun.sun", "above_horizon"),
      e("event.agile_today", "2026-10-12T00:00:00Z", { rates: agileRates(0, false) }), e("event.agile_tomorrow", "2026-10-13T00:00:00Z", { rates: agileRates(1, true) }),
      e("sensor.pv_total", String(Math.round(solarAct(new Date().getHours() + new Date().getMinutes() / 60) * 1000)), { friendly_name: "PV total", unit_of_measurement: "W", device_class: "power" }),
      e("weather.home", "partlycloudy", { friendly_name: "Swindon", temperature: 14.4, humidity: 72, pressure: 1008.3, pressure_unit: "hPa", wind_speed: 22.4, wind_speed_unit: "km/h", wind_bearing: 225, cloud_coverage: 48, dew_point: 9.1, supported_features: 3 }),
      e("weather.rain", "rainy", { friendly_name: "Swindon", temperature: 11.2, humidity: 91, pressure: 998, pressure_unit: "hPa", wind_speed: 30, wind_speed_unit: "km/h", wind_bearing: 250, supported_features: 3 }),
      e("weather.night", "clear-night", { friendly_name: "Swindon", temperature: 8.6, humidity: 80, pressure: 1016, pressure_unit: "hPa", wind_speed: 8, wind_speed_unit: "km/h", wind_bearing: 20, supported_features: 3 }),
      e("weather.nofc", "sunny", { friendly_name: "Swindon", temperature: 21, humidity: 40, supported_features: 0 }),
      e("light.pendant", "on", { friendly_name: "Pendant", supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 2700, brightness: 230 }),
      e("light.downlight", "on", { friendly_name: "Downlights", supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 4000, brightness: 140 }),
      e("light.shelf", "on", { friendly_name: "Shelf bar", supported_color_modes: ["rgb"], color_mode: "rgb", rgb_color: [255, 90, 160], brightness: 200 }),
      e("light.tower", "on", { friendly_name: "Corner bar", supported_color_modes: ["rgb"], color_mode: "rgb", rgb_color: [70, 140, 255], brightness: 255 }),
      e("light.hall", "off", { friendly_name: "Hall", supported_color_modes: ["color_temp"] }),
      e("light.lamp", "on", { friendly_name: "Lamp", supported_color_modes: ["onoff"] }),
      e("calendar.family", "off", { friendly_name: "Family" }), e("calendar.work", "off", { friendly_name: "Work" }), e("calendar.school", "off", { friendly_name: "School" }),
      e("sensor.recycling_next", dayIso(1), { friendly_name: "Recycling" }), e("sensor.waste_next", "in 8 days", { friendly_name: "Waste", daysTo: 8 }),
    ]),
    ...over,
  };
}

const shape: Record<string, (x: number) => number> = {
  "sensor.solar_power": (x) => Math.max(0, Math.sin(x * Math.PI)) * 1100, "sensor.soc": (x) => 30 + x * 32,
  "sensor.battery_power": (x) => 200 + Math.sin(x * 9) * 150, "sensor.grid_power": (x) => 900 - x * 300 + Math.sin(x * 12) * 120,
  "sensor.home_power": (x) => 1400 + Math.sin(x * 7) * 500,
};


const solarFc = (day: number, peak: number, dip: number) => (t: number) => t < 7.2 || t > 17.9 ? 0 : peak * Math.sin(Math.PI * (t - 7.2) / 10.7) ** 1.5 * (1 - dip * Math.exp(-(((t - 11) / 0.9) ** 2)));
const solarAct = (t: number) => solarFc(0, 1, 0)(t) * (0.9 - 0.4 * Math.exp(-(((t - 10.3) / 0.7) ** 2)) + 0.12 * Math.exp(-(((t - 13) / 1.2) ** 2)));
// Agile: 48 half-hour slots in £/kWh with an overnight dip and a 16:00-19:00 peak; tomorrow dips negative at 03:00.
function agileRates(plusDays: number, negative: boolean) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() + plusDays);
  return Array.from({ length: 48 }, (_, i) => {
    const t = i / 2, start = new Date(d0.getTime() + i * 1_800_000), end = new Date(start.getTime() + 1_800_000);
    let p = 17 + 6 * Math.sin((t - 6) / 24 * 2 * Math.PI) - 8 * Math.exp(-(((t - 3.5) / 2) ** 2)) + 22 * Math.exp(-(((t - 17.5) / 1.4) ** 2)) + 4 * Math.exp(-(((t - 8) / 1) ** 2));
    if (negative) p -= 20 * Math.exp(-(((t - 3) / 1.1) ** 2));
    return { start: start.toISOString(), end: end.toISOString(), value_inc_vat: Math.round(p * 100) / 10000, is_capped: false };
  });
}
function solarForecast() {
  const out: Record<string, number> = {};
  for (const [day, peak, dip] of [[0, 1, 0], [1, 0.9, 0.3]] as const) {
    const f = solarFc(day, peak, dip);
    for (let h = 7; h <= 17; h++) { let wh = 0; for (let i = 0; i < 20; i++) wh += f(h + (i + 0.5) / 20) * 1000 / 20; const d = new Date(); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() + day); out[d.toISOString()] = Math.round(wh); }
  }
  return { entry1: { wh_hours: out } };
}

const CONDS = ["partlycloudy", "partlycloudy", "sunny", "cloudy", "rainy", "rainy", "pouring", "cloudy", "sunny", "sunny"];
function forecast(kind: string, night = false) {
  const t = new Date(); t.setMinutes(0, 0, 0);
  if (kind === "hourly") return Array.from({ length: 24 }, (_, i) => { const d = new Date(t.getTime() + i * 3600e3); const c = CONDS[i % CONDS.length]; return { datetime: d.toISOString(), condition: night && c === "sunny" ? "clear-night" : c, temperature: 14 + Math.round(Math.sin(i / 3) * 3), is_daytime: !night, precipitation_probability: c === "pouring" ? 90 : c === "rainy" ? 70 : c === "cloudy" ? 20 : 5 }; });
  const d0 = new Date(); d0.setHours(12, 0, 0, 0);
  const days: [string, number, number][] = [["partlycloudy", 16, 9], ["rainy", 13, 8], ["pouring", 12, 7], ["sunny", 14, 6], ["cloudy", 15, 8], ["rainy", 13, 9], ["sunny", 17, 7]];
  return days.map(([condition, temperature, templow], i) => ({ datetime: new Date(d0.getTime() + i * 86400e3).toISOString(), condition, temperature, templow }));
}

// Today card: calendars relative to today, and a bin date.
const at = (plus: number, h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + plus); return d.toISOString(); };
function dayIso(plus: number) { const d = new Date(); d.setDate(d.getDate() + plus); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function calendarEvents(id: string) {
  const ev = (summary: string, p: number, h: number, m: number, h2: number, m2: number, location?: string) => ({ summary, location, start: { dateTime: at(p, h, m) }, end: { dateTime: at(p, h2, m2) } });
  if (id === "calendar.family") return [ev("Dentist, Sarah", 0, 13, 0, 14, 0, "Hart Dental, Bath Road"), ev("Swimming lesson", 0, 17, 30, 18, 30, "Leisure centre"), ev("Boiler service", 1, 10, 0, 12, 0, "Engineer arrives between 10 and 12"), { summary: "Mum's birthday", start: { date: dayIso(0) }, end: { date: dayIso(1) } }];
  if (id === "calendar.school") return [ev("School drop-off", 0, 8, 15, 8, 45, "St Mary's Primary"), ev("School pick-up", 0, 15, 15, 15, 45, "St Mary's Primary"), ev("School drop-off", 1, 8, 15, 8, 45, "St Mary's Primary")];
  if (id === "calendar.work") return [ev("Stand-up and planning", 0, 9, 30, 10, 15, "Teams"), ev("Lunch with Tom", 1, 12, 30, 13, 30, "Côte, Milsom Street")];
  return [];
}

function makeHass(dark: boolean, over = {}): HomeAssistant {
  const st = states(over) as Record<string, any>;
  return {
    states: st, themes: { darkMode: dark }, config: { unit_system: { temperature: "°C" } },
    entities: { "media_player.lounge": { device_id: "d1" }, "media_player.study": { device_id: "d2" } },
    devices: { d1: { model: "Era 300" }, d2: { model: "Sonos One" } },
    connection: {
      async subscribeMessage(cb: (m: unknown) => void, msg: { entity_ids: string[]; start_time: string; type?: string; forecast_type?: string }) {
        if (msg.type === "weather/subscribe_forecast") { setTimeout(() => cb({ type: msg.forecast_type, forecast: forecast(msg.forecast_type!, (msg as any).entity_id === "weather.night") }), 30); return () => {}; }
        const t0 = Date.parse(msg.start_time), t1 = Date.now(); const out: Record<string, { s: string; lu: number }[]> = {};
        for (const id of msg.entity_ids) out[id] = Array.from({ length: 120 }, (_, i) => ({ s: String(id === "sensor.pv_total" ? Math.round(solarAct(new Date(t0 + (i / 119) * (t1 - t0)).getHours() + new Date(t0 + (i / 119) * (t1 - t0)).getMinutes() / 60) * 1000) : (shape[id]?.(i / 119)) ?? 0), lu: (t0 + (i / 119) * (t1 - t0)) / 1000 }));
        setTimeout(() => cb({ states: out }), 50); return () => {};
      },
    },
    async callService(d: string, s: string, data: Record<string, unknown>) { console.log("service", d, s, data); },
    async callApi(_m: string, path: string) { return calendarEvents(path.split("?")[0].replace("calendars/", "")); },
    async callWS(m: { type?: string; statistic_ids?: string[]; start_time?: string }) {
      if (m?.type === "energy/solar_forecast") return solarForecast();
      if (m?.type === "recorder/statistics_during_period") {
        const t0 = Date.parse(m.start_time!), n = Math.floor((Date.now() - t0) / 3600e3);
        return Object.fromEntries((m.statistic_ids ?? []).map((id) => [id, Array.from({ length: n }, (_, i) => ({ start: t0 + i * 3600e3, mean: shape[id]?.(((i % 24) / 24)) ?? 0 }))]));
      }
      return { children: [] };
    },
  } as unknown as HomeAssistant;
}

const energy = { type: "custom:halo-energy-card", solar_power: "sensor.solar_power", solar_energy: "sensor.solar_today", solar_forecast: "sensor.solar_forecast", battery_soc: "sensor.soc", battery_power: "sensor.battery_power", grid_power: "sensor.grid_power", grid_cost: "sensor.grid_cost", home_power: "sensor.home_power", reserve_entity: "number.reserve", mode_entity: "select.mode" };
const media = { type: "custom:halo-media-card", entity: "media_player.lounge", players: ["media_player.lounge", "media_player.kitchen", "media_player.bedroom", "media_player.study"] };
const m140i = { type: "custom:halo-vehicle-card", name: "M140i", fuel_type: "ice", image_preset: "m140i", colour: "#b3262f", level: "sensor.fuel", tank_size: 52, range: "sensor.petrol_range", odometer: "sensor.petrol_odo", lock: "lock.m140i", location: "device_tracker.m140i" };
const van = { type: "custom:halo-vehicle-card", name: "e-Vivaro", fuel_type: "ev", image_preset: "e-vivaro", colour: "#2fbf4a", level: "sensor.van_soc", range: "sensor.van_range", odometer: "sensor.van_odo", charging: "binary_sensor.van_charging", location: "device_tracker.van" };

const lights = { type: "custom:halo-light-card", name: "Living room", lights: [
  { entity: "light.pendant", type: "pendant" }, { entity: "light.downlight", type: "downlight" }, { entity: "light.shelf", name: "Shelf", type: "strip" },
  { entity: "light.tower", name: "Corner", type: "pole" }, { entity: "light.hall", type: "downlight" }, { entity: "light.lamp" } ] };

const scenes = { type: "custom:halo-scenes-card", scenes: [{ entity: "scene.movie", colour: "#7a5cf0" }, { entity: "scene.relax", colour: "#e8803d" }, { entity: "scene.bright", colour: "#e8b923" }, { entity: "scene.night", colour: "#3d6ee8" }] };

// Custom icons: pasted markup (a sun with a black outline and white face, to show the ink/surface swap) and a bare MDI path.
const SUN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="11" fill="#F9C74F" stroke="#000" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="#fff"/><g stroke="#F9C74F" stroke-width="4" stroke-linecap="round"><path d="M32 7V14M32 50V57M7 32H14M50 32H57"/><path d="M14.3 14.3L19 19M45 45L49.7 49.7M49.7 14.3L45 19M19 45L14.3 49.7"/></g></svg>`;
const tile = (cfg: object) => ({ type: "custom:halo-entity-card", ...cfg });
const grid = (c: any) => { c.layout = "grid"; };
// Sections widths at a 378px column: small (3 columns) is 88px wide, large (6 columns) 185px. At 480 (NSPanel): 114 and 236.
const tSmall = [
  tile({ entity: "sensor.home_power", name: "House", icon_colour: "purple" }),
  tile({ entity: "sensor.solar_power", name: "Solar", icon_svg: SUN, secondary_entity: "sensor.solar_today", secondary_name: "Today" }),
  tile({ entity: "climate.hallway", attribute: "current_temperature", name: "Hallway", decimals: 1, icon_colour: "orange", secondary_text: "Heating" }),
  tile({ entity: "sensor.grid_cost", name: "Today", theme: "dusk", secondary_text: "on electricity" }),
];
const tLarge = tile({ entity: "sensor.home_power", name: "House", size: "large", icon_colour: "purple", graph: true, graph_colour: "purple", secondary_entity: "sensor.grid_power", secondary_name: "Grid" });
const tRule = tile({ entity: "sensor.home_power", name: "House", size: "large", graph: true, colour_rules: [{ above: 1500, colour: "red" }, { above: 1000, colour: "orange" }], secondary_text: "Red above 1.5 kW" });

const today = { type: "custom:halo-today-card", name: "Sam", greeting: "cheeky",
  calendars: [{ entity: "calendar.family", colour: "#e0568a" }, { entity: "calendar.work", colour: "#2f7bff" }, { entity: "calendar.school", colour: "#1f9d63" }],
  weather: "weather.home", bins: [{ name: "Recycling", colour: "blue", entity: "sensor.recycling_next" }, { name: "Waste", colour: "black", entity: "sensor.waste_next" }],
  vehicles: [{ name: "M140i", kind: "ice", image_preset: "m140i", level: "sensor.fuel", tank_size: 52, range: "sensor.petrol_range" }, { name: "e-Vivaro", kind: "ev", image_preset: "e-vivaro", level: "sensor.van_soc", range: "sensor.van_range", charging: "binary_sensor.van_charging" }],
  rates_today: "event.agile_today", rates_tomorrow: "event.agile_tomorrow", media: ["media_player.lounge", "media_player.study"] };
const vanLow = { "sensor.van_soc": e("sensor.van_soc", "22", { unit_of_measurement: "%" })[1], "binary_sensor.van_charging": e("binary_sensor.van_charging", "off")[1] };
const quiet = { "media_player.lounge": e("media_player.lounge", "paused", { friendly_name: "Living room" })[1] };

const th = (entity: string, extra = {}) => ({ type: "custom:halo-thermostat-card", entity, ...extra });

const graph = <T extends object>(cfg: T) => ({ type: "custom:halo-graph-card", ...cfg });
const SOLAR = graph({ ...solarPreset(), series: [{ name: "Forecast", source: "energy_forecast", style: "area", colour: "yellow" }, { name: "Actual", entity: "sensor.pv_total", style: "line" }],
  figures: [{ label: "Generated", series: "Actual", calc: "total", window: "today", compare: "Forecast" }, ...solarPreset().figures!] });
const AGILE = graph({ ...agilePreset(), series: [{ ...agilePreset().series[0], entities: ["event.agile_today", "event.agile_tomorrow"] }] });
const MIXED = graph({ name: "Rates and sun", series: [{ ...AGILE.series[0] }, { name: "Forecast", source: "energy_forecast", style: "area", colour: "yellow" }],
  figures: [{ label: "Rate now", series: "Rate", calc: "now" }, { label: "Cheapest", series: "Rate", calc: "lowest", window: "next", hours: 24 }, { label: "Sun left", series: "Forecast", calc: "remaining", window: "today" }, { label: "Tomorrow", series: "Forecast", calc: "total", window: "tomorrow" }] });
const HOUSE = graph({ name: "House and grid", period: "last", hours: 12, series: [{ name: "House", entity: "sensor.home_power", colour: "purple" }, { name: "Grid", entity: "sensor.grid_power", style: "area", colour: "blue" }],
  figures: [{ label: "House now", series: "House", calc: "now" }, { label: "Used", series: "House", calc: "total", window: "today" }, { label: "Peak", series: "House", calc: "highest", window: "today" }] });
const USAGE = graph({ name: "Hourly use", period: "last", hours: 24, series: [{ name: "House", entity: "sensor.home_power", style: "bars", slot_minutes: 60, colour: "purple", colour_rules: [{ above: 1.5, colour: "red" }] }], figures: [{ label: "Today", calc: "total", window: "today" }] });
function graphSpecs(): Spec[] {
  return [
    { id: "g-sol", title: "Graph: Solar preset 12x6", tag: "halo-graph-card", cfg: SOLAR, w: 378, h: 376 },
    { id: "g-sol-hov", title: "Graph: Solar, reading at 11:30", tag: "halo-graph-card", cfg: SOLAR, w: 378, h: 376, setup: (c) => { c._hov = Date.parse(at(0, 11, 30)); } },
    { id: "g-sol-tom", title: "Graph: Solar tomorrow", tag: "halo-graph-card", cfg: SOLAR, w: 378, h: 376, setup: (c) => { c._day = "tomorrow"; } },
    { id: "g-sol-night", title: "Graph: Solar night", tag: "halo-graph-card", cfg: SOLAR, w: 378, h: 376, dark: true },
    { id: "g-sol-c", title: "Graph: Solar compact 12x2", tag: "halo-graph-card", cfg: SOLAR, w: 378, h: 120 },
    { id: "g-ag", title: "Graph: Agile preset 12x6", tag: "halo-graph-card", cfg: AGILE, w: 378, h: 376 },
    { id: "g-ag-hov", title: "Graph: Agile, reading", tag: "halo-graph-card", cfg: AGILE, w: 378, h: 376, setup: (c) => { c._hov = Date.parse(at(0, 17, 40)); } },
    { id: "g-ag-night", title: "Graph: Agile night", tag: "halo-graph-card", cfg: AGILE, w: 378, h: 376, dark: true },
    { id: "g-ag-c", title: "Graph: Agile compact 12x2", tag: "halo-graph-card", cfg: AGILE, w: 378, h: 120 },
    { id: "g-ag-nsp", title: "Graph: Agile NSP 480x376", tag: "halo-graph-card", cfg: AGILE, w: 480, h: 376 },
    { id: "g-mixed", title: "Graph: rates and sun, two axes", tag: "halo-graph-card", cfg: MIXED, w: 378, h: 376, setup: (c) => { c._hov = Date.parse(at(0, 12, 10)); } },
    { id: "g-house", title: "Graph: last 12 h, two lines", tag: "halo-graph-card", cfg: HOUSE, w: 378, h: 376 },
    { id: "g-usage", title: "Graph: history as hourly bars", tag: "halo-graph-card", cfg: USAGE, w: 378, h: 376 },
    { id: "g-week", title: "Graph: last week (statistics)", tag: "halo-graph-card", cfg: { ...HOUSE, name: "House, week", hours: 168, series: [HOUSE.series[0]] }, w: 378, h: 376 },
    { id: "g-empty", title: "Graph: no series", tag: "halo-graph-card", cfg: graph({ series: [] }), w: 378, h: 376 },
  ];
}

type Spec = { setup?: (c: any) => void; id: string; title: string; tag: string; cfg: object; w: number; h: number; dark?: boolean; over?: Record<string, unknown> };
const specs: Spec[] = [
  { id: "today", title: "Today, column", tag: "halo-today-card", cfg: today, w: 378, h: 0, over: vanLow },
  { id: "today-quiet", title: "Today, nothing playing, van charging", tag: "halo-today-card", cfg: today, w: 378, h: 0, over: quiet },
  { id: "today-night", title: "Today night", tag: "halo-today-card", cfg: today, w: 378, h: 0, dark: true, over: vanLow },
  { id: "today-wide", title: "Today wall panel", tag: "halo-today-card", cfg: today, w: 860, h: 0, over: vanLow },
  { id: "today-date", title: "Today, big date, rude", tag: "halo-today-card", cfg: { ...today, header: "date", greeting: "rude" }, w: 378, h: 0, over: quiet },
  { id: "title-greet", title: "Title greeting", tag: "halo-title-card", cfg: { type: "custom:halo-title-card", name: "Sam", weather: "weather.home" }, w: 378, h: 0 },
  { id: "title-date", title: "Title big date", tag: "halo-title-card", cfg: { type: "custom:halo-title-card", style: "date", name: "Sam", weather: "weather.rain" }, w: 378, h: 0, dark: true },
  { id: "title-head", title: "Title heading", tag: "halo-title-card", cfg: { type: "custom:halo-title-card", style: "heading", title: "Downstairs", subtitle: "3 lights on · heating to 21°", chips: ["lock.m140i", { entity: "sensor.soc", name: "Battery" }] }, w: 378, h: 0 },
  { id: "energy", title: "Energy 12x12", tag: "halo-energy-card", cfg: energy, w: 378, h: 760 },
  { id: "e8", title: "Energy 12x8", tag: "halo-energy-card", cfg: energy, w: 378, h: 464 },
  { id: "e7", title: "Energy 12x7", tag: "halo-energy-card", cfg: energy, w: 378, h: 408 },
  { id: "e6", title: "Energy 12x6", tag: "halo-energy-card", cfg: energy, w: 378, h: 352 },
  { id: "m6", title: "Media 12x6", tag: "halo-media-card", cfg: media, w: 378, h: 352 },
  { id: "m7", title: "Media 12x7", tag: "halo-media-card", cfg: media, w: 378, h: 408 },
  { id: "m9", title: "Media 12x9", tag: "halo-media-card", cfg: media, w: 378, h: 520 },
  { id: "media", title: "Media full", tag: "halo-media-card", cfg: media, w: 378, h: 760 },
  { id: "media-night", title: "Media full night", tag: "halo-media-card", cfg: media, w: 378, h: 760, dark: true },
  { id: "media-compact", title: "Media 12x4", tag: "halo-media-card", cfg: media, w: 378, h: 248 },
  { id: "media-mini", title: "Media 12x2 idle", tag: "halo-media-card", cfg: { ...media, entity: "media_player.study" }, w: 378, h: 120 },
  { id: "media-mini-play", title: "Media 12x2 playing", tag: "halo-media-card", cfg: media, w: 378, h: 120 },
  { id: "media-mini-play480", title: "Media 12x2 playing 480", tag: "halo-media-card", cfg: media, w: 480, h: 120 },
  { id: "media-c3", title: "Media 12x3", tag: "halo-media-card", cfg: media, w: 378, h: 176 },
  { id: "mf7", title: "Media 12x7 favourites", tag: "halo-media-card", cfg: media, w: 378, h: 408, setup: (c) => { c._favs = true; } },
  { id: "mf9", title: "Media 12x9 favourites", tag: "halo-media-card", cfg: media, w: 378, h: 520, setup: (c) => { c._favs = true; } },
  { id: "mffull", title: "Media full favourites", tag: "halo-media-card", cfg: media, w: 378, h: 760, setup: (c) => { c._favs = true; } },
  { id: "mf-nsp", title: "Media NSP 480x376 favourites", tag: "halo-media-card", cfg: media, w: 480, h: 376, setup: (c) => { c._favs = true; } },
  { id: "mf-night", title: "Media 12x9 favourites night", tag: "halo-media-card", cfg: media, w: 378, h: 520, dark: true, setup: (c) => { c._favs = true; } },
  { id: "media-idle", title: "Media idle full", tag: "halo-media-card", cfg: { ...media, entity: "media_player.study", players: [] }, w: 378, h: 520 },
  { id: "size", title: "Size test 12x6", tag: "halo-size-card", cfg: { type: "custom:halo-size-card" }, w: 378, h: 352 },
  { id: "nsp-m", title: "Media NSP 480x386", tag: "halo-media-card", cfg: media, w: 480, h: 386 },
  { id: "nsp-mfull", title: "Media NSP tall 480x560", tag: "halo-media-card", cfg: media, w: 480, h: 560 },
  { id: "nsp-m376", title: "Media NSP 480x376", tag: "halo-media-card", cfg: media, w: 480, h: 376 },
  { id: "scenes", title: "Scenes 12x2", tag: "halo-scenes-card", cfg: scenes, w: 378, h: 120 },
  { id: "scenes-nsp", title: "Scenes 12x2 NSP", tag: "halo-scenes-card", cfg: scenes, w: 480, h: 120 },
  { id: "scenes-plain", title: "Scenes no colours", tag: "halo-scenes-card", cfg: { ...scenes, scenes: ["scene.movie", "scene.relax", "scene.bright", "scene.night"] }, w: 378, h: 120 },
  { id: "scenes-night", title: "Scenes night", tag: "halo-scenes-card", cfg: scenes, w: 378, h: 120, dark: true },
  { id: "scenes-titled", title: "Scenes titled 12x3", tag: "halo-scenes-card", cfg: { ...scenes, name: "Scenes" }, w: 378, h: 176 },
  ...tSmall.map((cfg, i) => ({ id: `ent-s${i}`, title: "Entity small 3x2", tag: "halo-entity-card", cfg, w: 88, h: 120, setup: grid })),
  ...tSmall.map((cfg, i) => ({ id: `ent-sn${i}`, title: "Entity small night", tag: "halo-entity-card", cfg, w: 88, h: 120, dark: true, setup: grid })),
  { id: "ent-l", title: "Entity large 6x3", tag: "halo-entity-card", cfg: tLarge, w: 185, h: 184, setup: grid },
  { id: "ent-l-night", title: "Entity large night", tag: "halo-entity-card", cfg: tLarge, w: 185, h: 184, dark: true, setup: grid },
  { id: "ent-l-soc", title: "Entity large, % (0 to 100), black on white", tag: "halo-entity-card", cfg: tile({ entity: "sensor.soc", name: "Battery", theme: "light", size: "large", graph: true, graph_colour: "green", icon_colour: "green", secondary_text: "Discharging" }), w: 185, h: 184, setup: grid },
  { id: "ent-l-dark", title: "Entity large, white on black", tag: "halo-entity-card", cfg: tile({ entity: "sensor.grid_power", name: "Grid", theme: "dark", size: "large", graph: true, graph_colour: "blue", graph_scale: "range" }), w: 185, h: 184, setup: grid },
  { id: "ent-l-grad", title: "Entity large, Solar gradient", tag: "halo-entity-card", cfg: tile({ entity: "sensor.solar_power", name: "Solar", theme: "solar", icon_svg: SUN, size: "large", graph: true, secondary_entity: "sensor.solar_today", secondary_name: "Today" }), w: 185, h: 184, setup: grid },
  { id: "ent-l-grad-night", title: "Entity large, Ocean night", tag: "halo-entity-card", cfg: tile({ entity: "sensor.home_power", name: "House", theme: "ocean", size: "large", graph: true }), w: 185, h: 184, dark: true, setup: grid },
  { id: "ent-l-rule", title: "Entity large, colour rule (red above 1.5 kW)", tag: "halo-entity-card", cfg: tRule, w: 185, h: 184, setup: grid },
  { id: "ent-l-week", title: "Entity large, one week (statistics)", tag: "halo-entity-card", cfg: { ...tLarge, graph_hours: 168 }, w: 185, h: 184, setup: grid },
  { id: "ent-l-nog", title: "Entity large, no graph", tag: "halo-entity-card", cfg: { ...tLarge, graph: false }, w: 185, h: 184, setup: grid },
  { id: "ent-l-nsp", title: "Entity large NSP 236x184", tag: "halo-entity-card", cfg: tLarge, w: 236, h: 184, setup: grid },
  { id: "ent-s-nsp", title: "Entity small NSP 114x120", tag: "halo-entity-card", cfg: tSmall[0], w: 114, h: 120, setup: grid },
  { id: "ent-masonry", title: "Entity large, masonry (no height given)", tag: "halo-entity-card", cfg: tLarge, w: 378, h: 0 },
  { id: "th-heat", title: "Thermostat heating 12x7", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 440 },
  { id: "th-376", title: "Thermostat 12x6", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 376 },
  { id: "th-cool", title: "Cooling", tag: "halo-thermostat-card", cfg: th("climate.cooling"), w: 378, h: 440 },
  { id: "th-idle", title: "Idle", tag: "halo-thermostat-card", cfg: th("climate.idle"), w: 378, h: 440 },
  { id: "th-off", title: "Off", tag: "halo-thermostat-card", cfg: th("climate.off"), w: 378, h: 440 },
  { id: "th-range", title: "Heat/Cool range", tag: "halo-thermostat-card", cfg: th("climate.range"), w: 378, h: 440 },
  { id: "th-night", title: "Night heating", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 440, dark: true },
  { id: "th-heat-modes", title: "Only Heat and Off ticked", tag: "halo-thermostat-card", cfg: th("climate.hallway", { hvac_modes: ["heat", "off"] }), w: 378, h: 440 },
  { id: "th-nsp", title: "Dial at 480x376", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 480, h: 376 },
  { id: "th-c-off", title: "Compact off", tag: "halo-thermostat-card", cfg: th("climate.off"), w: 378, h: 120 },
  { id: "th-c", title: "Compact 12x2", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 120 },
  { id: "th-c-idle", title: "Compact idle at target", tag: "halo-thermostat-card", cfg: th("climate.idle"), w: 378, h: 120 },
  { id: "th-c480", title: "Compact 480", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 480, h: 120 },
  { id: "th-c-cool", title: "Compact cooling", tag: "halo-thermostat-card", cfg: th("climate.cooling"), w: 378, h: 120 },
  { id: "th-c-night", title: "Compact night", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 120, dark: true },
  { id: "wx", title: "Weather today 12x7", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 378, h: 440 },
  { id: "wx-wk", title: "Current + weekly 12x9", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["current", "weekly"] }, w: 378, h: 568 },
  { id: "wx-all", title: "All three 12x11", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["current", "hourly", "weekly"] }, w: 378, h: 696 },
  { id: "wx-all-night", title: "All three night", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.night", sections: ["current", "hourly", "weekly"] }, w: 378, h: 696, dark: true, over: { "sun.sun": e("sun.sun", "below_horizon")[1] } },
  { id: "wx-hw", title: "Hourly + weekly 12x8", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["hourly", "weekly"] }, w: 378, h: 504 },
  { id: "wx-h", title: "Hourly only 12x3", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["hourly"] }, w: 378, h: 184 },
  { id: "wx-w", title: "Weekly only 12x6", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["weekly"] }, w: 378, h: 376 },
  { id: "wx-cur", title: "Current only 12x5", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["current"] }, w: 378, h: 312 },
  { id: "wx-night", title: "Weather night", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.night" }, w: 378, h: 440, dark: true, over: { "sun.sun": e("sun.sun", "below_horizon")[1] } },
  { id: "wx-rain", title: "Weather rain", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.rain" }, w: 378, h: 440 },
  { id: "wx-c", title: "Weather compact 12x2", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 378, h: 120 },
  { id: "wx-c480", title: "Weather compact 480", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 480, h: 120 },
  { id: "wx-c-night", title: "Weather compact night", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.night" }, w: 378, h: 120, dark: true, over: { "sun.sun": e("sun.sun", "below_horizon")[1] } },
  { id: "wx-c-rain", title: "Weather compact rain", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.rain" }, w: 378, h: 120 },
  { id: "wx-nsp", title: "Weather today NSP 480x376", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 480, h: 376 },
  { id: "wx-nsp-wk", title: "Current + weekly NSP 480x376 (trimmed)", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", sections: ["current", "weekly"] }, w: 480, h: 376 },
  { id: "wx-nofc", title: "No forecast", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.nofc" }, w: 378, h: 440 },
  ...graphSpecs(),
  { id: "light", title: "Lights day", tag: "halo-light-card", cfg: lights, w: 378, h: 330 },
  { id: "light-3", title: "Lights 3", tag: "halo-light-card", cfg: { ...lights, name: "Kitchen", lights: lights.lights.slice(0, 3) }, w: 378, h: 200 },
  { id: "light-off", title: "Lights off", tag: "halo-light-card", cfg: lights, w: 378, h: 330, over: Object.fromEntries(["pendant","downlight","shelf","tower","lamp"].map((n) => [`light.${n}`, e(`light.${n}`, "off", { friendly_name: n, supported_color_modes: ["rgb"] })[1]])) },
  { id: "nsp-l4", title: "Lights NSP 4 lights 480x376", tag: "halo-light-card", cfg: { ...lights, lights: [lights.lights[0], lights.lights[1], lights.lights[2], lights.lights[3]] }, w: 480, h: 376 },
  { id: "nsp-l6", title: "Lights NSP 6 lights 480x376", tag: "halo-light-card", cfg: lights, w: 480, h: 376 },
  { id: "light-night", title: "Lights night", tag: "halo-light-card", cfg: lights, w: 378, h: 330, dark: true },
  { id: "veh-m140i", title: "M140i 12x4", tag: "halo-vehicle-card", cfg: m140i, w: 378, h: 248 },
  { id: "veh-van", title: "e-Vivaro 12x4", tag: "halo-vehicle-card", cfg: van, w: 378, h: 248 },
  { id: "veh-m140i-night", title: "M140i 12x4 night", tag: "halo-vehicle-card", cfg: m140i, w: 378, h: 248, dark: true },
  { id: "veh-m140i-3", title: "M140i 12x3", tag: "halo-vehicle-card", cfg: m140i, w: 378, h: 192 },
  { id: "veh-van-3", title: "e-Vivaro 12x3", tag: "halo-vehicle-card", cfg: van, w: 378, h: 192 },
  { id: "veh-low", title: "e-Vivaro low, not charging", tag: "halo-vehicle-card", cfg: van, w: 378, h: 248, over: { "sensor.van_soc": e("sensor.van_soc", "14", { unit_of_measurement: "%" })[1], "binary_sensor.van_charging": e("binary_sensor.van_charging", "off")[1] } },
];

// ---- Screenshot scenes ----------------------------------------------------
// ?scene=name renders one card, or a section of tiles on the real 12-column grid (56px rows, 8px gaps), on a transparent page.
type Placed = { tag: string; cfg: object; col?: number; row?: number; c?: number; r: number };
type Scene = { w: number; tiles: Placed[]; dark?: boolean; over?: Record<string, unknown> };

/** Blue, underwater-looking artwork so the media card blooms blue. */
function blueArt() {
  const c = document.createElement("canvas"); c.width = c.height = 240;
  const g = c.getContext("2d")!;
  const sea = g.createLinearGradient(0, 0, 0, 240); sea.addColorStop(0, "#1d7fc4"); sea.addColorStop(.55, "#0b4f93"); sea.addColorStop(1, "#04234f");
  g.fillStyle = sea; g.fillRect(0, 0, 240, 240);
  const glow = g.createRadialGradient(120, -20, 10, 120, -20, 200); glow.addColorStop(0, "rgba(160,225,255,.75)"); glow.addColorStop(1, "rgba(160,225,255,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 240, 240);
  g.strokeStyle = "rgba(190,235,255,.18)"; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-20, 30 + i * 9); g.bezierCurveTo(60, 20 + i * 11, 160, 45 + i * 8, 260, 25 + i * 10); g.stroke(); }
  return c.toDataURL();
}
const nirvana = () => ({ "media_player.lounge": e("media_player.lounge", "playing", { friendly_name: "Living room", supported_features: FEATS, media_title: "Come As You Are", media_artist: "Nirvana",
  media_album_name: "Nevermind", media_duration: 219, media_position: 74, media_position_updated_at: now, volume_level: 0.42, entity_picture: blueArt(), group_members: ["media_player.lounge", "media_player.kitchen"] })[1] });
const balanced = { "sensor.solar_power": e("sensor.solar_power", "1250", { unit_of_measurement: "W" })[1], "sensor.battery_power": e("sensor.battery_power", "1180", { unit_of_measurement: "W" })[1],
  "sensor.grid_power": e("sensor.grid_power", "4", { unit_of_measurement: "W" })[1], "sensor.home_power": e("sensor.home_power", "2430", { unit_of_measurement: "W", device_class: "power", state_class: "measurement" })[1],
  "sensor.soc": e("sensor.soc", "64", { unit_of_measurement: "%" })[1], "sensor.solar_today": e("sensor.solar_today", "6.8", { unit_of_measurement: "kWh" })[1] };

const one = (tag: string, cfg: object, r: number, extra: Partial<Scene> = {}): Scene => ({ w: 378, tiles: [{ tag, cfg, r }], ...extra });
const T = (cfg: object) => tile(cfg);
const mixTiles: Placed[] = [
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.home_power", name: "House", size: "large", icon_colour: "purple", graph: true, graph_colour: "purple", secondary_entity: "sensor.grid_power", secondary_name: "Grid" }), col: 1, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.solar_power", name: "Solar", theme: "solar", icon_svg: SUN, size: "large", graph: true, secondary_entity: "sensor.solar_today", secondary_name: "Today" }), col: 7, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "climate.hallway", attribute: "current_temperature", name: "Hall", decimals: 1, icon: "mdi:thermometer", icon_colour: "orange", secondary_text: "Heating" }), col: 1, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "climate.hallway", attribute: "current_humidity", name: "Humidity", icon: "mdi:water-percent", icon_colour: "blue" }), col: 4, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.soc", name: "Battery", theme: "light", icon: "mdi:battery", icon_colour: "green", secondary_text: "Charging" }), col: 7, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.grid_cost", name: "Today", theme: "dusk", secondary_text: "on power" }), col: 10, row: 4, c: 3, r: 2 },
];
const themeTiles: Placed[] = [
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.soc", name: "Battery", theme: "light", size: "large", icon: "mdi:battery", icon_colour: "green", graph: true, graph_colour: "green", secondary_text: "Discharging" }), col: 1, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.grid_power", name: "Grid", theme: "dark", size: "large", icon: "mdi:flash", icon_colour: "blue", graph: true, graph_colour: "blue", secondary_entity: "sensor.grid_cost", secondary_name: "Today" }), col: 7, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.home_power", name: "House", theme: "ocean", icon: "mdi:flash" }), col: 1, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.solar_power", name: "Solar", theme: "sunset", icon_svg: SUN }), col: 4, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "climate.hallway", attribute: "current_temperature", name: "Hall", decimals: 1, theme: "aurora", icon: "mdi:thermometer" }), col: 7, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.grid_cost", name: "Spent", theme: "graphite", show_icon: false, secondary_text: "today" }), col: 10, row: 4, c: 3, r: 2 },
];
const graphTiles: Placed[] = [
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.home_power", name: "House", size: "large", graph: true, colour_rules: [{ above: 1500, colour: "red" }, { above: 1000, colour: "orange" }], secondary_text: "Red above 1.5 kW" }), col: 1, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "climate.hallway", attribute: "current_temperature", name: "Hallway", decimals: 1, size: "large", icon: "mdi:thermometer", icon_colour: "orange", secondary_entity: "climate.hallway", secondary_attribute: "current_humidity", secondary_name: "Humidity" }), col: 7, row: 1, c: 6, r: 3 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.solar_power", name: "Solar", icon_svg: SUN, icon_colour: "yellow", secondary_entity: "sensor.solar_today", secondary_name: "Today" }), col: 1, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.soc", name: "Battery", icon: "mdi:battery", icon_colour: "green" }), col: 4, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.grid_power", name: "Grid", theme: "grid", icon: "mdi:flash", secondary_text: "Importing" }), col: 7, row: 4, c: 3, r: 2 },
  { tag: "halo-entity-card", cfg: T({ entity: "sensor.grid_cost", name: "Today", theme: "ember", show_icon: false, secondary_text: "on power" }), col: 10, row: 4, c: 3, r: 2 },
];
const SCENES: Record<string, Scene> = {
  "vehicle-m140i": one("halo-vehicle-card", m140i, 4),
  "media-nirvana": one("halo-media-card", media, 9, { over: nirvana() }),
  "media-nirvana-compact": one("halo-media-card", media, 2, { over: nirvana() }),
  "energy-balanced": one("halo-energy-card", energy, 10, { over: balanced }),
  "entities-mix": { w: 440, tiles: mixTiles },
  "entities-themes": { w: 440, tiles: themeTiles },
  "entities-graphs": { w: 440, tiles: graphTiles },
  "graph-solar": one("halo-graph-card", SOLAR, 6),
  "graph-agile-compact": one("halo-graph-card", AGILE, 2),
  "thermostat-large": one("halo-thermostat-card", th("climate.hallway"), 7),
  "thermostat-compact": one("halo-thermostat-card", th("climate.hallway"), 2),
};

const sceneName = q.get("scene");
if (sceneName && SCENES[sceneName]) {
  const sc = SCENES[sceneName], dark = q.has("dark") || !!sc.dark;
  document.body.style.cssText = "margin:0;padding:32px;background:transparent;display:block";
  const grid = document.createElement("div");
  grid.className = dark ? "dk" : "";
  grid.style.cssText = `width:${sc.w}px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:56px;gap:8px;grid-auto-flow:row dense`;
  for (const t of sc.tiles) {
    const box = document.createElement("div");
    box.style.cssText = `grid-column:${t.col ? `${t.col} / ` : ""}span ${t.c ?? 12};grid-row:${t.row ? `${t.row} / ` : ""}span ${t.r};min-width:0`;
    const card = document.createElement(t.tag) as any;
    card.layout = "grid";
    card.setConfig(t.cfg); card.hass = makeHass(dark, sc.over);
    box.append(card); grid.append(box);
  }
  document.body.append(grid);
} else for (const s of specs) {
  if (only && !only.split(",").includes(s.id)) continue;
  const cell = document.createElement("div"); cell.className = "cell" + (s.dark ? " dk" : "");
  cell.innerHTML = `<div class="cap">${s.title}</div>`;
  const box = document.createElement("div"); box.style.cssText = `width:${s.w}px;${s.h ? `height:${s.h}px` : ""}`;
  const card = document.createElement(s.tag) as any;
  card.setConfig(s.cfg); card.hass = makeHass(!!s.dark, s.over); s.setup?.(card);
  box.append(card); cell.append(box); document.body.append(cell);
}
