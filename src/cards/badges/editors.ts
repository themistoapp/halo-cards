import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { GRADIENTS } from "../../shared/looks";
import { PALETTE_NAMES } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { THEME_LABELS, type Theme } from "../entity/logic";
import { DEFAULT_TEMP_RULES, type BadgeBase, type BadgeRule, type BooleanBadgeConfig, type GaugeBadgeConfig, type ThermostatBadgeConfig, type WeatherBadgeConfig } from "./logic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sel = (options: { value: string; label: string }[], custom = false) => ({ select: { mode: "dropdown", options, ...(custom ? { custom_value: true } : {}) } });
const THEMES = (Object.keys(THEME_LABELS) as Theme[]).map((value) => ({ value, label: THEME_LABELS[value] }));
const COLOURS = PALETTE_NAMES.map((value) => ({ value, label: cap(value) }));
const STATE_COLOURS = [{ value: "none", label: "None" }, ...COLOURS.filter((c) => c.value !== "grey"), ...GRADIENTS.map((value) => ({ value, label: `${cap(value)} (gradient)` }))];

const LOOK = [
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "theme", selector: sel(THEMES) }] },
  { type: "grid", name: "", schema: [{ name: "show_name", selector: { boolean: {} } }, { name: "shadow", selector: { boolean: {} } }] },
];
const actions = (tap: string) => ({ type: "expandable", title: "Actions", schema: [
  { name: "tap_action", selector: { ui_action: { default_action: tap } } },
  { name: "hold_action", selector: { ui_action: { default_action: "more-info" } } },
  { name: "double_tap_action", selector: { ui_action: { default_action: "none" } } },
] });
const RULE = [{ type: "grid", name: "", schema: [
  { name: "above", selector: { number: { mode: "box", step: "any" } } },
  { name: "below", selector: { number: { mode: "box", step: "any" } } },
  { name: "colour", required: true, selector: sel(COLOURS, true) },
] }];

const LABELS: Record<string, string> = {
  entity: "Entity", name: "Name - optional", theme: "Look", show_name: "Show name", shadow: "Drop shadow",
  bloom_colour: "Bloom colour", min: "Min", max: "Max", attribute: "Attribute - optional", inside: "In the ring", icon: "Icon",
  colour: "Ring colour", decimals: "Decimals - optional", show: "Show", on_colour: "On colour", off_colour: "Off colour",
  tap_action: "Tap", hold_action: "Hold", double_tap_action: "Double tap", above: "Above", below: "Below",
};
const HELPERS: Record<string, string> = {
  theme: "Plain uses the card background. Black on white and white on black stay the same at night; gradients deepen a little.",
  bloom_colour: "Heat and cool glow orange and blue, as on the thermostat card. Temperature uses the colour rules below.",
  show: "Sun uses sun.sun and needs no weather entity. Rain needs a weather entity with a forecast.",
  on_colour: "A colour tints the badge, a gradient fills it. Type your own colour too (e.g. #e8a33d).",
  colour: "When no rule matches. One of the colours, or type your own.",
};

/** Drops empty fields and defaults so the YAML stays tidy. */
export function cleanBadge(v: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === "" || x === undefined || x === null || defaults[k] === x) continue;
    if (k === "colour_rules" && Array.isArray(x) && !x.length) continue;
    out[k] = x;
  }
  return out;
}

abstract class BadgeEditor<C extends BadgeBase> extends LitElement {
  static override styles = css`
    h3 { margin: 20px 0 4px; font-size: 14px; font-weight: 500; }
    p.note { margin: 0 0 8px; font-size: 12px; color: var(--secondary-text-color); }
    .rule { margin: 8px 0 0; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    .add { margin-top: 8px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
  `;
  @state() protected _config?: C;
  hass?: HomeAssistant;
  setConfig(config: C) { this._config = config; }

  protected abstract _schema(c: C): unknown[];
  protected abstract _defaults(): Record<string, unknown>;
  /** Colour rules: whether the editor shows them, and what an empty list stands for. */
  protected _rules(_c: C): { show: boolean; fallback: BadgeRule[]; note: string } | undefined { return undefined; }

