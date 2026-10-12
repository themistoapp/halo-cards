import { describe, expect, it } from "vitest";
import { buildVehicle, levelPercent, lockState } from "../src/cards/vehicle/logic";
import { ent, hassOf } from "./helpers";

const m140i = () => hassOf([
  ent("sensor.fuel", "32", { unit_of_measurement: "L" }), ent("sensor.range", "312", { unit_of_measurement: "mi" }),
  ent("sensor.odo", "24310", { unit_of_measurement: "mi" }), ent("lock.car", "locked"), ent("device_tracker.car", "home"),
  ent("zone.home", "0", { friendly_name: "Home" }),
]);
const petrol = { type: "x", name: "M140i", fuel_type: "ice" as const, level: "sensor.fuel", range: "sensor.range", odometer: "sensor.odo", lock: "lock.car", location: "device_tracker.car", tank_size: 52 };

describe("levelPercent", () => {
  it("passes percentages and scales litres by tank size", () => {
    expect(levelPercent(62, "%")).toBe(62);
    expect(levelPercent(26, "L", 52)).toBe(50);
    expect(levelPercent(26, "L")).toBeUndefined();
    expect(levelPercent(70, "L", 52)).toBe(100);
  });
});

describe("buildVehicle (petrol)", () => {
  it("builds three stats, bar, lock status and place", () => {
    const m = buildVehicle(m140i(), petrol);
    expect(m.stats.map((s) => [s.label, s.value, s.unit])).toEqual([["Fuel", "62", "%"], ["Range", "312", "mi"], ["Odometer", "24,310", "mi"]]);
    expect(m.pct).toBeCloseTo(61.5, 1);
    expect(m.status).toMatchObject({ kind: "locked", label: "Locked" });
    expect(m.chip).toBe("Home");
    expect(m.charging).toBe(false);
  });
  it("flags low and critical levels on the figure", () => {
    const h = m140i();
    h.states["sensor.fuel"] = ent("sensor.fuel", "4", { unit_of_measurement: "L" });
    expect(buildVehicle(h, petrol).stats[0].tone).toBe("bad");
    h.states["sensor.fuel"] = ent("sensor.fuel", "9", { unit_of_measurement: "L" });
    expect(buildVehicle(h, petrol).stats[0].tone).toBe("warn");
    h.states["sensor.fuel"] = ent("sensor.fuel", "30", { unit_of_measurement: "L" });
    expect(buildVehicle(h, petrol).stats[0].tone).toBeUndefined();
  });
  it("hides what is missing or unavailable", () => {
    const h = m140i(); h.states["sensor.range"] = ent("sensor.range", "unavailable"); delete h.states["device_tracker.car"];
    const m = buildVehicle(h, petrol);
    expect(m.stats.map((s) => s.label)).toEqual(["Fuel", "Odometer"]);
    expect(m.chip).toBeUndefined();
    expect(buildVehicle(h, { ...petrol, lock: undefined }).status).toBeUndefined();
  });
  it("shows the raw amount and no bar when litres have no tank size", () => {
    const m = buildVehicle(m140i(), { ...petrol, tank_size: undefined });
    expect(m.pct).toBeUndefined();
    expect(m.stats[0]).toMatchObject({ label: "Fuel", value: "32", unit: "L" });
  });
});

describe("buildVehicle (electric)", () => {
  const ev = () => hassOf([
    ent("sensor.soc", "64", { unit_of_measurement: "%" }), ent("sensor.range", "148", { unit_of_measurement: "mi" }),
    ent("binary_sensor.charging", "on"), ent("device_tracker.van", "not_home"),
  ]);
  const cfg = { type: "x", fuel_type: "ev" as const, level: "sensor.soc", range: "sensor.range", charging: "binary_sensor.charging", location: "device_tracker.van" };
  it("shows charging and suppresses warnings while charging", () => {
    const m = buildVehicle(ev(), cfg);
    expect(m.status).toMatchObject({ kind: "charging", label: "Charging" });
    expect(m.charging).toBe(true);
    expect(m.chip).toBe("Away");
    const h = ev(); h.states["sensor.soc"] = ent("sensor.soc", "8", { unit_of_measurement: "%" });
    expect(buildVehicle(h, cfg).tone).toBeUndefined();
    h.states["binary_sensor.charging"] = ent("binary_sensor.charging", "off");
    const m2 = buildVehicle(h, cfg);
    expect(m2.tone).toBe("bad");
    expect(m2.status).toMatchObject({ kind: "idle", label: "Not charging" });
  });
  it("grows the bloom with the level", () => {
    const lo = ev(); lo.states["sensor.soc"] = ent("sensor.soc", "10", { unit_of_measurement: "%" });
    expect(buildVehicle(ev(), cfg).k).toBeGreaterThan(buildVehicle(lo, cfg).k);
  });
  it("infers the vehicle type from the entities", () => {
    expect(buildVehicle(ev(), { ...cfg, fuel_type: undefined }).kind).toBe("ev");
    expect(buildVehicle(m140i(), { ...petrol, fuel_type: undefined }).kind).toBe("ice");
  });
});

describe("lockState", () => {
  it("handles locks, binary sensors and text sensors", () => {
    expect(lockState(ent("lock.a", "locked"))).toBe("locked");
    expect(lockState(ent("lock.a", "unlocked"))).toBe("unlocked");
    expect(lockState(ent("binary_sensor.a", "on"))).toBe("unlocked");
    expect(lockState(ent("sensor.a", "SECURED"))).toBe("locked");
  });
});
