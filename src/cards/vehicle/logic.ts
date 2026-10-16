import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable, numState, prettyPlace, unitOf } from "../../shared/util";
import { clock, fmtDate, fmtNum } from "../../shared/format";

export interface HaloVehicleConfig {
  type: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  fuel_type?: "ice" | "ev";
  /** Picture: a built-in render, or your own URL in `image`. */
  image_preset?: "none" | "m140i" | "e-vivaro";
  image?: string;
  /** Vehicle colour (hex) the card's background is built from. */
  colour?: string;
  level?: string;
  range?: string;
  odometer?: string;
  lock?: string;
  charging?: string;
  location?: string;
  /** Optional text entity with the street or place (a geocoded location sensor): shown in the chip while away from every zone. */
  address?: string;
  /** Tank size in litres (or gallons) when the fuel sensor reports an absolute amount instead of a percentage. */
  tank_size?: number;
  low_level?: number;
  critical_level?: number;
}

export interface Stat { label: string; value: string; unit: string; tone?: "warn" | "bad"; entity?: string }
export interface VehicleModel {
  name: string;
  kind: "ice" | "ev";
  chip?: string;
  /** The entity the chip opens (the tracker). */
  chipEntity?: string;
  /** The level entity, opened from the bar. */
  levelEntity?: string;
  /** 0-100 for the bar, or undefined to hide it. */
  pct?: number;
  stats: Stat[];
  status?: { kind: "locked" | "unlocked" | "charging" | "idle"; label: string; entity: string };
  charging: boolean;
  tone?: "warn" | "bad";
  /** Background bloom size 0-1.2. */
  k: number;
}

export function isCharging(s?: HassEntity): boolean {
  if (!s || !isAvailable(s)) return false;
  const v = s.state.toLowerCase();
  return ["on", "true", "charging", "charge", "fast_charging"].includes(v);
}

/** Lock from a lock entity, a lock binary_sensor (on = unlocked) or a text sensor ("LOCKED", "SECURED", ...). */
export function lockState(s: HassEntity): "locked" | "unlocked" {
  const v = s.state.toLowerCase();
  if (s.entity_id.startsWith("binary_sensor.")) return v === "on" ? "unlocked" : "locked";
  return v === "locked" || v === "secured" || v === "locking" ? "locked" : "unlocked";
}

/** Level as a percentage: a % sensor as is, an absolute amount against the tank size. */
export function levelPercent(value: number, unit: string, tank?: number): number | undefined {
  if (unit === "%" || unit === "") return value <= 100 ? clamp(value, 0, 100) : undefined;
  if (tank && tank > 0) return clamp((value / tank) * 100, 0, 100);
  return undefined;
}

export function placeName(hass: HomeAssistant, e?: HassEntity): string | undefined {
  if (!isAvailable(e)) return undefined;
  const zone = hass.states[`zone.${e.state}`];
  if (zone?.attributes.friendly_name) return String(zone.attributes.friendly_name);
  return prettyPlace(e.state);
}

