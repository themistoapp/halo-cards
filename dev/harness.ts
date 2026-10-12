import "../src/index";
import { MDI } from "./mdi-sample";
import type { HomeAssistant } from "../src/shared/types";

// Browser-only mock of Home Assistant: static states, a synthetic history, and a gallery of every card and size.
if (!customElements.get("ha-icon")) customElements.define("ha-icon", class extends HTMLElement {
  private _i = "";
  set icon(v: string) { this._i = v; this._draw(); }
  get icon() { return this._i; }
  connectedCallback() { this.style.cssText = "display:inline-flex;width:20px;height:20px"; this._draw(); }
  private _draw() { const d = MDI[this._i] ?? MDI["mdi:palette"]; (this.shadowRoot ?? this.attachShadow({ mode: "open" })).innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${d}"/></svg>`; }
});
if (!customElements.get("ha-card")) customElements.define("ha-card", class extends HTMLElement {});
const q = new URLSearchParams(location.search);
const only = q.get("only");
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
      e("sensor.grid_cost", "1.59", { unit_of_measurement: "£" }), e("sensor.home_power", "1800", { unit_of_measurement: "W" }),
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
    ]),
    ...over,
  };
}

const shape: Record<string, (x: number) => number> = {
  "sensor.solar_power": (x) => Math.max(0, Math.sin(x * Math.PI)) * 1100, "sensor.soc": (x) => 30 + x * 32,
  "sensor.battery_power": (x) => 200 + Math.sin(x * 9) * 150, "sensor.grid_power": (x) => 900 - x * 300 + Math.sin(x * 12) * 120,
  "sensor.home_power": (x) => 1400 + Math.sin(x * 7) * 500,
};


const CONDS = ["partlycloudy", "partlycloudy", "sunny", "cloudy", "rainy", "rainy", "pouring", "cloudy", "sunny", "sunny"];
function forecast(kind: string, night = false) {
  const t = new Date(); t.setMinutes(0, 0, 0);
  if (kind === "hourly") return Array.from({ length: 24 }, (_, i) => { const d = new Date(t.getTime() + i * 3600e3); return { datetime: d.toISOString(), condition: night && CONDS[i % CONDS.length] === "sunny" ? "clear-night" : CONDS[i % CONDS.length], temperature: 14 + Math.round(Math.sin(i / 3) * 3), is_daytime: !night }; });
  const d0 = new Date(); d0.setHours(12, 0, 0, 0);
  const days: [string, number, number][] = [["partlycloudy", 16, 9], ["rainy", 13, 8], ["pouring", 12, 7], ["sunny", 14, 6], ["cloudy", 15, 8], ["rainy", 13, 9], ["sunny", 17, 7]];
  return days.map(([condition, temperature, templow], i) => ({ datetime: new Date(d0.getTime() + i * 86400e3).toISOString(), condition, temperature, templow }));
}

