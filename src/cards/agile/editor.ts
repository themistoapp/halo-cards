import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { FIGURES, FIGURE_LABELS, type HaloAgileConfig } from "./logic";

const LABELS: Record<string, string> = {
  name: "Title", shadow: "Drop shadow", rates_today: "Today's rates", rates_tomorrow: "Tomorrow's rates", figures: "Figures across the top",
  cheap_below: "Green at or below (p/kWh)", expensive_above: "Red above (p/kWh)",
};

export class HaloAgileCardEditor extends LitElement {
  @state() private _config?: HaloAgileConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloAgileConfig) { this._config = config; }

  private _schema = [
    { name: "name", selector: { text: {} } },
    { name: "rates_today", required: true, selector: { entity: { domain: ["event", "sensor"] } } },
    { name: "rates_tomorrow", selector: { entity: { domain: ["event", "sensor"] } } },
    { name: "figures", selector: { select: { multiple: true, mode: "list", options: FIGURES.map((value) => ({ value, label: FIGURE_LABELS[value] })) } } },
    { name: "shadow", selector: { boolean: {} } },
    { type: "grid", name: "", schema: [
      { name: "cheap_below", selector: { number: { min: -50, max: 100, step: 1, mode: "box" } } },
      { name: "expensive_above", selector: { number: { min: 0, max: 100, step: 1, mode: "box" } } },
    ] },
  ];

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ shadow: true, figures: FIGURES, cheap_below: 15, expensive_above: 30, ...this._config }} .schema=${this._schema}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
      .computeHelper=${(s: { name: string }) => s.name === "rates_today" ? "The Octopus Energy integration's Current Day Rates entity (event.octopus_energy_electricity_…_current_day_rates)." : s.name === "rates_tomorrow" ? "The Next Day Rates entity. Tomorrow's rates appear from about 16:00." : s.name === "figures" ? "Untick any you don't want. Only as many as fit are shown, in this order." : ""}
      @value-changed=${(e: CustomEvent) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
