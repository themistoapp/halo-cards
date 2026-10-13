import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant } from "../../shared/types";
import { LIBRARY, TRIGGER_IDS, type CustomGreeting } from "./greetings";
import { BIN_COLOURS, BOX_IDS, BOX_LABELS, DEFAULTS, boxesOf, type BinRow, type BoxId, type CalendarRow, type HaloTodayConfig, type VehicleRow } from "./logic";

const sel = (options: { value: string; label: string }[]) => ({ select: { mode: "dropdown", options } });
const num = (min: number, max: number, unit?: string, step = 1) => ({ number: { min, max, step, mode: "box", ...(unit ? { unit_of_measurement: unit } : {}) } });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOP = [
  { type: "grid", name: "", schema: [
    { name: "header", selector: sel([{ value: "greeting", label: "Greeting" }, { value: "date", label: "Big date" }, { value: "none", label: "None" }]) },
    { name: "greeting", selector: sel([{ value: "polite", label: "Polite" }, { value: "cheeky", label: "Cheeky" }, { value: "rude", label: "Rude" }]) },
  ] },
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "shadow", selector: { boolean: {} } }] },
  { type: "grid", name: "", schema: [{ name: "watershed", selector: { boolean: {} } }, { name: "watershed_from", selector: { time: {} } }] },
];
const CAL_TOP = [{ name: "calendar_days", selector: num(1, 31, "days") }];
const CAL_ROW = [
  { name: "entity", required: true, selector: { entity: { domain: "calendar" } } },
  { type: "grid", name: "", schema: [{ name: "name", selector: { text: {} } }, { name: "colour", selector: { text: {} } }] },
];
const WEATHER = [{ name: "weather", selector: { entity: { domain: "weather" } } }, { name: "weather_hours", selector: num(4, 12, "hours") }];
const BIN_TOP = [{ type: "grid", name: "", schema: [{ name: "bins_within", selector: num(12, 168, "hours") }, { name: "bins_out_from", selector: { time: {} } }] }];
const binRow = (r: BinRow) => [
  { type: "grid", name: "", schema: [
    { name: "name", required: true, selector: { text: {} } },
    { name: "colour", selector: sel(Object.keys(BIN_COLOURS).map((k) => ({ value: k, label: cap(k) }))) },
  ] },
  { name: "entity", required: true, selector: { entity: { domain: ["sensor", "calendar", "input_datetime"] } } },
  ...(r.entity?.startsWith("calendar.") ? [{ name: "match", selector: { text: {} } }] : []),
];
const VEH_TOP = [{ name: "low_below", selector: num(5, 95, "%") }];
const VEH_ROW = [
  { type: "grid", name: "", schema: [
    { name: "name", selector: { text: {} } },
    { name: "kind", selector: sel([{ value: "ice", label: "Petrol / diesel" }, { value: "ev", label: "Electric" }]) },
  ] },
  { name: "level", required: true, selector: { entity: { domain: "sensor" } } },
  { type: "grid", name: "", schema: [
    { name: "range", selector: { entity: { domain: "sensor" } } },
    { name: "charging", selector: { entity: { domain: ["binary_sensor", "sensor", "switch"] } } },
  ] },
  { type: "grid", name: "", schema: [
    { name: "image_preset", selector: sel([{ value: "none", label: "None" }, { value: "m140i", label: "BMW M140i" }, { value: "e-vivaro", label: "Vauxhall e-Vivaro" }]) },
    { name: "tank_size", selector: num(1, 500, "L") },
  ] },
  { name: "image", selector: { text: {} } },
];
const AGILE = [
  { name: "rates_today", selector: { entity: { domain: ["event", "sensor"] } } },
  { name: "rates_tomorrow", selector: { entity: { domain: ["event", "sensor"] } } },
  { type: "grid", name: "", schema: [{ name: "agile_slots", selector: num(1, 6) }, { name: "peak_above", selector: num(0, 100, "p") }] },
];
const MEDIA = [{ name: "media", selector: { entity: { domain: "media_player", multiple: true } } }];
const GREET_ROW = [
  { type: "grid", name: "", schema: [
    { name: "trigger", required: true, selector: sel(TRIGGER_IDS.map((value) => ({ value, label: LIBRARY[value].when }))) },
    { name: "tone", selector: sel([{ value: "any", label: "Any tone" }, { value: "polite", label: "Polite" }, { value: "cheeky", label: "Cheeky" }, { value: "rude", label: "Rude" }]) },
  ] },
  { name: "text", required: true, selector: { text: {} } },
];

