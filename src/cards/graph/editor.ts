import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { PALETTE_NAMES } from "../../shared/tile";
import type { HomeAssistant } from "../../shared/types";
import { MAX_FIGURES, agilePreset, entitiesOf, solarPreset, sourceOf, type ColourRule, type FigureConfig, type HaloGraphConfig, type SeriesConfig } from "./logic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sel = (options: { value: string; label: string }[], custom = false) => ({ select: { mode: "dropdown", options, ...(custom ? { custom_value: true } : {}) } });
const num = (o: Record<string, unknown> = {}) => ({ number: { mode: "box", step: "any", ...o } });
/** ha-form's select can't hold an empty value, so "nothing chosen" has a stand-in that never reaches the config. */
const AUTO = "$auto", NONE = "$none";
const COLOURS = PALETTE_NAMES.map((value) => ({ value, label: cap(value) }));

const TOP = (c: HaloGraphConfig) => [
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "shadow", selector: { boolean: {} } }] },
  { type: "grid", name: "", schema: [
    { name: "period", selector: sel([
      { value: "day", label: "Today, with Tomorrow" }, { value: "last", label: "Last hours" }, { value: "next", label: "Next hours" }, { value: "around", label: "Hours around now" },
    ]) },
    ...((c.period ?? "day") === "day" ? [] : [{ name: "hours", selector: num({ min: 1, max: 168, step: 1, unit_of_measurement: "h" }) }]),
  ] },
  { name: "fit", selector: { boolean: {} } },
];

function seriesSchema(hass: HomeAssistant, s: SeriesConfig) {
  const src = sourceOf(hass, s);
  const style = s.style ?? (src === "history" || src === "statistics" ? "line" : "");
  return [
    { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "colour", selector: sel(COLOURS, true) }] },
    { name: "entities", selector: { entity: { multiple: true } } },
    { type: "grid", name: "", schema: [
      { name: "source", selector: sel([{ value: AUTO, label: "Automatic" }, { value: "history", label: "History" }, { value: "statistics", label: "Hourly statistics" },
        { value: "attribute", label: "List in attributes" }, { value: "energy_forecast", label: "Solar forecast (Energy)" }]) },
      { name: "style", selector: sel([{ value: AUTO, label: "Automatic" }, { value: "line", label: "Line" }, { value: "area", label: "Shaded area" }, { value: "bars", label: "Bars" }]) },
    ] },
    { type: "grid", name: "", schema: [{ name: "unit", selector: { text: {} } }, { name: "decimals", selector: num({ min: 0, max: 4, step: 1 }) }] },
    ...(src === "energy_forecast" ? [{ name: "forecast_entry", selector: { text: {} } }] : []),
    ...(style === "bars" && (src === "history" || src === "statistics") ? [{ name: "slot_minutes", selector: num({ min: 5, max: 1440, step: 5, unit_of_measurement: "min" }) }] : []),
    ...(src === "attribute" ? [{ type: "expandable", title: "List keys (only for lists without a preset)", schema: [
      { name: "attribute", selector: { text: {} } },
      { type: "grid", name: "", schema: [{ name: "start_key", selector: { text: {} } }, { name: "end_key", selector: { text: {} } }, { name: "value_key", selector: { text: {} } }] },
    ] }] : []),
  ];
}

const RULE = [{ type: "grid", name: "", schema: [
  { name: "above", selector: num() }, { name: "below", selector: num() }, { name: "colour", required: true, selector: sel(COLOURS, true) },
] }];

function figureSchema(names: { value: string; label: string }[], f: FigureConfig) {
  return [
    { type: "grid", name: "", schema: [{ name: "label", selector: { text: {} } }, { name: "series", selector: sel(names) }] },
    { type: "grid", name: "", schema: [
      { name: "calc", selector: sel([{ value: "now", label: "Now" }, { value: "next", label: "Next slot" }, { value: "lowest", label: "Lowest" }, { value: "highest", label: "Highest" },
        { value: "average", label: "Average" }, { value: "total", label: "Total" }, { value: "remaining", label: "Remaining (now to end)" }]) },
      { name: "window", selector: sel([{ value: "period", label: "The chart's period" }, { value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }, { value: "next", label: "Next hours" }]) },
    ] },
    ...(f.window === "next" ? [{ name: "hours", selector: num({ min: 1, max: 168, step: 1, unit_of_measurement: "h" }) }] : []),
    ...(f.calc === "total" || f.calc === "remaining" ? [{ name: "compare", selector: sel([{ value: NONE, label: "None" }, ...names]) }] : []),
    { type: "grid", name: "", schema: [{ name: "icon", selector: { icon: {} } }, { name: "icon_colour", selector: sel([{ value: NONE, label: "Text colour" }, ...COLOURS], true) }] },
    { type: "grid", name: "", schema: [{ name: "decimals", selector: num({ min: 0, max: 4, step: 1 }) }, { name: "note", selector: { boolean: {} } }] },
    { name: "entity", selector: { entity: {} } },
  ];
}

