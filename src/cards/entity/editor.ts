import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { PALETTE_NAMES } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { THEME_LABELS, displayOf, isOnOff, tapDefault, valueOptions, type ColourRule, type HaloEntityConfig, type Theme } from "./logic";
import { sanitizeSvg, svgKind } from "./svg-icon";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sel = (options: { value: string; label: string }[], custom = false) => ({ select: { mode: "dropdown", options, ...(custom ? { custom_value: true } : {}) } });
const THEMES = (Object.keys(THEME_LABELS) as Theme[]).map((value) => ({ value, label: THEME_LABELS[value] }));
const COLOURS = PALETTE_NAMES.map((value) => ({ value, label: cap(value) }));
/** ha-form's select can't hold an empty value, so "nothing chosen" has a stand-in that never reaches the config. */
const STATE = "$state", AUTO = "$auto", TEXT = "$text", ICON = "$icon";

function schema(hass: HomeAssistant, c: HaloEntityConfig) {
  const opts = c.entity ? valueOptions(hass, c.entity, c.attribute) : [];
  const opts2 = c.secondary_entity ? valueOptions(hass, c.secondary_entity, c.secondary_attribute) : [];
  const valueSelect = (name: string, o: { value: string; label: string }[]) =>
    o.length > 1 ? [{ name, selector: sel(o.map((x) => ({ ...x, value: x.value || STATE }))) }] : [];
  return [
    { name: "entity", required: true, selector: { entity: {} } },
    ...valueSelect("attribute", opts),
    { type: "grid", name: "", schema: [
      { name: "size", selector: sel([{ value: "small", label: "Small (3 × 2)" }, { value: "large", label: "Large (6 × 3)" }]) },
      { name: "theme", selector: sel(THEMES) },
    ] },
    { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "shadow", selector: { boolean: {} } }] },
    { type: "expandable", title: "Icon", schema: [
      { type: "grid", name: "", schema: [{ name: "icon", selector: { icon: {} } }, { name: "icon_colour", selector: sel([{ value: TEXT, label: "Text colour" }, ...COLOURS], true) }] },
      ...(isOnOff(c.entity, c.attribute) ? [{ name: "on_colour", selector: sel([{ value: "none", label: "None" }, ...COLOURS], true) }] : []),
      { name: "show_icon", selector: { boolean: {} } },
      { name: "icon_svg", selector: { text: { multiline: true } } },
    ] },
    { type: "expandable", title: "Value", schema: [
      { type: "grid", name: "", schema: [{ name: "unit", selector: { text: {} } }, { name: "decimals", selector: { number: { min: 0, max: 4, mode: "box" } } }] },
    ] },
    { type: "expandable", title: "Line below", schema: [
      { name: "secondary_text", selector: { text: {} } },
      { name: "secondary_entity", selector: { entity: {} } },
      ...(c.secondary_entity ? [...valueSelect("secondary_attribute", opts2), { name: "secondary_name", selector: { text: {} } }] : []),
    ] },
    { type: "expandable", title: "Below the figure", schema: [
      { name: "display", selector: sel([{ value: "graph", label: "History graph" }, { value: "gauge", label: "Gauge" }, { value: "none", label: "Nothing" }]) },
      ...(displayOf(c) === "gauge" ? [
        { name: "gauge_style", selector: sel([{ value: "ring", label: "Ring" }, { value: "line", label: "Line" }, { value: "semicircle", label: "Semicircle" }]) },
        { type: "grid", name: "", schema: [{ name: "gauge_min", selector: { number: { mode: "box", step: "any" } } }, { name: "gauge_max", selector: { number: { mode: "box", step: "any" } } }] },
        { name: "gauge_colour", selector: sel([{ value: ICON, label: "Same as the icon" }, ...COLOURS], true) },
        { type: "grid", name: "", schema: [{ name: "gauge_labels", selector: { boolean: {} } }, { name: "gauge_bands", selector: { boolean: {} } }] },
      ] : []),
      ...(displayOf(c) === "graph" ? [
        { type: "grid", name: "", schema: [
          { name: "graph_colour", selector: sel(COLOURS, true) },
          { name: "graph_hours", selector: { number: { min: 1, max: 168, mode: "box", unit_of_measurement: "h" } } },
        ] },
        { name: "graph_scale", selector: sel([{ value: AUTO, label: "Automatic" }, { value: "zero", label: "From zero" }, { value: "range", label: "Lowest to highest" }]) },
        { type: "grid", name: "", schema: [{ name: "graph_min", selector: { number: { mode: "box", step: "any" } } }, { name: "graph_max", selector: { number: { mode: "box", step: "any" } } }] },
      ] : []),
    ] },
    { type: "expandable", title: "Actions", schema: [
      { name: "tap_action", selector: { ui_action: { default_action: tapDefault(c) } } },
      { name: "hold_action", selector: { ui_action: { default_action: "none" } } },
      { name: "double_tap_action", selector: { ui_action: { default_action: "none" } } },
    ] },
  ];
}
const RULE = [{ type: "grid", name: "", schema: [
  { name: "above", selector: { number: { mode: "box", step: "any" } } },
  { name: "below", selector: { number: { mode: "box", step: "any" } } },
  { name: "colour", required: true, selector: sel(COLOURS, true) },
] }];

