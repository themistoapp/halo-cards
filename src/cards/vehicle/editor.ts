import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloVehicleConfig } from "./logic";

const ent = (name: string, domain: string | string[]) => ({ name, selector: { entity: { domain } } });
const SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "shadow", selector: { boolean: {} } },
  { name: "fuel_type", selector: { select: { mode: "dropdown", options: [{ value: "ice", label: "Petrol / diesel" }, { value: "ev", label: "Electric" }] } } },
  { name: "image_preset", selector: { select: { mode: "dropdown", options: [{ value: "none", label: "None" }, { value: "m140i", label: "BMW M140i" }, { value: "e-vivaro", label: "Vauxhall e-Vivaro" }] } } },
  { name: "image", selector: { text: {} } },
  { name: "colour", selector: { text: {} } },
  ent("level", "sensor"), ent("range", "sensor"), ent("odometer", "sensor"),
  ent("lock", ["lock", "binary_sensor", "sensor"]), ent("charging", ["binary_sensor", "sensor", "switch"]),
  ent("location", ["device_tracker", "sensor"]),
  ent("address", "sensor"),
  { name: "tank_size", selector: { number: { min: 1, max: 500, mode: "box", unit_of_measurement: "L" } } },
  { name: "low_level", selector: { number: { min: 1, max: 99, mode: "box", unit_of_measurement: "%" } } },
  { name: "critical_level", selector: { number: { min: 1, max: 99, mode: "box", unit_of_measurement: "%" } } },
];
const LABELS: Record<string, string> = {
  shadow: "Drop shadow",
  name: "Title", fuel_type: "Vehicle type", image_preset: "Built-in picture", image: "Your own picture (URL)", colour: "Vehicle colour (hex, e.g. #b3262f)",
  level: "Fuel level / charge level", range: "Range", odometer: "Odometer", lock: "Lock", charging: "Charging status", location: "Location", address: "Street while away (optional address sensor)",
  tank_size: "Fuel tank size (only if the sensor reports litres)", low_level: "Low at (%)", critical_level: "Critical at (%)",
};

export class HaloVehicleCardEditor extends LitElement {
  @state() private _config?: HaloVehicleConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloVehicleConfig) { this._config = config; }
  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, ...this._config }} .schema=${SCHEMA}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
