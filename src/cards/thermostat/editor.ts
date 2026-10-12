import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { MODE_LABELS, MODE_ORDER, type HaloThermostatConfig } from "./logic";

const LABELS: Record<string, string> = {
  entity: "Thermostat", name: "Title", shadow: "Drop shadow", hvac_modes: "Modes to show", humidity: "Humidity sensor (only if the thermostat doesn't report it)",
};

export class HaloThermostatCardEditor extends LitElement {
  @state() private _config?: HaloThermostatConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloThermostatConfig) { this._config = config; }

  private _schema() {
    const supported: string[] = this.hass?.states[this._config?.entity ?? ""]?.attributes.hvac_modes ?? MODE_ORDER;
    const options = MODE_ORDER.filter((m) => supported.includes(m)).map((value) => ({ value, label: MODE_LABELS[value] ?? value }));
    return [
      { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
      { name: "name", selector: { text: {} } },
      { name: "shadow", selector: { boolean: {} } },
      { name: "hvac_modes", selector: { select: { multiple: true, mode: "list", options } } },
      { name: "humidity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
    ];
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, ...this._config }} .schema=${this._schema()}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      .computeHelper=${(s: { name: string }) => (s.name === "hvac_modes" ? "Tick the modes you want as buttons. None ticked shows every mode the thermostat supports." : "")}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