const LABELS: Record<string, string> = {
  entity: "Entity", attribute: "Value", size: "Size", theme: "Look", name: "Name - optional", shadow: "Drop shadow",
  icon: "Icon", icon_colour: "Icon colour", on_colour: "On colour", show_icon: "Show icon", icon_svg: "Custom SVG icon - optional",
  unit: "Unit - optional", decimals: "Decimals - optional",
  secondary_text: "Your text - optional", secondary_entity: "Another entity - optional", secondary_attribute: "Its value", secondary_name: "Its name - optional",
  display: "Show", gauge_style: "Gauge style", gauge_min: "Min - optional", gauge_max: "Max - optional", gauge_colour: "Gauge colour",
  gauge_labels: "Show min and max", gauge_bands: "Colour bands from rules",
  graph_colour: "Graph colour", graph_hours: "Period", graph_scale: "Scale", graph_min: "Bottom - optional", graph_max: "Top - optional",
  tap_action: "Tap", hold_action: "Hold", double_tap_action: "Double tap",
  above: "Above", below: "Below", colour: "Colour",
};
const HELPERS: Record<string, string> = {
  size: "Small tiles are a quarter of a section and large ones half. Dragging the card's size in the layout editor works too.",
  theme: "Plain uses the card background. Black on white and white on black stay the same at night; gradients deepen a little.",
  icon_colour: "One of the colours, or type your own (e.g. #e8a33d).",
  on_colour: "While on, the disc behind the icon fills with this colour and the icon turns white. None keeps the icon as it is.",
  display: "Graphs need a large tile and a number in the entity's state. Gauges fit any size and work on attributes too.",
  gauge_style: "The ring holds the figure; the line sits under it; the semicircle has the figure in its bowl.",
  gauge_min: "Leave empty for 0 to 100 on percentages, or a number entity's own min and max. Set both for anything else.",
  gauge_colour: "One of the colours, or type your own. Gradient tiles draw the gauge in white. Colour rules win.",
  gauge_bands: "Faint stretches of each colour rule's colour along the track.",
  graph_colour: "One of the colours, or type your own. Gradient tiles draw the graph in white.",
  graph_hours: "1 to 168 (a week). Over 24 hours uses Home Assistant's hourly statistics.",
  graph_scale: "Automatic starts power, energy and money at zero, runs percentages 0 to 100, and fits anything else to its own range.",
  secondary_entity: "Shown as its name and value. Wins over your text if both are set.",
  icon_svg: "Paste <svg> markup, a 24×24 icon path, or a URL such as /local/icons/boiler.svg. Replaces the icon. Black lines follow the text colour and white fills follow the card, so it works at night.",
};

/** Drops the form's empty fields, stand-ins and defaults so the YAML stays tidy. */
export function cleanConfig(v: Record<string, unknown>): HaloEntityConfig {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === "" || x === undefined || x === null || x === STATE || x === AUTO || x === TEXT || x === ICON) continue;
    if ((k === "theme" && x === "plain") || ((k === "show_icon" || k === "shadow") && x === true) || (k === "graph" && x === false)) continue;
    if ((k === "graph_colour" && x === "grey") || (k === "on_colour" && x === "orange") || (k === "graph_hours" && x === 24)) continue;
    if ((k === "display" && x === "none") || (k === "gauge_style" && x === "ring") || (k === "gauge_labels" && x === true) || (k === "gauge_bands" && x === false)) continue;
    if (k === "colour_rules" && Array.isArray(x) && !x.length) continue;
    out[k] = x;
  }
  return out as unknown as HaloEntityConfig;
}

