import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { DETAIL_IDS, DETAIL_LABELS, SECTIONS, SECTION_LABELS, type HaloWeatherConfig } from "./logic";

const LABELS: Record<string, string> = { entity: "Weather entity", name: "Title", shadow: "Drop shadow", sections: "Show", details: "Details under the current weather" };

export class HaloWeatherCardEditor extends LitElement {
  @state() private _config?: HaloWeatherConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloWeatherConfig) { this._config = config; }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
      { name: "name", selector: { text: {} } },
      { name: "shadow", selector: { boolean: {} } },
      { name: "sections", selector: { select: { multiple: true, mode: "list", options: SECTIONS.map((value) => ({ value, label: SECTION_LABELS[value] })) } } },
      { name: "details", selector: { select: { multiple: true, mode: "list", options: DETAIL_IDS.map((value) => ({ value, label: DETAIL_LABELS[value] })) } } },
    ];
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, sections: this._config.layout === "week" ? ["current", "weekly"] : ["current", "hourly"], ...this._config }} .schema=${this._schema()}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      .computeHelper=${(s: { name: string }) => (s.name === "sections" ? "Tick any of them. The card needs to be taller for each one. When it is short (about two rows) it shows a compact version of the current weather." : s.name === "details" ? "Up to four, in the order listed. None ticked shows humidity, wind and pressure." : "")}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
