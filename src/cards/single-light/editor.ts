import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { DEFAULT_PRESETS, hexRgb, presetCss, type HaloSingleLightConfig, type Preset } from "./logic";

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { type: "grid", name: "", schema: [
    { name: "fitting", selector: { select: { mode: "dropdown", options: [
      { value: "none", label: "None (icon)" }, { value: "downlight", label: "Downlight" }, { value: "pendant", label: "Pendant" },
      { value: "lantern", label: "Wall lantern" }, { value: "path", label: "Path light" }, { value: "bar", label: "Floor light bar" },
      { value: "bloom", label: "Table lamp (Bloom)" }, { value: "gem", label: "Hanging gem bulb" }, { value: "chandelier", label: "Chandelier" },
      { value: "fairy", label: "Fairy lights" }, { value: "string", label: "String lights" } ] } } },
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
const WHITE_ROW = [{ type: "grid", name: "", schema: [
  { name: "name", selector: { text: {} } },
  { name: "kelvin", selector: { color_temp: { unit: "kelvin", min: 2000, max: 6500 } } },
] }];
const COLOUR_ROW = [{ type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "colour", selector: { text: {} } }] }];
const ROW_LABELS: Record<string, string> = { name: "Name", kelvin: "Warmth", colour: "Colour (hex)" };
const DEFAULTS: Partial<HaloSingleLightConfig> = { fitting: "none", layout: "auto", shadow: true };

/** A preset as typed: an empty name dropped, warmth rounded, hex trimmed. */
export function cleanPreset(p: Preset): Preset {
  const out: Preset = {};
  if (p.name?.trim()) out.name = p.name.trim();
  if (p.kelvin !== undefined) out.kelvin = Math.round(Number(p.kelvin) || 2700);
  else out.colour = (p.colour ?? "").trim();
  return out;
}
/** The presets to save: none set when they match the built-in ones. */
export function presetsToSave(list: Preset[]): Preset[] | undefined {
  return JSON.stringify(list) === JSON.stringify(DEFAULT_PRESETS) ? undefined : list;
}
const toHex = (c: [number, number, number]) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

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
  static override styles = css`
    details { margin: 10px 0 0; border: 1px solid var(--divider-color); border-radius: 12px; padding: 0 12px; }
    details[open] { padding-bottom: 12px; }
    summary { cursor: pointer; padding: 12px 0; font-weight: 500; list-style: none; display: flex; justify-content: space-between; gap: 8px; }
    summary::-webkit-details-marker { display: none; }
    summary span { color: var(--secondary-text-color); font-weight: 400; font-size: 13px; }
    summary::after { content: "▾"; color: var(--secondary-text-color); }
    details[open] summary::after { content: "▴"; }
    p.note { margin: 0 0 10px; font-size: 13px; color: var(--secondary-text-color); }
    .row { display: flex; gap: 12px; align-items: flex-start; margin: 10px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .row > div { flex: 1; min-width: 0; }
    .dot { position: relative; flex: none; width: 28px; height: 28px; margin-top: 14px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 2px var(--card-background-color, #fff), 0 0 0 1px var(--divider-color); }
    .dot input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    .btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  `;
  @state() private _config?: HaloSingleLightConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloSingleLightConfig) { this._config = config; }

  private _emit(config: HaloSingleLightConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _putPresets(list: Preset[] | undefined) {
    const { presets: _, ...rest } = this._config!;
    this._emit(list ? { ...rest, presets: list } : rest);
  }

  /** One row per preset: a white (name and warmth) or a colour (name and hex; the dot is a colour picker). */
  private _presets() {
    const own = this._config!.presets, rows = own ?? DEFAULT_PRESETS;
    const put = (next: Preset[]) => this._putPresets(presetsToSave(next));
    const set = (i: number, p: Preset) => put(rows.map((x, j) => (j === i ? cleanPreset(p) : x)));
    const move = (i: number, d: number) => { const n = [...rows]; [n[i], n[i + d]] = [n[i + d], n[i]]; put(n); };
    const summary = !own ? `${rows.length} · built in` : own.length ? `${own.length}` : "off";
    return html`<details><summary>Presets<span>${summary}</span></summary>
      <p class="note">The full card shows them all (as many as fit). The smaller sizes show as many as fit, whites and colours in turn, in this order.</p>
      ${rows.map((p, i) => {
        const white = p.kelvin !== undefined;
        return html`<div class="row">
          ${white ? html`<span class="dot" style="--c:${presetCss(p)}"></span>`
            : html`<label class="dot" style="--c:${presetCss(p)}" title="Pick a colour"><input type="color" aria-label="Pick a colour" .value=${toHex(hexRgb(p.colour ?? "") ?? [255, 255, 255])}
                @change=${(e: Event) => set(i, { ...p, colour: (e.target as HTMLInputElement).value })} /></label>`}
          <div>
            <ha-form .hass=${this.hass} .data=${p} .schema=${white ? WHITE_ROW : COLOUR_ROW} .computeLabel=${(s: { name: string }) => ROW_LABELS[s.name] ?? s.name}
              @value-changed=${(e: CustomEvent) => set(i, white ? { ...e.detail.value, colour: undefined } : { ...e.detail.value, kelvin: undefined })}></ha-form>
            <div class="bar">
              <button ?disabled=${i === 0} @click=${() => move(i, -1)}>Up</button>
              <button ?disabled=${i === rows.length - 1} @click=${() => move(i, 1)}>Down</button>
              <button @click=${() => put(rows.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div></div>`;
      })}
      <div class="btns">
        <button class="add" @click=${() => put([...rows, { kelvin: 3000 }])}>Add white</button>
        <button class="add" @click=${() => put([...rows, { colour: "#47adf5" }])}>Add colour</button>
        <button ?disabled=${!own} @click=${() => this._putPresets(undefined)}>Reset to built-in</button>
        <button ?disabled=${!!own && !own.length} @click=${() => this._putPresets([])}>No presets</button>
      </div>
    </details>`;
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    return html`<ha-form .hass=${this.hass} .data=${{ ...DEFAULTS, ...this._config }} .schema=${SCHEMA}
      .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name} .computeHelper=${(s: { name: string }) => HELPERS[s.name]}
      @value-changed=${(e: CustomEvent) => {
        // The presets have their own section below; keep them through edits made here.
        this._emit(cleanSingleLight({ ...(e.detail.value as Record<string, unknown>), presets: this._config!.presets }));
      }}></ha-form>
      ${this._presets()}`;
  }
}
