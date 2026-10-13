import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { valueOptions, type EntityRow, type HaloEntitiesConfig } from "./logic";
import { sanitizeSvg, svgKind } from "./svg-icon";

const TOP = [
  { name: "name", selector: { text: {} } },
  { name: "shadow", selector: { boolean: {} } },
];
/** ha-form's select can't hold an empty value, so the state is "$state" in the form and no `attribute` in the config. */
const STATE = "$state";

function rowSchema(hass: HomeAssistant, r: EntityRow) {
  const opts = r.entity ? valueOptions(hass, r.entity, r.attribute) : [];
  return [
    { name: "entity", required: true, selector: { entity: {} } },
    ...(opts.length > 1 ? [{ name: "attribute", selector: { select: { mode: "dropdown", options: opts.map((o) => ({ ...o, value: o.value || STATE })) } } }] : []),
    { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} } }] },
    { name: "icon_svg", selector: { text: { multiline: true } } },
    { type: "grid", name: "", schema: [{ name: "unit", selector: { text: {} } }, { name: "decimals", selector: { number: { min: 0, max: 4, mode: "box" } } }] },
    { name: "colour", selector: { text: {} } },
  ];
}
const LABELS: Record<string, string> = {
  name: "Name", shadow: "Drop shadow", entity: "Entity", attribute: "Value", icon: "Icon", icon_svg: "Custom SVG icon - optional",
  unit: "Unit - optional", decimals: "Decimals - optional", colour: "Colour (hex, e.g. #e8a33d) - optional",
};
const HELPERS: Record<string, string> = {
  icon_svg: "Paste <svg> markup, a 24×24 icon path, or a URL such as /local/icons/boiler.svg. Replaces the icon. Black lines follow the text colour and white fills follow the card, so it works at night.",
};

/** Drops the form's empty fields so the YAML stays tidy. */
function cleanRow(v: Record<string, unknown>): EntityRow {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (x !== "" && x !== undefined && x !== null && !(k === "attribute" && x === STATE)) out[k] = x;
  return out as unknown as EntityRow;
}

export class HaloEntitiesCardEditor extends LitElement {
  static override styles = css`
    .row { margin: 12px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { margin-top: 12px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    h3 { margin: 16px 0 0; font-size: 14px; font-weight: 500; }
    .pv { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; font-size: 12px; color: var(--secondary-text-color); }
    .pv span.ic { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); color: var(--primary-text-color); --surface: var(--card-background-color, #fff); }
    .pv.bad { color: var(--error-color, #c2362b); }
  `;
  @state() private _config?: HaloEntitiesConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloEntitiesConfig) { this._config = config; }

  private _emit(config: HaloEntitiesConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _setRows(rows: EntityRow[]) { this._emit({ ...this._config!, entities: rows }); }

  private _changed(rows: EntityRow[], i: number, v: Record<string, unknown>) {
    // A different entity has different values: start again from its state.
    const next = cleanRow(v.entity !== rows[i].entity ? { ...v, attribute: undefined } : v);
    this._setRows(rows.map((x, j) => (j === i ? next : x)));
  }

  private _preview(src?: string) {
    const s = src?.trim();
    if (!s) return nothing;
    const kind = svgKind(s);
    if (kind === "invalid" || (kind === "markup" && !sanitizeSvg(s))) return html`<div class="pv bad">That isn't an SVG, an icon path or a URL.</div>`;
    return html`<div class="pv"><span class="ic"><halo-svg-icon .src=${s}></halo-svg-icon></span>Preview</div>`;
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    // Unfiltered, so a just-added tile with no entity yet still shows.
    const rows = (this._config.entities ?? []).map((r) => (typeof r === "string" ? { entity: r } : r));
    const label = (s: { name: string }) => LABELS[s.name] ?? s.name;
    const helper = (s: { name: string }) => HELPERS[s.name];
    return html`
      <ha-form .hass=${this.hass} .data=${{ shadow: true, ...this._config }} .schema=${TOP} .computeLabel=${label}
        @value-changed=${(e: CustomEvent) => this._emit({ ...e.detail.value, entities: this._config!.entities })}></ha-form>
      <h3>Tiles</h3>
      ${rows.map((r, i) => html`<div class="row">
        <ha-form .hass=${this.hass} .data=${{ ...r, attribute: r.attribute ?? STATE }} .schema=${rowSchema(this.hass!, r)} .computeLabel=${label} .computeHelper=${helper}
          @value-changed=${(e: CustomEvent) => this._changed(rows, i, e.detail.value)}></ha-form>
        ${this._preview(r.icon_svg)}
        <div class="bar">
          <button ?disabled=${i === 0} @click=${() => { const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; this._setRows(n); }}>Up</button>
          <button ?disabled=${i === rows.length - 1} @click=${() => { const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; this._setRows(n); }}>Down</button>
          <button @click=${() => this._setRows(rows.filter((_, j) => j !== i))}>Remove</button>
        </div>
      </div>`)}
      <button class="add" @click=${() => this._setRows([...rows, { entity: "" }])}>Add tile</button>`;
  }
}
