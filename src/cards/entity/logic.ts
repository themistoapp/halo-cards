import type { ActionSet } from "../../shared/actions";
import { GRADIENTS } from "../../shared/looks";
import { chartColour } from "../../shared/tile";
import { fmtNum } from "../../shared/format";
import type { GraphScale } from "../../shared/history";
import type { HassEntity, HomeAssistant } from "../../shared/types";
import { canToggle, isAvailable, isOn, unitOf } from "../../shared/util";

/** A colour by value: the first rule that matches recolours the icon and the graph. */
export interface ColourRule { above?: number; below?: number; colour: string }

export interface HaloEntityConfig extends ActionSet {
  type: string;
  entity: string;
  /** Show this attribute instead of the state (climate humidity, weather wind speed…). */
  attribute?: string;
  name?: string;
  icon?: string;
  /** Custom icon: <svg> markup, a 24×24 path, or a URL to an .svg file. Wins over `icon`. */
  icon_svg?: string;
  /** Show the icon (default on). */
  show_icon?: boolean;
  /** Palette name (grey, red, orange, yellow, green, teal, blue, purple, pink) or any CSS colour. */
  icon_colour?: string;
  /** On/off entities: the disc behind the icon while on, a palette name or any CSS colour (default orange); none for no highlight. */
  on_colour?: string;
  unit?: string;
  decimals?: number;
  /** Tile look: plain (the card surface, default), light (black on white), dark (white on black) or a gradient preset. */
  theme?: Theme;
  /** Starting size in a sections view: small is 3 × 2, large 6 × 3. Resizing the card works too. */
  size?: "small" | "large";
  /** What sits below the figure: a history graph, a gauge, or nothing. Without it, `graph: true` means a graph. */
  display?: Display;
  /** History graph along the bottom (large tiles only). Older configs; `display` wins. */
  graph?: boolean;
  graph_colour?: string;
  /** 1 to 168 hours (default 24). Over 24 hours uses hourly statistics. */
  graph_hours?: number;
  /** zero or range; chosen from the sensor if not set. */
  graph_scale?: "zero" | "range";
  graph_min?: number;
  graph_max?: number;
  gauge_style?: GaugeStyle;
  /** The gauge's ends. Unset: 0 to 100 for percentages, a number entity's own min and max, otherwise 0 to 100. */
  gauge_min?: number;
  gauge_max?: number;
  /** Palette name or any CSS colour (default: the icon colour). */
  gauge_colour?: string;
  /** Min and max under the line and semicircle (default on). */
  gauge_labels?: boolean;
  /** Faint colour-rule bands on the gauge's track (default off). */
  gauge_bands?: boolean;
  colour_rules?: ColourRule[];
  /** Line below the value: your own text, or a second entity (wins if both are set). */
  secondary_text?: string;
  secondary_entity?: string;
  secondary_attribute?: string;
  secondary_name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
}

/** Where a value is read from: an entity's state, or one of its attributes. */
interface ValueSource { entity: string; attribute?: string; unit?: string; decimals?: number }

export type Display = "graph" | "gauge" | "none";
export type GaugeStyle = "ring" | "line" | "semicircle";
const GAUGE_STYLES: GaugeStyle[] = ["ring", "line", "semicircle"];

export { GRADIENTS };
export type Theme = "plain" | "light" | "dark" | (typeof GRADIENTS)[number];
export const THEME_LABELS: Record<Theme, string> = {
  plain: "Plain", light: "Black on white", dark: "White on black",
  dusk: "Dusk", slate: "Slate", ember: "Ember", solar: "Solar", battery: "Battery", grid: "Grid", ocean: "Ocean", glacier: "Glacier",
  aurora: "Aurora", forest: "Forest", rose: "Rose", plum: "Plum", sunset: "Sunset", sand: "Sand", graphite: "Graphite",
};
const isTheme = (t: unknown): t is Theme => typeof t === "string" && t in THEME_LABELS;
export const isGradient = (t: Theme) => t !== "plain" && t !== "light" && t !== "dark";

