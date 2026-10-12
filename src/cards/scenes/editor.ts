import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { rowsOf, type HaloScenesConfig, type SceneRow } from "./logic";

const TOP = [
  { name: "name", selector: { text: {} } },
  { name: "shadow", selector: { boolean: {} } },
];
const ROW = [
  { name: "entity", required: true, selector: { entity: { domain: ["scene", "script", "button", "input_button"] } } },
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} } }] },
  { name: "colour", selector: { text: {} } },
];
const LABELS: Record<string, string> = {
  name: "Name", shadow: "Drop shadow", entity: "Scene, script or button", icon: "Icon", colour: "Colour (hex, e.g. #e8a33d) - optional",
};

export class HaloScenesCardEditor extends LitElement {
  static override styles = css`
    .row { margin: 12px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { margin-top: 12px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    h3 { margin: 16px 0 0; font-size: 14px; font-weight: 500; }
  `;
  @state() private _config?: HaloScenesConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloScenesConfig) { this._config = config; }

  private _emit(config: HaloScenesConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _setRows(rows: SceneRow[]) { this._emit({ ...this._config!, scenes: rows }); }

  override render() {
    if (!this.hass || !this._config) return html``;
    const rows = rowsOf(this._config);
    const label = (s: { name: string }) => LABELS[s.name] ?? s.name;
    return html`
      <ha-form .hass=${this.hass} .data=${{ shadow: true, ...this._config }} .schema=${TOP} .computeLabel=${label}
        @value-changed=${(e: CustomEvent) => this._emit({ ...e.detail.value, scenes: this._config!.scenes })}></ha-form>
      <h3>Buttons</h3>
      ${rows.map((r, i) => html`<div class="row">
        <ha-form .hass=${this.hass} .data=${r} .schema=${ROW} .computeLabel=${label}
          @value-changed=${(e: CustomEvent) => this._setRows(rows.map((x, j) => (j === i ? e.detail.value : x)))}></ha-form>
        <div class="bar">
          <button ?disabled=${i === 0} @click=${() => { const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; this._setRows(n); }}>Up</button>
          <button ?disabled=${i === rows.length - 1} @click=${() => { const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; this._setRows(n); }}>Down</button>
          <button @click=${() => this._setRows(rows.filter((_, j) => j !== i))}>Remove</button>
        </div>
      </div>`)}
      <button class="add" @click=${() => this._setRows([...rows, { entity: "" }])}>Add button</button>`;
  }
}