export class HaloEntityCardEditor extends LitElement {
  static override styles = css`
    h3 { margin: 20px 0 4px; font-size: 14px; font-weight: 500; }
    p.note { margin: 0 0 8px; font-size: 12px; color: var(--secondary-text-color); }
    .rule { margin: 8px 0 0; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    .add { margin-top: 8px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .pv { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; font-size: 12px; color: var(--secondary-text-color); }
    .pv span.ic { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); color: var(--primary-text-color); --surface: var(--card-background-color, #fff); }
    .pv.bad { color: var(--error-color, #c2362b); }
  `;
  @state() private _config?: HaloEntityConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloEntityConfig) { this._config = config; }

  private _emit(config: HaloEntityConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  private _changed(v: Record<string, unknown>) {
    const old = this._config!;
    // `display` replaces the old `graph` switch.
    const { graph: _old, ...rest } = v;
    const next = cleanConfig({
      ...rest,
      colour_rules: old.colour_rules,
      // A different entity has different values: start again from its state.
      ...(v.entity !== old.entity ? { attribute: undefined } : {}),
      ...(v.secondary_entity !== old.secondary_entity ? { secondary_attribute: undefined } : {}),
    });
    // A new size should take effect: drop the size the layout editor saved, so the card's own default applies.
    if ((next.size ?? "small") !== (old.size ?? "small")) delete (next as unknown as Record<string, unknown>).grid_options;
    this._emit(next);
  }

  private _setRules(rules: ColourRule[]) { this._emit(cleanConfig({ ...this._config!, colour_rules: rules })); }

  private _preview(src?: string) {
    const s = src?.trim();
    if (!s) return nothing;
    const kind = svgKind(s);
    if (kind === "invalid" || (kind === "markup" && !sanitizeSvg(s))) return html`<div class="pv bad">That isn't an SVG, an icon path or a URL.</div>`;
    return html`<div class="pv"><span class="ic"><halo-svg-icon .src=${s}></halo-svg-icon></span>Preview</div>`;
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config;
    const label = (s: { name: string }) => LABELS[s.name] ?? s.name;
    const helper = (s: { name: string }) => HELPERS[s.name];
    const data = {
      size: "small", theme: "plain", shadow: true, show_icon: true, gauge_style: "ring", gauge_labels: true, gauge_bands: false, ...c, display: displayOf(c),
      attribute: c.attribute ?? STATE, secondary_attribute: c.secondary_attribute ?? STATE, graph_scale: c.graph_scale ?? AUTO,
      icon_colour: c.icon_colour ?? TEXT, on_colour: c.on_colour ?? "orange", gauge_colour: c.gauge_colour ?? ICON, graph_colour: c.graph_colour ?? "grey", graph_hours: c.graph_hours ?? 24,
    };
    const rules = c.colour_rules ?? [];
    return html`
      <ha-form .hass=${this.hass} .data=${data} .schema=${schema(this.hass, c)} .computeLabel=${label} .computeHelper=${helper}
        @value-changed=${(e: CustomEvent) => this._changed(e.detail.value)}></ha-form>
      ${this._preview(c.icon_svg)}
      <h3>Colour by value</h3>
      <p class="note">The first rule the value meets recolours the icon and the graph or gauge. Set Above, Below, or both for a band.</p>
      ${rules.map((r, i) => html`<div class="rule">
        <ha-form .hass=${this.hass} .data=${r} .schema=${RULE} .computeLabel=${label}
          @value-changed=${(e: CustomEvent) => this._setRules(rules.map((x, j) => (j === i ? (cleanConfig(e.detail.value) as unknown as ColourRule) : x)))}></ha-form>
        <div class="bar"><button @click=${() => this._setRules(rules.filter((_, j) => j !== i))}>Remove</button></div>
      </div>`)}
      <button class="add" @click=${() => this._setRules([...rules, { colour: "red" }])}>Add colour rule</button>`;
  }
}