export interface EntityTile {
  entity: string; name: string; value: string; unit: string; available: boolean;
  /** The reading as a number, when it is one (for colour rules and the graph). */
  num?: number;
  icon: string;
  /** Custom SVG source, drawn by <halo-svg-icon>. */
  svg?: string;
  /** No icon was chosen: Home Assistant's own state icon may be used where it exists. */
  stateIcon: boolean;
  theme: Theme;
  showIcon: boolean;
  iconColour?: string;
  /** On/off entities: true or false (unset for anything else, an attribute, or while unavailable). */
  on?: boolean;
  /** Set while on: the disc behind the icon, which turns white. */
  onFill?: string;
  graphColour?: string;
  /** The line below: a second entity's name and value, or plain text. */
  secondary?: { name?: string; value: string; unit: string } | { text: string };
  /** Set when a graph is wanted and possible: the state (not an attribute) and a number. */
  graph?: { hours: number; scale: GraphScale; min?: number; max?: number; statistics: boolean };
  /** Set when a gauge is wanted and the reading is a number (state or attribute). */
  gauge?: Gauge;
}

/** A gauge: where the reading sits between min and max (0 to 1), its colour, and the colour-rule bands along the track. */
export interface Gauge {
  style: GaugeStyle; min: number; max: number; frac: number; colour?: string; labels: boolean;
  bands: { from: number; to: number; colour: string }[];
}

/** Attributes that are plumbing, not readings: never offered as a value. */
const HIDDEN = new Set(["friendly_name", "icon", "entity_picture", "unit_of_measurement", "device_class", "state_class", "supported_features", "supported_color_modes",
  "attribution", "restored", "editable", "id", "assumed_state", "options", "min", "max", "step", "mode", "entity_id", "hvac_modes", "preset_modes", "fan_modes",
  "swing_modes", "effect_list", "source_list", "sound_mode_list", "min_temp", "max_temp", "target_temp_step", "min_mireds", "max_mireds", "min_color_temp_kelvin",
  "max_color_temp_kelvin", "last_reset", "precipitation_unit", "visibility_unit", "media_position_updated_at"]);

const DEVICE_ICON: Record<string, string> = {
  temperature: "mdi:thermometer", humidity: "mdi:water-percent", power: "mdi:flash", energy: "mdi:lightning-bolt", battery: "mdi:battery",
  illuminance: "mdi:brightness-5", pressure: "mdi:gauge", carbon_dioxide: "mdi:molecule-co2", monetary: "mdi:cash", wind_speed: "mdi:weather-windy",
};
const ATTR_ICON: [RegExp, string][] = [
  [/temp|dew_point/, "mdi:thermometer"], [/humid/, "mdi:water-percent"], [/battery/, "mdi:battery"], [/wind/, "mdi:weather-windy"],
  [/pressure/, "mdi:gauge"], [/volume/, "mdi:volume-high"], [/brightness/, "mdi:brightness-6"], [/uv/, "mdi:sun-wireless"],
];
/** Domains whose state is on or off. */
const ON_OFF = new Set(["light", "switch", "input_boolean", "binary_sensor", "fan", "siren", "humidifier", "automation", "remote"]);
/** The entity's state is on or off (not one of its attributes). */
export const isOnOff = (entity: string | undefined, attribute?: string) => !!entity && !attribute && ON_OFF.has(entity.split(".")[0]);
/** Tap toggles an on/off entity that can be toggled; anything else opens more-info. */
export const tapDefault = (cfg: HaloEntityConfig) => (isOnOff(cfg.entity, cfg.attribute) && canToggle(cfg.entity) ? "toggle" : "more-info");

const DOMAIN_ICON: Record<string, string> = { climate: "mdi:thermostat", weather: "mdi:weather-partly-cloudy", light: "mdi:lightbulb", switch: "mdi:toggle-switch", binary_sensor: "mdi:checkbox-blank-circle-outline" };

