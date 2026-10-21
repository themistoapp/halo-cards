import { HaloEnergyCard } from "./cards/energy/halo-energy-card";
import { HaloEnergyCardEditor } from "./cards/energy/editor";
import { HaloMediaCard } from "./cards/media/halo-media-card";
import { HaloMediaCardEditor } from "./cards/media/editor";
import { HaloLightCard } from "./cards/light/halo-light-card";
import { HaloLightCardEditor } from "./cards/light/editor";
import { HaloSingleLightCard } from "./cards/single-light/halo-single-light-card";
import { HaloSingleLightCardEditor } from "./cards/single-light/editor";
import { HaloScenesCard } from "./cards/scenes/halo-scenes-card";
import { HaloScenesCardEditor } from "./cards/scenes/editor";
import { HaloEntityCard } from "./cards/entity/halo-entity-card";
import { HaloEntityCardEditor } from "./cards/entity/editor";
import { HaloSvgIcon } from "./cards/entity/svg-icon";
import { HaloWeatherCard } from "./cards/weather/halo-weather-card";
import { HaloWeatherCardEditor } from "./cards/weather/editor";
import { HaloGraphCard } from "./cards/graph/halo-graph-card";
import { HaloGraphCardEditor } from "./cards/graph/editor";
import { HaloThermostatCard } from "./cards/thermostat/halo-thermostat-card";
import { HaloThermostatCardEditor } from "./cards/thermostat/editor";
import { HaloSizeCard } from "./cards/size/halo-size-card";
import { HaloVehicleCard } from "./cards/vehicle/halo-vehicle-card";
import { HaloVehicleCardEditor } from "./cards/vehicle/editor";
import { HaloTodayCard } from "./cards/today/halo-today-card";
import { HaloTodayCardEditor } from "./cards/today/editor";
import { HaloTitleCard } from "./cards/title/halo-title-card";
import { HaloTitleCardEditor } from "./cards/title/editor";
import { HaloBackdropCard } from "./cards/backdrop/halo-backdrop-card";
import { HaloBackdropCardEditor } from "./cards/backdrop/editor";
import { HaloBooleanBadge, HaloGaugeBadge, HaloThermostatBadge, HaloWeatherBadge } from "./cards/badges/halo-badges";
import { HaloBooleanBadgeEditor, HaloGaugeBadgeEditor, HaloThermostatBadgeEditor, HaloWeatherBadgeEditor } from "./cards/badges/editors";

export const VERSION = "0.31.0";

// Each card stands alone: its own element, config and editor. Use any of them without the others.
const CARDS: [string, CustomElementConstructor, string, CustomElementConstructor, string, string][] = [
  ["halo-energy-card", HaloEnergyCard, "halo-energy-card-editor", HaloEnergyCardEditor, "Halo Energy", "EcoFlow Stream energy card: live flows, history graphs, backup reserve and operating mode."],
  ["halo-media-card", HaloMediaCard, "halo-media-card-editor", HaloMediaCardEditor, "Halo Media", "Sonos and other players: colours from the album art, transport, volume, speaker groups and favourites."],
  ["halo-vehicle-card", HaloVehicleCard, "halo-vehicle-card-editor", HaloVehicleCardEditor, "Halo Vehicle", "Compact car card: level bar, range, odometer, lock or charging, and where it is."],
  ["halo-thermostat-card", HaloThermostatCard, "halo-thermostat-card-editor", HaloThermostatCardEditor, "Halo Thermostat", "Nest-style thermostat: a dial that glows orange or blue, target and room temperature, and the modes you choose."],
  ["halo-weather-card", HaloWeatherCard, "halo-weather-card-editor", HaloWeatherCardEditor, "Halo Weather", "Weather: temperature and conditions, with details and the next hours, or a row per day. Needs a weather entity such as Met.no."],
  ["halo-graph-card", HaloGraphCard, "halo-graph-card-editor", HaloGraphCardEditor, "Halo Graph", "Up to four figures over a chart of history, forecasts and rates: lines, shaded areas and coloured bars, today and tomorrow or any number of hours. Starts as Solar forecast or Agile rates."],
  ["halo-scenes-card", HaloScenesCard, "halo-scenes-card-editor", HaloScenesCardEditor, "Halo Scenes", "A compact row of scene, script or button shortcuts."],
  ["halo-entity-card", HaloEntityCard, "halo-entity-card-editor", HaloEntityCardEditor, "Halo Entity", "One reading as a small or large tile: the state or any attribute, your own icon, a line below, colours by value and an optional history graph."],
  ["halo-light-card", HaloLightCard, "halo-light-card-editor", HaloLightCardEditor, "Halo Lights", "Several lights as tiles: downlights, pendants and light bars that glow in the light's own colour and brightness."],
  ["halo-single-light-card", HaloSingleLightCard, "halo-single-light-card-editor", HaloSingleLightCardEditor, "Halo Light", "One light: on and off, brightness, warmth, colour and presets, with a lit picture of the fitting or any icon. Full, a compact bar, or a 6 × 2 mini tile."],
  ["halo-today-card", HaloTodayCard, "halo-today-card-editor", HaloTodayCardEditor, "Halo Today", "Today at a glance: your next events, the weather, bins, low vehicles, cheap Agile slots and what's playing, ordered by what matters now, under a greeting that can be polite, cheeky or rude."],
  ["halo-title-card", HaloTitleCard, "halo-title-card-editor", HaloTitleCardEditor, "Halo Title", "A greeting with the date and weather, the day as a big number, or a section heading with a subtitle and entity chips."],
  ["halo-backdrop-card", HaloBackdropCard, "halo-backdrop-card-editor", HaloBackdropCardEditor, "Halo Backdrop", "Paints the view's background with a sky that follows the sun, from first light to an aurora at night, with an optional daylight tile: time to sunset and since sunrise."],
];

