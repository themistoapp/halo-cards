import type { HassEntity, HomeAssistant } from "../../shared/types";
import { isAvailable, unitOf } from "../../shared/util";

export interface EntityRow {
  entity: string;
  /** Show this attribute instead of the state (climate humidity, weather wind speed…). */
  attribute?: string;
  name?: string;
  icon?: string;
  /** Custom icon: <svg> markup, a 24×24 path, or a URL to an .svg file. Wins over `icon`. */
  icon_svg?: string;
  unit?: string;
  decimals?: number;
  colour?: string;
}
export interface HaloEntitiesConfig {
  type: string;
  /** Optional heading above the tiles. */
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  entities: (string | EntityRow)[];
}

export interface EntityTile {
  entity: string; name: string; value: string; unit: string; colour?: string; available: boolean;
  icon: string;
  /** Custom SVG source, drawn by <halo-svg-icon>. */
  svg?: string;
  /** No icon was chosen: Home Assistant's own state icon may be used where it exists. */
  stateIcon: boolean;
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
const DOMAIN_ICON: Record<string, string> = { climate: "mdi:thermostat", weather: "mdi:weather-partly-cloudy", light: "mdi:lightbulb", switch: "mdi:toggle-switch", binary_sensor: "mdi:checkbox-blank-circle-outline" };

export const rowsOf = (cfg: HaloEntitiesConfig): EntityRow[] =>
  (cfg.entities ?? []).map((r) => (typeof r === "string" ? { entity: r } : r)).filter((r) => r?.entity);

export const watchedEntities = (cfg: HaloEntitiesConfig) => rowsOf(cfg).map((r) => r.entity);

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

/** Numbers without thousands separators (1800 W, not 1,800 W); up to two decimals unless told otherwise. */
export function fmtValue(v: number, decimals: number | undefined, lang = "en-GB"): string {
  const d = decimals === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return v.toLocaleString(lang, { ...d, useGrouping: false });
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
export function readValue(hass: HomeAssistant, s: HassEntity | undefined, row: EntityRow): { value: string; unit: string; available: boolean } {
  const attr = row.attribute;
  const raw = !s ? undefined : attr ? s.attributes[attr] : isAvailable(s) ? s.state : undefined;
  if (!s || raw === undefined || raw === null || !isShown(raw)) return { value: "–", unit: "", available: !!s && isAvailable(s) };
  const n = toNumber(raw);
  if (n !== undefined) {
    const decimals = row.decimals ?? (attr ? undefined : hass.entities?.[s.entity_id]?.display_precision);
    return { value: fmtValue(n, decimals, hass.locale?.language), unit: row.unit ?? (attr ? attributeUnit(hass, s, attr) : unitOf(s)), available: true };
  }
  const text = typeof raw === "boolean" ? (raw ? "Yes" : "No")
    : attr ? hass.formatEntityAttributeValue?.(s, attr) ?? pretty(String(raw))
    : hass.formatEntityState?.(s) ?? pretty(s.state);
  return { value: text, unit: row.unit ?? "", available: true };
}

function iconFor(s: HassEntity | undefined, row: EntityRow): { icon: string; stateIcon: boolean } {
  if (row.icon) return { icon: row.icon, stateIcon: false };
  const domain = row.entity.split(".")[0];
  const byAttr = row.attribute ? ATTR_ICON.find(([re]) => re.test(row.attribute!))?.[1] : undefined;
  if (byAttr) return { icon: byAttr, stateIcon: false };
  const own = s?.attributes.icon as string | undefined;
  if (own) return { icon: own, stateIcon: false };
  return { icon: DEVICE_ICON[s?.attributes.device_class as string] ?? DOMAIN_ICON[domain] ?? "mdi:eye", stateIcon: true };
}

export function buildTiles(hass: HomeAssistant, cfg: HaloEntitiesConfig): EntityTile[] {
  return rowsOf(cfg).map((r) => {
    const s = hass.states[r.entity];
    const { value, unit, available } = readValue(hass, s, r);
    const name = r.name || (r.attribute
      ? (s && hass.formatEntityAttributeName?.(s, r.attribute)) || pretty(r.attribute)
      : (s?.attributes.friendly_name as string | undefined) || pretty(r.entity.split(".")[1] ?? r.entity));
    return { entity: r.entity, name, value, unit, colour: r.colour, available, svg: r.icon_svg?.trim() || undefined, ...iconFor(s, r) };
  });
}

/** The values an entity offers: its state, then every attribute that reads as a single value. "" is the state. */
export function valueOptions(hass: HomeAssistant, entityId: string, current?: string): { value: string; label: string }[] {
  const s = hass.states[entityId];
  if (!s) return current ? [{ value: current, label: pretty(current) }] : [];
  const show = (row: EntityRow) => { const v = readValue(hass, s, row); return v.value + (v.unit ? ` ${v.unit}` : ""); };
  const keys = Object.keys(s.attributes).filter((k) => !HIDDEN.has(k) && !k.endsWith("_unit") && isShown(s.attributes[k]));
  if (current && !keys.includes(current)) keys.push(current);
  return [
    { value: "", label: `State · ${show({ entity: entityId })}` },
    ...keys.map((k) => ({ value: k, label: `${hass.formatEntityAttributeName?.(s, k) ?? pretty(k)} · ${show({ entity: entityId, attribute: k })}` })),
  ];
}

/** Columns: one row of up to four tiles; more than four wrap onto further rows. */
export const columnsFor = (n: number) => Math.min(Math.max(n, 1), 4);

/** Sections-view rows: two per line of tiles, one more for a title. */
export const rowsFor = (n: number, titled: boolean) => 2 * Math.ceil(Math.max(n, 1) / 4) + (titled ? 1 : 0);
