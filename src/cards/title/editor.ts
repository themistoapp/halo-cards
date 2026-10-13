import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloTitleConfig } from "./halo-title-card";

const STYLE = { name: "style", selector: { select: { mode: "dropdown", options: [{ value: "greeting", label: "Greeting" }, { value: "date", label: "Big date" }, { value: "heading", label: "Section heading" }] } } };
const HEADING = [
  STYLE,
  { name: "title", selector: { text: {} } },
  { name: "subtitle", selector: { text: { multiline: true } } },
  { name: "chips", selector: { entity: { multiple: true } } },
];
const GREETING = [
  STYLE,
  { type: "grid", name: "", schema: [
    { name: "greeting", selector: { select: { mode: "dropdown", options: [{ value: "polite", label: "Polite" }, { value: "cheeky", label: "Cheeky" }, { value: "rude", label: "Rude" }] } } },
    { name: "name", selector: { text: {} } },
  ] },
  { type: "grid", name: "", schema: [{ name: "watershed", selector: { boolean: {} } }, { name: "watershed_from", selector: { time: {} } }] },
  { name: "weather", selector: { entity: { domain: "weather" } } },
  { name: "title", selector: { text: {} } },
  { name: "shadow", selector: { boolean: {} } },
];
const LABELS: Record<string, string> = {
  style: "Style", title: "Title", subtitle: "Subtitle", chips: "Chips", greeting: "Greeting tone", name: "Your name", watershed: "Rude only after the watershed",
  watershed_from: "Watershed", weather: "Weather (optional)", shadow: "Drop shadow",
};
const HELPERS: Record<string, string> = {
  subtitle: "Plain text, or a template such as {{ states.light | selectattr('state','eq','on') | list | count }} lights on",
  chips: "Small buttons beside the title with each entity's state. Tap one for its details.",
  title: "Leave empty for a greeting that changes with the time of day and the weather.",
  name: "Leave empty to use the name of whoever is signed in.",
  weather: "Shows the temperature and lets the greeting mention rain, cold, heat and wind.",
};

export class HaloTitleCardEditor extends LitElement {
  @state() private _config?: HaloTitleConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloTitleConfig) { this._config = config; }
  override render() {
    if (!this.hass || !this._config) return html``;
    const heading = this._config.style === "heading";
    return html`<ha-form .hass=${this.hass} .data=${{ style: "greeting", greeting: "cheeky", shadow: true, watershed_from: "21:00", ...this._config }} .schema=${heading ? HEADING : GREETING}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name} .computeHelper=${(s: { name: string }) => (s.name === "title" && heading ? undefined : HELPERS[s.name])}
      @value-changed=${(e: CustomEvent) => {
        const v: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(e.detail.value as Record<string, unknown>)) if (x !== "" && x !== undefined && !(Array.isArray(x) && !x.length)) v[k] = x;
        this._config = v as unknown as HaloTitleConfig;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
