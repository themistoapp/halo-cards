import { HaloEnergyCard } from "./cards/energy/halo-energy-card";
import { HaloEnergyCardEditor } from "./cards/energy/editor";
import { HaloMediaCard } from "./cards/media/halo-media-card";
import { HaloMediaCardEditor } from "./cards/media/editor";
import { HaloLightCard } from "./cards/light/halo-light-card";
import { HaloLightCardEditor } from "./cards/light/editor";
import { HaloScenesCard } from "./cards/scenes/halo-scenes-card";
import { HaloScenesCardEditor } from "./cards/scenes/editor";
import { HaloThermostatCard } from "./cards/thermostat/halo-thermostat-card";
import { HaloThermostatCardEditor } from "./cards/thermostat/editor";
import { HaloSizeCard } from "./cards/size/halo-size-card";
import { HaloVehicleCard } from "./cards/vehicle/halo-vehicle-card";
import { HaloVehicleCardEditor } from "./cards/vehicle/editor";

export const VERSION = "0.4.0";

// Each card stands alone: its own element, config and editor. Use any of them without the others.
const CARDS: [string, CustomElementConstructor, string, CustomElementConstructor, string, string][] = [
  ["halo-energy-card", HaloEnergyCard, "halo-energy-card-editor", HaloEnergyCardEditor, "Halo Energy", "EcoFlow Stream energy card: live flows, history graphs, backup reserve and operating mode."],
  ["halo-media-card", HaloMediaCard, "halo-media-card-editor", HaloMediaCardEditor, "Halo Media", "Sonos and other players: colours from the album art, transport, volume, speaker groups and favourites."],
  ["halo-vehicle-card", HaloVehicleCard, "halo-vehicle-card-editor", HaloVehicleCardEditor, "Halo Vehicle", "Compact car card: level bar, range, odometer, lock or charging, and where it is."],
  ["halo-thermostat-card", HaloThermostatCard, "halo-thermostat-card-editor", HaloThermostatCardEditor, "Halo Thermostat", "Nest-style thermostat: a dial that glows orange or blue, target and room temperature, and the modes you choose."],
  ["halo-scenes-card", HaloScenesCard, "halo-scenes-card-editor", HaloScenesCardEditor, "Halo Scenes", "A compact row of scene, script or button shortcuts."],
  ["halo-light-card", HaloLightCard, "halo-light-card-editor", HaloLightCardEditor, "Halo Lights", "Several lights as tiles: downlights, pendants and light bars that glow in the light's own colour and brightness."],
];

declare global { interface Window { customCards?: Record<string, unknown>[] } }
window.customCards ||= [];
// Test card: shows its own pixel size and the window it is on. Has no editor.
if (!customElements.get("halo-size-card")) customElements.define("halo-size-card", HaloSizeCard);
window.customCards ||= [];
if (!window.customCards.some((c) => c.type === "halo-size-card")) window.customCards.push({ type: "halo-size-card", name: "Halo Size Test", description: "Shows the card's pixel size and the screen it is on. For finding what fits a wall panel.", preview: true });

for (const [tag, cls, editorTag, editor, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!customElements.get(editorTag)) customElements.define(editorTag, editor);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description, preview: true });
}

console.info(`%c HALO-CARDS %c ${VERSION} `, "background:#111;color:#fff;border-radius:3px 0 0 3px", "background:#3ee08a;color:#111;border-radius:0 3px 3px 0");