  private _emit(v: Record<string, unknown>) {
    const config = { type: this._config!.type, ...cleanBadge(v, this._defaults()) } as unknown as C;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config, r = this._rules(c);
    const rules = ((c as { colour_rules?: BadgeRule[] }).colour_rules ?? []);
    const setRules = (list: BadgeRule[]) => this._emit({ ...(c as unknown as Record<string, unknown>), colour_rules: list });
    return html`
      <ha-form .hass=${this.hass} .data=${{ ...this._defaults(), ...c }} .schema=${this._schema(c)}
        .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name} .computeHelper=${(s: { name: string }) => HELPERS[s.name]}
        @value-changed=${(e: CustomEvent) => this._emit({ ...e.detail.value, colour_rules: (c as { colour_rules?: unknown }).colour_rules })}></ha-form>
      ${r?.show ? html`
        <h3>Colour by value</h3>
        <p class="note">${r.note}</p>
        ${rules.map((x, i) => html`<div class="rule">
          <ha-form .hass=${this.hass} .data=${x} .schema=${RULE} .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? cap(s.name)}
            @value-changed=${(e: CustomEvent) => setRules(rules.map((y, j) => (j === i ? (cleanBadge(e.detail.value, {}) as unknown as BadgeRule) : y)))}></ha-form>
          <div class="bar"><button @click=${() => setRules(rules.filter((_, j) => j !== i))}>Remove</button></div>
        </div>`)}
        ${!rules.length && r.fallback.length ? html`<button @click=${() => setRules(r.fallback)}>Start from the defaults</button> ` : nothing}
        <button class="add" @click=${() => setRules([...rules, { colour: "red" }])}>Add colour rule</button>` : nothing}`;
  }
}

const BASE_DEFAULTS = { theme: "plain", show_name: true, shadow: true };
const RULES_NOTE = "The first rule the value meets sets the colour. Set Above, Below, or both for a band; a rule with neither catches everything left.";

export class HaloThermostatBadgeEditor extends BadgeEditor<ThermostatBadgeConfig> {
  protected _defaults() { return { ...BASE_DEFAULTS, bloom_colour: "action" }; }
  protected _schema(c: ThermostatBadgeConfig) {
    const climate = !!c.entity?.startsWith("climate.");
    return [
      { name: "entity", required: true, selector: { entity: { filter: [{ domain: "climate" }, { domain: "sensor", device_class: "temperature" }] } } },
      ...(climate ? [{ name: "bloom_colour", selector: sel([{ value: "action", label: "Heat / cool, as the thermostat card" }, { value: "temperature", label: "Temperature bands" }]) }]
        : [{ type: "grid", name: "", schema: [{ name: "min", selector: { number: { mode: "box", step: "any" } } }, { name: "max", selector: { number: { mode: "box", step: "any" } } }] }]),
      ...LOOK, actions("more-info"),
    ];
  }
  protected override _rules(c: ThermostatBadgeConfig) {
    const show = !c.entity?.startsWith("climate.") || c.bloom_colour === "temperature";
    return { show, fallback: DEFAULT_TEMP_RULES, note: `${RULES_NOTE} With none, it's blue below 18°, yellow below 20°, orange below 22° and red above.` };
  }
}

export class HaloGaugeBadgeEditor extends BadgeEditor<GaugeBadgeConfig> {
  protected _defaults() { return { ...BASE_DEFAULTS, inside: "value" }; }
  protected _schema(c: GaugeBadgeConfig) {
    return [
      { name: "entity", required: true, selector: { entity: {} } },
      { name: "attribute", selector: { attribute: { entity_id: c.entity } } },
      { type: "grid", name: "", schema: [{ name: "min", selector: { number: { mode: "box", step: "any" } } }, { name: "max", selector: { number: { mode: "box", step: "any" } } }] },
      { type: "grid", name: "", schema: [
        { name: "inside", selector: sel([{ value: "value", label: "Value" }, { value: "icon", label: "Icon" }]) },
        (c.inside ?? "value") === "icon" ? { name: "icon", selector: { icon: {} } } : { name: "decimals", selector: { number: { min: 0, max: 3, mode: "box" } } },
      ] },
      { name: "colour", selector: sel(COLOURS, true) },
      ...LOOK, actions("more-info"),
    ];
  }
  protected override _rules() { return { show: true, fallback: [], note: `${RULES_NOTE} Min and max default to 0 and 100.` }; }
}

export class HaloWeatherBadgeEditor extends BadgeEditor<WeatherBadgeConfig> {
  protected _defaults() { return { ...BASE_DEFAULTS, show: "now" }; }
  protected _schema(c: WeatherBadgeConfig) {
    return [
      { name: "show", selector: sel([{ value: "now", label: "Now: temperature and conditions" }, { value: "sun", label: "Sun: next sunrise or sunset" }, { value: "rain", label: "Rain: today's chance" }]) },
      ...((c.show ?? "now") === "sun" ? [] : [{ name: "entity", required: true, selector: { entity: { domain: "weather" } } }]),
      ...LOOK, actions("more-info"),
    ];
  }
}

export class HaloBooleanBadgeEditor extends BadgeEditor<BooleanBadgeConfig> {
  protected _defaults() { return { ...BASE_DEFAULTS, on_colour: "none", off_colour: "none" }; }
  protected _schema() {
    return [
      { name: "entity", required: true, selector: { entity: {} } },
      { name: "icon", selector: { icon: {} } },
      { type: "grid", name: "", schema: [{ name: "on_colour", selector: sel(STATE_COLOURS, true) }, { name: "off_colour", selector: sel(STATE_COLOURS, true) }] },
      ...LOOK, actions("toggle"),
    ];
  }
}