/** "current_temperature" -> "Current temperature". */
export function pretty(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const isShown = (v: unknown) => typeof v === "number" || typeof v === "string" || typeof v === "boolean";

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Units for attributes, which carry none of their own: weather's *_unit attributes, then the obvious ones. */
export function attributeUnit(hass: HomeAssistant, s: HassEntity, attr: string): string {
  const own = s.attributes[`${attr}_unit`];
  if (typeof own === "string") return own;
  if (/temp|dew_point/.test(attr)) return (s.attributes.temperature_unit as string | undefined) ?? hass.config?.unit_system?.temperature ?? "";
  if (/humid|battery|percentage/.test(attr)) return "%";
  return "";
}

/** The value and unit a tile shows. */
export function readValue(hass: HomeAssistant, s: HassEntity | undefined, row: ValueSource): { value: string; unit: string; available: boolean; num?: number } {
  const attr = row.attribute;
  const raw = !s ? undefined : attr ? s.attributes[attr] : isAvailable(s) ? s.state : undefined;
  if (!s || raw === undefined || raw === null || !isShown(raw)) return { value: "–", unit: "", available: !!s && isAvailable(s) };
  const n = toNumber(raw);
  if (n !== undefined) {
    const decimals = row.decimals ?? (attr ? undefined : hass.entities?.[s.entity_id]?.display_precision);
    // Numbers without thousands separators (1800 W, not 1,800 W); up to two decimals unless told otherwise.
    return { value: fmtNum(n, decimals), unit: row.unit ?? (attr ? attributeUnit(hass, s, attr) : unitOf(s)), available: true, num: n };
  }
  const text = typeof raw === "boolean" ? (raw ? "Yes" : "No")
    : attr ? hass.formatEntityAttributeValue?.(s, attr) ?? pretty(String(raw))
    : hass.formatEntityState?.(s) ?? pretty(s.state);
  return { value: text, unit: row.unit ?? "", available: true };
}

function iconFor(s: HassEntity | undefined, row: HaloEntityConfig): { icon: string; stateIcon: boolean } {
  if (row.icon) return { icon: row.icon, stateIcon: false };
  const domain = row.entity.split(".")[0];
  const byAttr = row.attribute ? ATTR_ICON.find(([re]) => re.test(row.attribute!))?.[1] : undefined;
  if (byAttr) return { icon: byAttr, stateIcon: false };
  const own = s?.attributes.icon as string | undefined;
  if (own) return { icon: own, stateIcon: false };
  return { icon: DEVICE_ICON[s?.attributes.device_class as string] ?? DOMAIN_ICON[domain] ?? "mdi:eye", stateIcon: true };
}

export function buildTile(hass: HomeAssistant, cfg: HaloEntityConfig): EntityTile {
  const s = hass.states[cfg.entity];
  const { value, unit, available, num } = readValue(hass, s, cfg);
  const name = cfg.name || (cfg.attribute
    ? (s && hass.formatEntityAttributeName?.(s, cfg.attribute)) || pretty(cfg.attribute)
    : (s?.attributes.friendly_name as string | undefined) || pretty(cfg.entity.split(".")[1] ?? cfg.entity));
  const rule = num === undefined ? undefined : matchRule(cfg.colour_rules, num);
  const hours = graphHours(cfg.graph_hours);
  const display = displayOf(cfg);
  const on = isOnOff(cfg.entity, cfg.attribute) && isAvailable(s) ? isOn(s) : undefined;
  const onFill = on && cfg.on_colour?.trim().toLowerCase() !== "none" ? chartColour(cfg.on_colour ?? "orange", false) : undefined;
  return {
    entity: cfg.entity, name, value, unit, available, num, svg: cfg.icon_svg?.trim() || undefined, ...iconFor(s, cfg),
    theme: isTheme(cfg.theme) ? cfg.theme : "plain", showIcon: cfg.show_icon !== false, secondary: secondaryOf(hass, cfg),
    on, onFill, iconColour: rule ?? cfg.icon_colour, graphColour: rule ?? cfg.graph_colour,
    gauge: display === "gauge" && num !== undefined ? gaugeOf(cfg, s, unit, num, rule ?? cfg.gauge_colour ?? cfg.icon_colour) : undefined,
    graph: display === "graph" && !cfg.attribute && s && num !== undefined
      ? { hours, scale: cfg.graph_scale ?? defaultScale(s, unit), min: cfg.graph_min, max: cfg.graph_max, statistics: hours > 24 && !!s.attributes.state_class }
      : undefined,
  };
}

export const displayOf = (cfg: HaloEntityConfig): Display =>
  cfg.display === "graph" || cfg.display === "gauge" || cfg.display === "none" ? cfg.display : cfg.graph ? "graph" : "none";

const finite = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** The gauge's ends: yours, else the entity's own range (percentages 0 to 100, a number entity's min and max), else 0 to 100. */
export function gaugeRange(cfg: HaloEntityConfig, s: HassEntity | undefined, unit: string): [number, number] {
  const own: [number, number] | undefined = unit === "%" ? [0, 100]
    : !cfg.attribute && s && finite(s.attributes.min) !== undefined && finite(s.attributes.max) !== undefined ? [s.attributes.min as number, s.attributes.max as number] : undefined;
  const lo = finite(cfg.gauge_min) ?? own?.[0] ?? 0;
  const hi = finite(cfg.gauge_max) ?? own?.[1] ?? 100;
  return [lo, hi];
}

function gaugeOf(cfg: HaloEntityConfig, s: HassEntity | undefined, unit: string, num: number, colour: string | undefined): Gauge {
  const [min, max] = gaugeRange(cfg, s, unit);
  const frac = max > min ? Math.min(Math.max((num - min) / (max - min), 0), 1) : 0;
  return {
    style: GAUGE_STYLES.includes(cfg.gauge_style as GaugeStyle) ? cfg.gauge_style! : "ring", min, max, frac, colour, labels: cfg.gauge_labels !== false,
    bands: cfg.gauge_bands ? gaugeBands(cfg.colour_rules, cfg.gauge_colour ?? cfg.icon_colour, min, max) : [],
  };
}

/** Stretches of the track (0 to 1) by the colour each part of the range would get from the rules. Parts no rule covers take the base colour, or none. */
export function gaugeBands(rules: ColourRule[] | undefined, base: string | undefined, min: number, max: number): Gauge["bands"] {
  if (!rules?.length || !(max > min)) return [];
  const cuts = [...new Set([min, max, ...rules.flatMap((r) => [r.above, r.below]).filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > min && x < max)])].sort((a, b) => a - b);
  const out: Gauge["bands"] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const colour = matchRule(rules, (cuts[i] + cuts[i + 1]) / 2) ?? base;
    if (!colour) continue;
    const from = (cuts[i] - min) / (max - min), to = (cuts[i + 1] - min) / (max - min);
    const last = out[out.length - 1];
    if (last && last.colour === colour && last.to === from) last.to = to; else out.push({ from, to, colour });
  }
  return out;
}

