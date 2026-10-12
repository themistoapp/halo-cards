import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloSolarConfig } from "./logic";

const LABELS: Record<string, string> = { name: "Title", shadow: "Drop shadow", actual: "Generated solar (total PV power sensor)", forecast_entry: "Forecast.Solar config entry (optional)" };

export class HaloSolarCardEditor extends LitElement {
  @state() private _config?: HaloSolarConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloSolarConfig) { this._config = config; }

  private _schema = [
    { name: "name", selector: { text: {} } },
    { name: "actual", selector: { entity: { domain: "sensor", device_class: "power" } } },
    { name: "shadow", selector: { boolean: {} } },
    { name: "forecast_entry", selector: { text: {} } },
  ];

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, ...this._config }} .schema=${this._schema}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      .computeHelper=${(s: { name: string }) => s.name === "actual" ? "Drawn over today's forecast. Leave empty for a forecast-only card." : s.name === "forecast_entry" ? "Leave empty to add together every forecast in the Energy dashboard's solar panels." : ""}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
