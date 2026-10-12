import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { DETAIL_IDS, DETAIL_LABELS, type HaloWeatherConfig } from "./logic";

const LABELS: Record<string, string> = { entity: "Weather entity", name: "Title", shadow: "Drop shadow", layout: "Layout", details: "Details to show" };

export class HaloWeatherCardEditor extends LitElement {
  @state() private _config?: HaloWeatherConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloWeatherConfig) { this._config = config; }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
      { name: "name", selector: { text: {} } },
      { name: "shadow", selector: { boolean: {} } },
      { name: "layout", selector: { select: { mode: "dropdown", options: [{ value: "today", label: "Today: now, details and the next hours" }, { value: "week", label: "Week: now and a row per day" }] } } },
      { name: "details", selector: { select: { multiple: true, mode: "list", options: DETAIL_IDS.map((value) => ({ value, label: DETAIL_LABELS[value] })) } } },
    ];
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, layout: "today", ...this._config }} .schema=${this._schema()}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      .computeHelper=${(s: { name: string }) => (s.name === "details" ? "Up to four, in the order listed. None ticked shows humidity, wind and pressure. The card is compact when it is short, whatever the layout." : "")}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