function secondaryOf(hass: HomeAssistant, cfg: HaloEntityConfig): EntityTile["secondary"] {
  if (cfg.secondary_entity) {
    const s = hass.states[cfg.secondary_entity];
    const { value, unit } = readValue(hass, s, { entity: cfg.secondary_entity, attribute: cfg.secondary_attribute });
    const name = cfg.secondary_name ?? (cfg.secondary_attribute
      ? (s && hass.formatEntityAttributeName?.(s, cfg.secondary_attribute)) || pretty(cfg.secondary_attribute)
      : (s?.attributes.friendly_name as string | undefined) || pretty(cfg.secondary_entity.split(".")[1] ?? cfg.secondary_entity));
    return { name: name || undefined, value, unit };
  }
  const text = cfg.secondary_text?.trim();
  return text ? { text } : undefined;
}

/** The first rule the value meets: above, below, or between when both are set. */
export function matchRule(rules: ColourRule[] | undefined, v: number): string | undefined {
  for (const r of rules ?? []) {
    if (!r?.colour || (r.above === undefined && r.below === undefined)) continue;
    if ((r.above === undefined || v > r.above) && (r.below === undefined || v < r.below)) return r.colour;
  }
  return undefined;
}

export const graphHours = (h?: number) => Math.min(Math.max(Math.round(Number(h) || 24), 1), 168);

/** Things measured from zero (power, energy, money) start at zero; percentages run 0 to 100; anything else fits its own range. */
const ZERO = new Set(["power", "energy", "monetary", "gas", "water", "current", "apparent_power", "reactive_power", "precipitation", "precipitation_intensity", "irradiance", "energy_storage", "volume", "volume_storage", "data_rate", "data_size"]);
const ZERO_UNIT = /^([kMG]?(W|Wh|VA|A)|[£$€¥]|L|m³|gal)$/;
export function defaultScale(s: HassEntity, unit: string): GraphScale {
  if (unit === "%") return "percent";
  return ZERO.has(s.attributes.device_class as string) || ZERO_UNIT.test(unit) ? "zero" : "range";
}

/** Entities the card reads, so it only re-renders when one of them changes. */
export const watchedEntities = (cfg: HaloEntityConfig) => [cfg.entity, cfg.secondary_entity].filter((x): x is string => !!x);

/** The values an entity offers: its state, then every attribute that reads as a single value. "" is the state. */
export function valueOptions(hass: HomeAssistant, entityId: string, current?: string): { value: string; label: string }[] {
  const s = hass.states[entityId];
  if (!s) return current ? [{ value: current, label: pretty(current) }] : [];
  const show = (row: ValueSource) => { const v = readValue(hass, s, row); return v.value + (v.unit ? ` ${v.unit}` : ""); };
  const keys = Object.keys(s.attributes).filter((k) => !HIDDEN.has(k) && !k.endsWith("_unit") && isShown(s.attributes[k]));
  if (current && !keys.includes(current)) keys.push(current);
  return [
    { value: "", label: `State · ${show({ entity: entityId })}` },
    ...keys.map((k) => ({ value: k, label: `${hass.formatEntityAttributeName?.(s, k) ?? pretty(k)} · ${show({ entity: entityId, attribute: k })}` })),
  ];
}
