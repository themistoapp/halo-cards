import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloBackdropConfig } from "./logic";

const SCHEMA = [
  { name: "show", selector: { select: { mode: "dropdown", options: [{ value: "tile", label: "Daylight tile" }, { value: "hidden", label: "Hidden (background only)" }] } } },
  { name: "strength", selector: { number: { min: 0.4, max: 1.5, step: 0.05, mode: "slider" } } },
  { name: "sun", selector: { select: { mode: "dropdown", options: [{ value: "moves", label: "Moves with the sun" }, { value: "fixed", label: "Stays top left" }] } } },
  { type: "grid", name: "", schema: [{ name: "grain", selector: { boolean: {} } }, { name: "shadow", selector: { boolean: {} } }] },
  { name: "name", selector: { text: {} } },
  { name: "entity", selector: { entity: { domain: "sun" } } },
];
const LABELS: Record<string, string> = {
  show: "Show", strength: "Strength", sun: "Sun glow", grain: "Film grain", shadow: "Drop shadow (tile)", name: "Tile title", entity: "Sun entity",
};
const HELPERS: Record<string, string> = {
  show: "The background follows the sun either way. Hidden takes no room on the dashboard.",
  strength: "How big and strong the glows are.",
  name: "Leave empty for Daylight by day and Night after sunset.",
  entity: "Leave empty for sun.sun.",
};
const DEFAULTS: Partial<HaloBackdropConfig> = { show: "tile", strength: 1, sun: "moves", grain: true, shadow: true };

/** Drops values that are the same as the defaults, so the YAML stays short. */
export function cleanBackdrop(v: Record<string, unknown>): HaloBackdropConfig {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === "" || x === undefined || x === null) continue;
    if (k !== "type" && DEFAULTS[k as keyof HaloBackdropConfig] === x) continue;
    if (k === "entity" && x === "sun.sun") continue;
    out[k] = x;
  }
  return out as unknown as HaloBackdropConfig;
}

export class HaloBackdropCardEditor extends LitElement {
  @state() private _config?: HaloBackdropConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloBackdropConfig) { this._config = config; }
  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ ...DEFAULTS, ...this._config }} .schema=${SCHEMA}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name} .computeHelper=${(s: { name: string }) => HELPERS[s.name]}
      @value-changed=${(e: CustomEvent) => {
        this._config = cleanBackdrop(e.detail.value as Record<string, unknown>);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