const LABELS: Record<string, string> = {
  header: "Title", greeting: "Greeting tone", name: "Your name", shadow: "Drop shadow", watershed: "Rude only after the watershed", watershed_from: "Watershed",
  calendar_days: "Look ahead", entity: "Entity", colour: "Colour", weather: "Weather entity", weather_hours: "Hours shown",
  bins_within: "Show bins this long before collection", bins_out_from: "Put-out reminder from (the day before)", match: "Event title contains",
  low_below: "Show a vehicle below", kind: "Type", level: "Fuel or battery level", range: "Range", charging: "Charging (EV, hides it while charging)",
  image_preset: "Picture", tank_size: "Tank size (if the level is in litres)", image: "Your own picture (URL)",
  rates_today: "Today's rates", rates_tomorrow: "Tomorrow's rates", agile_slots: "Cheapest slots listed", peak_above: "Peak price from (for greetings)",
  media: "Speakers to watch", trigger: "When", tone: "Tone", text: "Your line",
};
const HELPERS: Record<string, string> = {
  name: "Used in some greetings. Leave empty to use the name of whoever is signed in.",
  watershed: "With Rude chosen, greetings are Cheeky from 06:00 until the watershed.",
  colour: "Hex, e.g. #e0568a. Leave empty for the next colour in the set.",
  entity: "A sensor whose state or attributes give the next date (UK Bin Collection Data and Waste Collection Schedule both work), or a bin calendar.",
  match: "Words in this bin's events, e.g. recycl. Defaults to the bin's name.",
  level: "Shown only when below the level above, and not while charging.",
  rates_today: "The Octopus Energy integration's Current Day Rates entity.",
  rates_tomorrow: "Next Day Rates, so evenings can list tonight's cheap slots.",
  media: "Now playing appears while one of these plays, at the top. If several play, the one that started last.",
  text: "Placeholders: {name}, {bin}, {time}, {temp}, {event}, {mins}, {who}, {car}, {pct}, {cheap}, {artist}, {track}, {n}.",
};
const label = (s: { name: string }) => LABELS[s.name] ?? s.name;
const helper = (s: { name: string }) => HELPERS[s.name];

/** Drops empty fields so the YAML stays tidy. */
function clean<T extends object>(v: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (x !== "" && x !== undefined && x !== null && !(Array.isArray(x) && !x.length && k !== "boxes")) out[k] = x;
  return out as T;
}

export class HaloTodayCardEditor extends LitElement {
  static override styles = css`
    details { margin: 10px 0 0; border: 1px solid var(--divider-color); border-radius: 12px; padding: 0 12px; }
    details[open] { padding-bottom: 12px; }
    summary { cursor: pointer; padding: 12px 0; font-weight: 500; list-style: none; display: flex; justify-content: space-between; gap: 8px; }
    summary::-webkit-details-marker { display: none; }
    summary span { color: var(--secondary-text-color); font-weight: 400; font-size: 13px; }
    summary::after { content: "▾"; color: var(--secondary-text-color); }
    details[open] summary::after { content: "▴"; }
    p.note { margin: 0 0 10px; font-size: 13px; color: var(--secondary-text-color); }
    .row { margin: 10px 0 0; padding: 12px; border: 1px solid var(--divider-color); border-radius: 12px; }
    .bar { display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 10px; background: var(--secondary-background-color); color: var(--primary-text-color); }
    button:disabled { opacity: .4; cursor: default; }
    .add { margin-top: 10px; background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .bxrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--divider-color); }
    .bxrow:first-of-type { border-top: 0; }
    .bxrow label { flex: 1; display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .bxrow input { width: 18px; height: 18px; accent-color: var(--primary-color); }
    .bxrow.off label { color: var(--secondary-text-color); }
  `;
  @state() private _config?: HaloTodayConfig;
  hass?: HomeAssistant;
  setConfig(config: HaloTodayConfig) { this._config = config; }

  private _emit(config: HaloTodayConfig) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  private _set(patch: Partial<HaloTodayConfig>) { this._emit(clean({ ...this._config!, ...patch })); }

