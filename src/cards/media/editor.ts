import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import type { HaloMediaConfig } from "./logic";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "media_player" } } },
  { name: "name", selector: { text: {} } },
  { name: "shadow", selector: { boolean: {} } },
  { name: "speaker", selector: { select: { mode: "dropdown", options: [
    { value: "auto", label: "Auto (from the device model)" }, { value: "beam-sub-mini", label: "Beam + Sub Mini" },
    { value: "era-300", label: "Era 300" }, { value: "one", label: "One" }, { value: "none", label: "None" } ] } } },
  { name: "image", selector: { text: {} } },
  { name: "players", selector: { entity: { domain: "media_player", multiple: true } } },
  { name: "speakers", selector: { entity: { domain: "media_player", multiple: true } } },
  { name: "favourites_entity", selector: { entity: { domain: "sensor" } } },
];
const LABELS: Record<string, string> = {
  shadow: "Drop shadow",
  entity: "Default media player", name: "Title (room)", speaker: "Speaker picture", image: "Your own picture (URL)",
  players: "All players (title becomes a dropdown, others become group chips)", speakers: "Group chips only (optional, overrides players)", favourites_entity: "Sonos favourites sensor",
};

export class HaloMediaCardEditor extends LitElement {
  @state() private _config?: HaloMediaConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloMediaConfig) { this._config = config; }
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
