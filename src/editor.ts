import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HaloEnergyConfig, HomeAssistant } from "./types";

const ent = (name: string, domain: string | string[]) => ({ name, selector: { entity: { domain } } });

const SCHEMA = [
  { name: "name", selector: { text: {} } },
  { type: "expandable", title: "Solar", schema: [ent("solar_power", "sensor"), ent("solar_energy", "sensor"), ent("solar_forecast", "sensor")] },
  { type: "expandable", title: "Battery", schema: [ent("battery_soc", "sensor"), ent("battery_power", "sensor"), { name: "battery_invert", selector: { boolean: {} } }] },
  { type: "expandable", title: "Grid", schema: [ent("grid_power", "sensor"), ent("grid_cost", "sensor"), { name: "grid_invert", selector: { boolean: {} } }] },
  { type: "expandable", title: "House", schema: [ent("home_power", "sensor")] },
  { type: "expandable", title: "Controls", schema: [ent("reserve_entity", "number"), ent("mode_entity", "select"), { name: "mode_self", selector: { text: {} } }, { name: "mode_ai", selector: { text: {} } }] },
  { type: "expandable", title: "Other", schema: [ent("updated_entity", ["sensor", "binary_sensor", "number", "select"]), { name: "history_start_hour", selector: { number: { min: 0, max: 23, mode: "box" } } }, { name: "idle_watts", selector: { number: { min: 0, max: 200, mode: "box", unit_of_measurement: "W" } } }] },
];

const LABELS: Record<string, string> = {
  name: "Title", solar_power: "Solar power", solar_energy: "Solar energy today", solar_forecast: "Solar forecast today",
  battery_soc: "Battery level (%)", battery_power: "Battery power", battery_invert: "Battery: positive means charging",
  grid_power: "Grid power", grid_cost: "Grid cost today", grid_invert: "Grid: positive means exporting",
  home_power: "House power", reserve_entity: "Backup reserve (number)", mode_entity: "Operating mode (select)",
  mode_self: "Self-powered option name", mode_ai: "AI option name", updated_entity: "Updated time from",
  history_start_hour: "Graphs start at (hour)", idle_watts: "Idle below",
};

export class HaloEnergyCardEditor extends LitElement {
  @state() private _config?: HaloEnergyConfig;
  hass?: HomeAssistant;

  setConfig(config: HaloEnergyConfig) { this._config = config; }

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${this._config} .schema=${SCHEMA}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
