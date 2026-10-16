import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloSingleLightConfig } from "./logic";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { type: "grid", name: "", schema: [
    { name: "fitting", selector: { select: { mode: "dropdown", options: [
      { value: "none", label: "None (icon)" }, { value: "downlight", label: "Downlight" }, { value: "pendant", label: "Pendant" },
      { value: "lantern", label: "Wall lantern" }, { value: "path", label: "Path light" } ] } } },
    { name: "icon", selector: { icon: {} } },
  ] },
  { name: "layout", selector: { select: { mode: "dropdown", options: [
    { value: "auto", label: "Automatic (by size)" }, { value: "full", label: "Full" }, { value: "compact", label: "Compact bar" }, { value: "mini", label: "Mini (icon and name)" } ] } } },
  { type: "grid", name: "", schema: [{ name: "colour", selector: { text: {} } }, { name: "shadow", selector: { boolean: {} } }] },
];
const LABELS: Record<string, string> = {
  entity: "Light", name: "Name", fitting: "Light type", icon: "Icon", layout: "Layout", colour: "Colour for white lights", shadow: "Drop shadow",
};
const HELPERS: Record<string, string> = {
  fitting: "A picture of the fitting, lit in the light's colour. None shows the icon instead.",
  icon: "Any mdi icon, shown when there's no picture. Leave empty for a bulb.",
  layout: "Automatic: Mini under 240px wide (6 × 2), the compact bar under 200px tall (12 × 2 or 12 × 3), else Full.",
  colour: "Glow for lights that don't report a colour, e.g. #ffe3bd (the default warm white).",
};
const DEFAULTS: Partial<HaloSingleLightConfig> = { fitting: "none", layout: "auto", shadow: true };

/** Drops values that are the same as the defaults, so the YAML stays short. */
export function cleanSingleLight(v: Record<string, unknown>): HaloSingleLightConfig {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === "" || x === undefined || x === null) continue;
    if (k !== "type" && DEFAULTS[k as keyof HaloSingleLightConfig] === x) continue;
    out[k] = x;
  }
  return out as unknown as HaloSingleLightConfig;
}

export class HaloSingleLightCardEditor extends LitElement {
  @state() private _config?: HaloSingleLightConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloSingleLightConfig) { this._config = config; }
  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ ...DEFAULTS, ...this._config }} .schema=${SCHEMA}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name} .computeHelper=${(s: { name: string }) => HELPERS[s.name]}
      @value-changed=${(e: CustomEvent) => {
        // Presets are set in YAML; keep them through edits made here.
        this._config = cleanSingleLight({ ...(e.detail.value as Record<string, unknown>), presets: this._config!.presets });
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      }}></ha-form>`;
  }
}