const LABELS: Record<string, string> = {
  name: "Name", shadow: "Drop shadow", period: "Period", hours: "Hours", fit: "Trim empty hours at either end",
  colour: "Colour", entities: "Entities", source: "Data from", style: "Draw as", unit: "Unit - optional", decimals: "Decimals - optional",
  forecast_entry: "Forecast entry - optional", slot_minutes: "Bar length", attribute: "Attribute", start_key: "Start key", end_key: "End key", value_key: "Value key",
  above: "Above", below: "Below", label: "Label", series: "Series", calc: "Show", window: "Over", compare: "As a percentage of",
  icon: "Icon - optional", icon_colour: "Icon colour", note: "Note underneath", entity: "Or an entity's state instead",
};
const HELPERS: Record<string, string> = {
  fit: "Leaves out the hours where everything is zero, such as night time for solar.",
  entities: "Several entities are joined end to end, such as Agile's today and tomorrow rates. Leave empty for the solar forecast.",
  source: "Automatic reads rate and forecast lists (Octopus, Nordpool, Solcast, Amber) from the entity, and history from anything else.",
  colour: "One of the colours, or type your own. Lines without one use the text colour.",
  forecast_entry: "The Forecast.Solar config entry id, if you have more than one array. Empty adds them all together.",
  compare: "Shows the figure as a share of the other series over the same time so far, such as generated against forecast.",
  entity: "Shows this entity's state as the figure; the settings above are then ignored.",
};

const clean = <T>(v: Record<string, unknown>, drop: (k: string, x: unknown) => boolean = () => false): T => {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === "" || x === undefined || x === null || x === AUTO || x === NONE || (Array.isArray(x) && !x.length) || drop(k, x)) continue;
    out[k] = x;
  }
  return out as T;
};
export const cleanSeries = (v: Record<string, unknown>) => clean<SeriesConfig>(v, (k) => k === "entity");
export const cleanFigure = (v: Record<string, unknown>) => clean<FigureConfig>(v, (k, x) => k === "note" && x === true);
export const cleanTop = (v: Record<string, unknown>) => clean<HaloGraphConfig>(v, (k, x) => (k === "shadow" && x === true) || (k === "fit" && x === false));