  private _form(schema: unknown[], data: Record<string, unknown>, onChange: (v: Record<string, unknown>) => void) {
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${schema} .computeLabel=${label} .computeHelper=${helper}
      @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}></ha-form>`;
  }

  /** A list of rows, each its own form, with Up, Down and Remove. */
  private _list<T extends object>(key: keyof HaloTodayConfig, rows: T[], schema: (r: T) => unknown[], blank: T, add: string, defaults: Partial<T> = {}) {
    const put = (next: T[]) => this._set({ [key]: next } as Partial<HaloTodayConfig>);
    return html`${rows.map((r, i) => html`<div class="row">
        ${this._form(schema(r), { ...defaults, ...r }, (v) => put(rows.map((x, j) => (j === i ? clean(v as T) : x))))}
        <div class="bar">
          <button ?disabled=${i === 0} @click=${() => { const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; put(n); }}>Up</button>
          <button ?disabled=${i === rows.length - 1} @click=${() => { const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; put(n); }}>Down</button>
          <button @click=${() => put(rows.filter((_, j) => j !== i))}>Remove</button>
        </div></div>`)}
      <button class="add" @click=${() => put([...rows, blank])}>${add}</button>`;
  }

  /** Which boxes, and their order: ticked ones first, in order; the rest underneath. */
  private _boxes() {
    const on = boxesOf(this._config!);
    const all = [...on, ...BOX_IDS.filter((b) => !on.includes(b))];
    const put = (list: BoxId[]) => this._set({ boxes: list });
    return html`${all.map((b) => {
      const enabled = on.includes(b), j = on.indexOf(b);
      return html`<div class="bxrow ${enabled ? "" : "off"}">
        <label><input type="checkbox" .checked=${enabled} @change=${(e: Event) => put((e.target as HTMLInputElement).checked ? [...on, b] : on.filter((x) => x !== b))} />${BOX_LABELS[b]}</label>
        <button ?disabled=${!enabled || j === 0} @click=${() => { const n = [...on]; [n[j - 1], n[j]] = [n[j], n[j - 1]]; put(n); }}>Up</button>
        <button ?disabled=${!enabled || j === on.length - 1} @click=${() => { const n = [...on]; [n[j + 1], n[j]] = [n[j], n[j + 1]]; put(n); }}>Down</button>
      </div>`;
    })}`;
  }

  override render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config;
    // Unfiltered, so a just-added calendar with no entity yet still shows.
    const cals = (c.calendars ?? []).map((x) => (typeof x === "string" ? { entity: x } : x)) as CalendarRow[];
    const pick = <K extends keyof HaloTodayConfig>(...keys: K[]) => Object.fromEntries(keys.map((k) => [k, c[k]]));
    const count = (n: number, one: string) => (n ? `${n} ${one}${n === 1 ? "" : "s"}` : "none");
    return html`
      ${this._form(TOP, { header: "greeting", greeting: "cheeky", shadow: true, watershed_from: DEFAULTS.watershed_from, ...pick("header", "greeting", "name", "shadow", "watershed", "watershed_from") }, (v) => this._set(v))}

      <details open><summary>Boxes<span>${boxesOf(c).length} shown</span></summary>
        <p class="note">Boxes sort themselves: happening now first, then anything to do, then soon, then the rest. Within each, this order wins. Untick a box to leave it out.</p>
        ${this._boxes()}
      </details>

      <details><summary>Calendars<span>${count(cals.length, "calendar")}</span></summary>
        <p class="note">Your next two events. Any calendar in Home Assistant works: Google, CalDAV (iCloud, Fastmail, Nextcloud), Remote Calendar (an .ics link, e.g. from Outlook) or Local Calendar.</p>
        ${this._form(CAL_TOP, { calendar_days: DEFAULTS.calendar_days, ...pick("calendar_days") }, (v) => this._set(v))}
        ${this._list<CalendarRow>("calendars", cals, () => CAL_ROW, { entity: "" }, "Add calendar")}
      </details>

      <details><summary>Weather<span>${c.weather ?? "none"}</span></summary>
        ${this._form(WEATHER, { weather_hours: DEFAULTS.weather_hours, ...pick("weather", "weather_hours") }, (v) => this._set(v))}
      </details>

      <details><summary>Bins<span>${count(c.bins?.length ?? 0, "bin")}</span></summary>
        <p class="note">Shown only when a collection is close. From the reminder time the day before, the bins going out are marked "Out tonight".</p>
        ${this._form(BIN_TOP, { bins_within: DEFAULTS.bins_within, bins_out_from: DEFAULTS.bins_out_from, ...pick("bins_within", "bins_out_from") }, (v) => this._set(v))}
        ${this._list<BinRow>("bins", c.bins ?? [], binRow, { name: "", entity: "", colour: "black" }, "Add bin", { colour: "grey" })}
      </details>

      <details><summary>Vehicles<span>${count(c.vehicles?.length ?? 0, "vehicle")}</span></summary>
        <p class="note">A vehicle appears only when its fuel or battery is low.</p>
        ${this._form(VEH_TOP, { low_below: DEFAULTS.low_below, ...pick("low_below") }, (v) => this._set(v))}
        ${this._list<VehicleRow>("vehicles", c.vehicles ?? [], () => VEH_ROW, { level: "" }, "Add vehicle", { kind: "ice", image_preset: "none" })}
      </details>

      <details><summary>Cheapest Agile slots<span>${c.rates_today ? "on" : "none"}</span></summary>
        ${this._form(AGILE, { agile_slots: DEFAULTS.agile_slots, peak_above: DEFAULTS.peak_above, ...pick("rates_today", "rates_tomorrow", "agile_slots", "peak_above") }, (v) => this._set(v))}
      </details>

      <details><summary>Now playing<span>${count(c.media?.length ?? 0, "speaker")}</span></summary>
        ${this._form(MEDIA, pick("media"), (v) => this._set(v))}
      </details>

      <details><summary>Your own greetings<span>${count(c.greetings?.length ?? 0, "line")}</span></summary>
        <p class="note">Add lines to any situation. They join the built-in ones for that situation.</p>
        ${this._list<CustomGreeting>("greetings", c.greetings ?? [], () => GREET_ROW, { trigger: "morning", tone: "any", text: "" }, "Add a line", { tone: "any" })}
      </details>`;
  }
}