function makeHass(dark: boolean, over = {}): HomeAssistant {
  const st = states(over) as Record<string, any>;
  return {
    states: st, themes: { darkMode: dark },
    entities: { "media_player.lounge": { device_id: "d1" }, "media_player.study": { device_id: "d2" } },
    devices: { d1: { model: "Era 300" }, d2: { model: "Sonos One" } },
    connection: {
      async subscribeMessage(cb: (m: unknown) => void, msg: { entity_ids: string[]; start_time: string; type?: string; forecast_type?: string }) {
        if (msg.type === "weather/subscribe_forecast") { setTimeout(() => cb({ type: msg.forecast_type, forecast: forecast(msg.forecast_type!, (msg as any).entity_id === "weather.night") }), 30); return () => {}; }
        const t0 = Date.parse(msg.start_time), t1 = Date.now(); const out: Record<string, { s: string; lu: number }[]> = {};
        for (const id of msg.entity_ids) out[id] = Array.from({ length: 120 }, (_, i) => ({ s: String((shape[id]?.(i / 119)) ?? 0), lu: (t0 + (i / 119) * (t1 - t0)) / 1000 }));
        setTimeout(() => cb({ states: out }), 50); return () => {};
      },
    },
    async callService(d: string, s: string, data: Record<string, unknown>) { console.log("service", d, s, data); },
    async callWS() { return { children: [] }; },
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

const th = (entity: string, extra = {}) => ({ type: "custom:halo-thermostat-card", entity, ...extra });

type Spec = { id: string; title: string; tag: string; cfg: object; w: number; h: number; dark?: boolean; over?: Record<string, unknown> };
const specs: Spec[] = [
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
  { id: "th-heat", title: "Thermostat heating 12x7", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 440 },
  { id: "th-cool", title: "Cooling", tag: "halo-thermostat-card", cfg: th("climate.cooling"), w: 378, h: 440 },
  { id: "th-idle", title: "Idle", tag: "halo-thermostat-card", cfg: th("climate.idle"), w: 378, h: 440 },
  { id: "th-off", title: "Off", tag: "halo-thermostat-card", cfg: th("climate.off"), w: 378, h: 440 },
  { id: "th-range", title: "Heat/Cool range", tag: "halo-thermostat-card", cfg: th("climate.range"), w: 378, h: 440 },
  { id: "th-night", title: "Night heating", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 440, dark: true },
  { id: "th-heat-modes", title: "Only Heat and Off ticked", tag: "halo-thermostat-card", cfg: th("climate.hallway", { hvac_modes: ["heat", "off"] }), w: 378, h: 440 },
  { id: "th-nsp", title: "Dial at 480x376", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 480, h: 376 },
  { id: "th-c", title: "Compact 12x2", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 120 },
  { id: "th-c480", title: "Compact 480", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 480, h: 120 },
  { id: "th-c-cool", title: "Compact cooling", tag: "halo-thermostat-card", cfg: th("climate.cooling"), w: 378, h: 120 },
  { id: "th-c-night", title: "Compact night", tag: "halo-thermostat-card", cfg: th("climate.hallway"), w: 378, h: 120, dark: true },
  { id: "wx", title: "Weather today 12x7", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 378, h: 440 },
  { id: "wx-wk", title: "Weather week 12x7", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", layout: "week" }, w: 378, h: 440 },
  { id: "wx-night", title: "Weather night", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.night" }, w: 378, h: 440, dark: true, over: { "sun.sun": e("sun.sun", "below_horizon")[1] } },
  { id: "wx-rain", title: "Weather rain", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.rain" }, w: 378, h: 440 },
  { id: "wx-c", title: "Weather compact 12x2", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 378, h: 120 },
  { id: "wx-c480", title: "Weather compact 480", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 480, h: 120 },
  { id: "wx-c-night", title: "Weather compact night", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.night" }, w: 378, h: 120, dark: true, over: { "sun.sun": e("sun.sun", "below_horizon")[1] } },
  { id: "wx-c-rain", title: "Weather compact rain", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.rain" }, w: 378, h: 120 },
  { id: "wx-nsp", title: "Weather today NSP 480x376", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home" }, w: 480, h: 376 },
  { id: "wx-nsp-wk", title: "Weather week NSP 480x376", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.home", layout: "week" }, w: 480, h: 376 },
  { id: "wx-nofc", title: "No forecast", tag: "halo-weather-card", cfg: { type: "custom:halo-weather-card", entity: "weather.nofc" }, w: 378, h: 440 },
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

for (const s of specs) {
  if (only && !only.split(",").includes(s.id)) continue;
  const cell = document.createElement("div"); cell.className = "cell" + (s.dark ? " dk" : "");
  cell.innerHTML = `<div class="cap">${s.title}</div>`;
  const box = document.createElement("div"); box.style.cssText = `width:${s.w}px;height:${s.h}px`;
  const card = document.createElement(s.tag) as any;
  card.setConfig(s.cfg); card.hass = makeHass(!!s.dark, s.over);
  box.append(card); cell.append(box); document.body.append(cell);
}