export class HaloGraphCardEditor extends LitElement {
  static override styles = css`
    h3 { margin: 20px 0 4px; font-size: 14px; font-weight: 500; }
    p.note { margin: 0 0 8px; font-size: 12px; color: var(--secondary-text-color); }
    .row { margin: 10px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .rule { margin: 6px 0 0; padding: 6px 10px; border: 1px dashed var(--divider-color); border-radius: 10px; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 6px; }
    .presets { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 12px; font-size: 13px; color: var(--secondary-text-color); }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { margin-top: 10px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .small { padding: 4px 8px; font-size: 12px; }
  `;
  @state() private _config?: HaloGraphConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloGraphConfig) { this._config = config; }

  private _emit(config: HaloGraphConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _series = () => this._config?.series ?? [];
  private _figures = () => this._config?.figures ?? [];
  private _setSeries(series: SeriesConfig[]) { this._emit({ ...this._config!, series }); }
  private _setFigures(figures: FigureConfig[]) { this._emit({ ...this._config!, figures }); }

  private _preset(p: Omit<HaloGraphConfig, "type">) {
    const { type, shadow } = this._config!;
    this._emit({ type, ...(shadow === false ? { shadow } : {}), ...p });
  }

  /** Up, Down and Remove for a row of a list. */
  private _moves<T>(list: T[], i: number, set: (l: T[]) => void) {
    const swap = (j: number) => { const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
    return html`<div class="bar">
      <button ?disabled=${i === 0} @click=${() => swap(i - 1)}>Up</button>
      <button ?disabled=${i === list.length - 1} @click=${() => swap(i + 1)}>Down</button>
      <button @click=${() => set(list.filter((_, j) => j !== i))}>Remove</button>
    </div>`;
  }

  private _rules(series: SeriesConfig[], i: number) {
    const s = series[i], rules = s.colour_rules ?? [];
    const set = (r: ColourRule[]) => this._setSeries(series.map((x, j) => (j === i ? cleanSeries({ ...x, colour_rules: r }) : x)));
    const label = (x: { name: string }) => LABELS[x.name] ?? x.name;
    return html`<p class="note">Bar colours: the first rule a value meets wins; others use the series colour.</p>
      ${rules.map((r, k) => html`<div class="rule"><ha-form .hass=${this.hass} .data=${r} .schema=${RULE} .computeLabel=${label}
        @value-changed=${(e: CustomEvent) => set(rules.map((x, j) => (j === k ? clean<ColourRule>(e.detail.value) : x)))}></ha-form>
        <div class="bar"><button class="small" @click=${() => set(rules.filter((_, j) => j !== k))}>Remove rule</button></div></div>`)}
      <button class="small" @click=${() => set([...rules, { below: 0, colour: "green" }])}>Add colour rule</button>`;
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config, hass = this.hass;
    const label = (x: { name: string }) => LABELS[x.name] ?? x.name;
    const helper = (x: { name: string }) => HELPERS[x.name];
    const series = this._series(), figures = this._figures();
    const names = series.map((s, i) => ({ value: s.name || String(i), label: s.name || `Series ${i + 1}` }));
    return html`
      <div class="presets">Start from:
        <button @click=${() => this._preset(solarPreset(hass))}>Solar forecast</button>
        <button @click=${() => this._preset(agilePreset(hass))}>Agile rates</button>
      </div>
      <ha-form .hass=${hass} .data=${{ period: "day", hours: 24, shadow: true, fit: false, ...c }} .schema=${TOP(c)} .computeLabel=${label} .computeHelper=${helper}
        @value-changed=${(e: CustomEvent) => this._emit(cleanTop({ ...e.detail.value, series, figures }))}></ha-form>

      <h3>Series</h3>
      <p class="note">Each one is a line, a shaded area or bars. Series with the same unit share an axis; a second unit gets a scale on the right.</p>
      ${series.map((s, i) => {
        const style = s.style ?? (sourceOf(hass, s) === "history" || sourceOf(hass, s) === "statistics" ? "line" : "");
        return html`<div class="row">
          <ha-form .hass=${hass} .data=${{ ...s, entities: entitiesOf(s), source: s.source ?? AUTO, style: s.style ?? AUTO }} .schema=${seriesSchema(hass, s)} .computeLabel=${label} .computeHelper=${helper}
            @value-changed=${(e: CustomEvent) => this._setSeries(series.map((x, j) => (j === i ? cleanSeries({ ...e.detail.value, colour_rules: x.colour_rules }) : x)))}></ha-form>
          ${style === "bars" || (!s.style && sourceOf(hass, s) === "attribute") ? this._rules(series, i) : nothing}
          ${this._moves(series, i, (l) => this._setSeries(l))}
        </div>`;
      })}
      <button class="add" @click=${() => this._setSeries([...series, {}])}>Add series</button>

      <h3>Figures</h3>
      <p class="note">Up to ${MAX_FIGURES} across the top, as many as fit.</p>
      ${figures.map((f, i) => html`<div class="row">
        <ha-form .hass=${hass} .data=${{ calc: "now", window: "period", note: true, ...f, series: f.series === undefined ? names[0]?.value : String(f.series), compare: f.compare ?? NONE, icon_colour: f.icon_colour ?? NONE }}
          .schema=${figureSchema(names, f)} .computeLabel=${label} .computeHelper=${helper}
          @value-changed=${(e: CustomEvent) => this._setFigures(figures.map((x, j) => (j === i ? cleanFigure({ ...e.detail.value, icon_svg: x.icon_svg }) : x)))}></ha-form>
        ${this._moves(figures, i, (l) => this._setFigures(l))}
      </div>`)}
      <button class="add" ?disabled=${figures.length >= MAX_FIGURES} @click=${() => this._setFigures([...figures, { calc: "now" }])}>Add figure</button>`;
  }
}
