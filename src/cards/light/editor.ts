import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { allRowsOf, type HaloLightConfig, type LightRow } from "./logic";

const TOP = [
  { name: "name", selector: { text: {} } },
  { type: "grid", name: "", schema: [{ name: "shadow", selector: { boolean: {} } }, { name: "show_all_off", selector: { boolean: {} } }] },
  { name: "colour", selector: { text: {} } },
];
const ROW = [
  { name: "entity", required: true, selector: { entity: { domain: "light" } } },
  { type: "grid", name: "", schema: [
    { name: "name", selector: { text: {} } },
    { name: "type", selector: { select: { mode: "dropdown", options: [
      { value: "none", label: "Icon only" }, { value: "downlight", label: "Downlight" }, { value: "pendant", label: "Pendant" },
      { value: "strip", label: "Horizontal light bar" }, { value: "pole", label: "Vertical light bar" } ] } } },
  ] },
];
const LABELS: Record<string, string> = {
  name: "Name", shadow: "Drop shadow", show_all_off: "All off button", colour: "Colour for white lights (e.g. #ffe3bd)", entity: "Light", type: "Fitting",
};

export class HaloLightCardEditor extends LitElement {
  static override styles = css`
    .row { margin: 12px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { margin-top: 12px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    h3 { margin: 16px 0 0; font-size: 14px; font-weight: 500; }
  `;
  @state() private _config?: HaloLightConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloLightConfig) { this._config = config; }

  private _emit(config: HaloLightConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _rows(): LightRow[] { return allRowsOf(this._config!); }
  private _setRows(rows: LightRow[]) { this._emit({ ...this._config!, lights: rows }); }

  override render() {
    if (!this.hass || !this._config) return html``;
    const rows = this._rows();
    const label = (s: { name: string }) => LABELS[s.name] ?? s.name;
    return html`
      <ha-form .hass=${this.hass} .data=${{ shadow: true, show_all_off: true, ...this._config }} .schema=${TOP} .computeLabel=${label}
        @value-changed=${(e: CustomEvent) => this._emit({ ...e.detail.value, lights: this._config!.lights })}></ha-form>
      <h3>Lights</h3>
      ${rows.map((r, i) => html`<div class="row">
        <ha-form .hass=${this.hass} .data=${{ type: "none", ...r }} .schema=${ROW} .computeLabel=${label}
          @value-changed=${(e: CustomEvent) => this._setRows(rows.map((x, j) => (j === i ? e.detail.value : x)))}></ha-form>
        <div class="bar">
          <button ?disabled=${i === 0} @click=${() => { const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; this._setRows(n); }}>Up</button>
          <button ?disabled=${i === rows.length - 1} @click=${() => { const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; this._setRows(n); }}>Down</button>
          <button @click=${() => this._setRows(rows.filter((_, j) => j !== i))}>Remove</button>
        </div>
      </div>`)}
      <button class="add" @click=${() => this._setRows([...rows, { entity: "", type: "downlight" }])}>Add light</button>`;
  }
}