// Badges for the row at the top of a view (badges:), registered the same way under window.customBadges.
const BADGES: [string, CustomElementConstructor, string, CustomElementConstructor, string, string][] = [
  ["halo-thermostat-badge", HaloThermostatBadge, "halo-thermostat-badge-editor", HaloThermostatBadgeEditor, "Halo Thermostat badge", "A mini thermostat dial with the room temperature in the middle, glowing while it heats or cools. Takes a climate entity or a temperature sensor."],
  ["halo-gauge-badge", HaloGaugeBadge, "halo-gauge-badge-editor", HaloGaugeBadgeEditor, "Halo Gauge badge", "Any number between a min and max as a small ring, with the value or the icon inside, coloured by value."],
  ["halo-weather-badge", HaloWeatherBadge, "halo-weather-badge-editor", HaloWeatherBadgeEditor, "Halo Weather badge", "The temperature now, the next sunrise or sunset, or today's chance of rain."],
  ["halo-boolean-badge", HaloBooleanBadge, "halo-boolean-badge-editor", HaloBooleanBadgeEditor, "Halo On/Off badge", "On or off: pressed in when on, with a colour or gradient for each state. Tap toggles."],
];

declare global { interface Window { customCards?: Record<string, unknown>[]; customBadges?: Record<string, unknown>[] } }
window.customCards ||= [];
// Custom SVG icons (Entity card and its editor).
if (!customElements.get("halo-svg-icon")) customElements.define("halo-svg-icon", HaloSvgIcon);
// Test card: shows its own pixel size and the window it is on. Has no editor.
if (!customElements.get("halo-size-card")) customElements.define("halo-size-card", HaloSizeCard);
window.customCards ||= [];
if (!window.customCards.some((c) => c.type === "halo-size-card")) window.customCards.push({ type: "halo-size-card", name: "Halo Size Test", description: "Shows the card's pixel size and the screen it is on. For finding what fits a wall panel.", preview: true });

for (const [tag, cls, editorTag, editor, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!customElements.get(editorTag)) customElements.define(editorTag, editor);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description, preview: true });
}

window.customBadges ||= [];
for (const [tag, cls, editorTag, editor, name, description] of BADGES) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!customElements.get(editorTag)) customElements.define(editorTag, editor);
  if (!window.customBadges.some((c) => c.type === tag)) window.customBadges.push({ type: tag, name, description, preview: true });
}

console.info(`%c HALO-CARDS %c ${VERSION} `, "background:#111;color:#fff;border-radius:3px 0 0 3px", "background:#3ee08a;color:#111;border-radius:0 3px 3px 0");
