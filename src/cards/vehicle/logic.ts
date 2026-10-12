import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable, numState, prettyPlace, unitOf } from "../../shared/util";

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
  /** Tank size in litres (or gallons) when the fuel sensor reports an absolute amount instead of a percentage. */
  tank_size?: number;
  low_level?: number;
  critical_level?: number;
}

export interface Stat { label: string; value: string; unit: string; tone?: "warn" | "bad" }
export interface VehicleModel {
  name: string;
  kind: "ice" | "ev";
  chip?: string;
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

const fmt = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-GB") : String(+v.toFixed(Math.abs(v) < 100 ? 1 : 0)));

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
  if (pct !== undefined) stats.push({ label, value: String(Math.round(pct)), unit: "%", tone });
  else if (raw !== undefined) stats.push({ label, value: fmt(raw), unit: unitOf(le) });

  const range = numState(st(cfg.range));
  if (range !== undefined) stats.push({ label: "Range", value: fmt(range), unit: unitOf(st(cfg.range)) || "mi" });
  const odo = numState(st(cfg.odometer));
  if (odo !== undefined) stats.push({ label: "Odometer", value: fmt(odo), unit: unitOf(st(cfg.odometer)) || "mi" });

  let status: VehicleModel["status"];
  const ce = st(cfg.charging), lk = st(cfg.lock);
  const useCharging = isAvailable(ce) && (kind === "ev" || !isAvailable(lk));
  if (useCharging) status = { kind: charging ? "charging" : "idle", label: charging ? "Charging" : "Not charging", entity: cfg.charging! };
  else if (isAvailable(lk)) { const l = lockState(lk); status = { kind: l, label: l === "locked" ? "Locked" : "Unlocked", entity: cfg.lock! }; }

  const k = pct === undefined ? 0.3 : +(0.3 + (pct / 100) * 0.8 + (charging ? 0.1 : 0)).toFixed(2);
  return { name: cfg.name ?? "Vehicle", kind, chip: placeName(hass, st(cfg.location)), pct, stats, status, charging, tone, k };
}

export function watchedVehicle(cfg: HaloVehicleConfig): string[] {
  return [cfg.level, cfg.range, cfg.odometer, cfg.lock, cfg.charging, cfg.location].filter((x): x is string => !!x);
}