const DAY_MS = 86_400_000;
/** since 14:05 today, since Mon this week, since 12 Oct before that. */
function since(ms: number, now: number): string {
  const d = new Date(ms), start = new Date(now); start.setHours(0, 0, 0, 0);
  if (ms >= start.getTime()) return `since ${clock(ms)}`;
  return `since ${fmtDate(d, now - ms < 6 * DAY_MS ? { weekday: "short" } : { day: "numeric", month: "short" })}`;
}

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The street alone: a street attribute (the mobile app's geocoded sensor has Thoroughfare), else the address's first part without the house number. */
export function street(e?: HassEntity, useState = true): string | undefined {
  if (!isAvailable(e)) return undefined;
  const at = e.attributes;
  for (const k of ["thoroughfare", "Thoroughfare", "street", "road", "Street", "Road"]) if (typeof at[k] === "string" && at[k].trim()) return at[k].trim();
  const full = typeof at.address === "string" ? at.address : useState ? e.state : "";
  const first = full.split(",")[0].trim();
  // "12 High Street", "12a High Street", "Flat 3, ..." keeps the words.
  const s = first.replace(/^\d+[a-z]?(-\d+[a-z]?)?\s+/i, "").trim();
  return s || undefined;
}

/** The chip: the zone and since when; away, the address, the distance from home, or since when. */
export function placeDetail(hass: HomeAssistant, cfg: HaloVehicleConfig, now = Date.now()): string | undefined {
  const e = cfg.location ? hass.states[cfg.location] : undefined;
  if (!isAvailable(e)) return undefined;
  const name = placeName(hass, e)!;
  const changed = Date.parse(e.last_changed);
  const when = Number.isFinite(changed) ? ` · ${since(changed, now)}` : "";
  // A text sensor (an address already) is shown as it is.
  if (!e.entity_id.startsWith("device_tracker.")) return name;
  if (e.state !== "not_home") return `${name}${when}`;
  const st = street(cfg.address ? hass.states[cfg.address] : undefined) ?? street(e, false);
  if (st) return st;
  const home = hass.states["zone.home"], lat = Number(e.attributes.latitude), lon = Number(e.attributes.longitude);
  const hl = Number(home?.attributes.latitude), hn = Number(home?.attributes.longitude);
  if ([lat, lon, hl, hn].every(Number.isFinite) && home) {
    // Miles or km as the range and odometer give them, else Home Assistant's unit system.
    const u = [cfg.range, cfg.odometer].map((id) => unitOf(id ? hass.states[id] : undefined).toLowerCase()).find((x) => x === "mi" || x === "km")
      ?? (hass.config?.unit_system?.length === "mi" ? "mi" : "km");
    const km = distanceKm(lat, lon, hl, hn), v = u === "mi" ? km / 1.609344 : km;
    return `${fmtNum(v, v < 10 ? 1 : 0)} ${u} from ${home.attributes.friendly_name ?? "home"}`;
  }
  return `${name}${when}`;
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? fmtNum(Math.round(v), 0, { group: true }) : fmtNum(v, undefined, { max: Math.abs(v) < 100 ? 1 : 0 }));

export function buildVehicle(hass: HomeAssistant, cfg: HaloVehicleConfig): VehicleModel {
  const st = (id?: string) => (id ? hass.states[id] : undefined);
  const kind = cfg.fuel_type ?? (cfg.charging && !cfg.lock ? "ev" : "ice");
  const low = cfg.low_level ?? 20, crit = cfg.critical_level ?? 10;
  const stats: Stat[] = [];

  const le = st(cfg.level);
  const raw = numState(le);
  const pct = raw === undefined ? undefined : levelPercent(raw, unitOf(le), cfg.tank_size);
  const charging = isCharging(st(cfg.charging));
  const tone = pct === undefined || charging ? undefined : pct <= crit ? "bad" : pct <= low ? "warn" : undefined;
  const label = kind === "ev" ? "Battery" : "Fuel";
  const lu = unitOf(le);
  // Petrol is shown in litres: the sensor's own amount, or the percentage against the tank size.
  const entity = cfg.level;
  if (kind === "ice" && raw !== undefined && lu && lu !== "%") stats.push({ label, value: String(Math.round(raw)), unit: lu, tone, entity });
  else if (kind === "ice" && pct !== undefined && cfg.tank_size && cfg.tank_size > 0) stats.push({ label, value: String(Math.round((pct / 100) * cfg.tank_size)), unit: "L", tone, entity });
  else if (pct !== undefined) stats.push({ label, value: String(Math.round(pct)), unit: "%", tone, entity });
  else if (raw !== undefined) stats.push({ label, value: fmt(raw), unit: unitOf(le), entity });

  const range = numState(st(cfg.range));
  if (range !== undefined) stats.push({ label: "Range", value: fmt(range), unit: unitOf(st(cfg.range)) || "mi", entity: cfg.range });
  const odo = numState(st(cfg.odometer));
  if (odo !== undefined) stats.push({ label: "Odometer", value: fmt(odo), unit: unitOf(st(cfg.odometer)) || "mi", entity: cfg.odometer });

  let status: VehicleModel["status"];
  const ce = st(cfg.charging), lk = st(cfg.lock);
  const useCharging = isAvailable(ce) && (kind === "ev" || !isAvailable(lk));
  if (useCharging) status = { kind: charging ? "charging" : "idle", label: charging ? "Charging" : "Not charging", entity: cfg.charging! };
  else if (isAvailable(lk)) { const l = lockState(lk); status = { kind: l, label: l === "locked" ? "Locked" : "Unlocked", entity: cfg.lock! }; }

  const k = pct === undefined ? 0.3 : +(0.3 + (pct / 100) * 0.8 + (charging ? 0.1 : 0)).toFixed(2);
  return { name: cfg.name ?? "Vehicle", kind, chip: placeDetail(hass, cfg), chipEntity: cfg.location, levelEntity: cfg.level, pct, stats, status, charging, tone, k };
}

export function watchedVehicle(cfg: HaloVehicleConfig): string[] {
  return [cfg.level, cfg.range, cfg.odometer, cfg.lock, cfg.charging, cfg.location, cfg.address].filter((x): x is string => !!x);
}
