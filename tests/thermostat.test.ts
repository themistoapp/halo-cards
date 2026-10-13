import { describe, expect, it } from "vitest";
import { AT_TARGET_K, bloomOf, buildThermostat, fmtTemp, round05, stepTarget, toneOf } from "../src/cards/thermostat/logic";
import { ent, hassOf } from "./helpers";

const climate = (state: string, a: Record<string, unknown> = {}) => ent("climate.hall", state, {
  friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "off"], current_temperature: 19.4, temperature: 22, min_temp: 9, max_temp: 32, current_humidity: 48.2, ...a,
});
const cfg = { type: "x", entity: "climate.hall" };

describe("rounding", () => {
  it("rounds to the nearest half degree", () => {
    expect([19.2, 19.26, 19.74, 19.75, 22].map(round05)).toEqual([19, 19.5, 19.5, 20, 22]);
    expect([22, 19.5].map(fmtTemp)).toEqual(["22", "19.5"]);
  });
  it("rounds what it shows", () => {
    const m = buildThermostat(hassOf([climate("heat", { current_temperature: 19.3, temperature: 21.8 })]), cfg);
    expect([m.cur, m.tgt, m.humidity]).toEqual([19.5, 22, 48]);
  });
});

describe("tone", () => {
  it("follows what the thermostat is doing", () => {
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "heating" })]), cfg).tone).toBe("heat");
    expect(buildThermostat(hassOf([climate("cool", { hvac_action: "cooling" })]), cfg).tone).toBe("cool");
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "idle" })]), cfg).tone).toBe("idle");
    expect(buildThermostat(hassOf([climate("off", { hvac_action: "off" })]), cfg).tone).toBe("off");
  });
  it("works it out from temperatures when no action is reported", () => {
    expect(toneOf(climate("heat"), 19.4, 22)).toBe("heat");
    expect(toneOf(climate("cool"), 24, 21)).toBe("cool");
    expect(toneOf(climate("heat"), 22, 22)).toBe("idle");
    expect(toneOf(climate("heat_cool"), 18, undefined, 19.5, 24)).toBe("heat");
    expect(toneOf(climate("heat_cool"), 26, undefined, 19.5, 24)).toBe("cool");
  });
});

describe("modes", () => {
  it("offers every supported mode, in order, when none are ticked", () => {
    expect(buildThermostat(hassOf([climate("heat")]), cfg).modes.map((m) => m.id)).toEqual(["heat", "cool", "heat_cool", "off"]);
  });
  it("offers only the ticked modes, and never ones the thermostat lacks", () => {
    const m = buildThermostat(hassOf([climate("heat")]), { ...cfg, hvac_modes: ["off", "heat", "dry"] });
    expect(m.modes.map((x) => x.label)).toEqual(["Heat", "Off"]);
  });
});

describe("range mode and limits", () => {
  it("reads a heat/cool range", () => {
    const m = buildThermostat(hassOf([climate("heat_cool", { temperature: null, target_temp_low: 19.5, target_temp_high: 24 })]), cfg);
    expect([m.range, m.low, m.high, m.tgt]).toEqual([true, 19.5, 24, undefined]);
  });
  it("steps by half degrees inside the range", () => {
    expect(stepTarget(22, 1, 0.5, 9, 32)).toBe(22.5);
    expect(stepTarget(22, -1, 0.5, 9, 32)).toBe(21.5);
    expect(stepTarget(32, 1, 0.5, 9, 32)).toBe(32);
    expect(stepTarget(9, -1, 0.5, 9, 32)).toBe(9);
  });
  it("is unavailable when the entity is missing", () => {
    expect(buildThermostat(hassOf([]), cfg).available).toBe(false);
  });
});

describe("bloom", () => {
  it("is full while heating, small in heat mode at target, none when off", () => {
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "heating" })]), cfg)).toMatchObject({ glow: "heat", k: 1 });
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "idle" })]), cfg)).toMatchObject({ glow: "heat", k: AT_TARGET_K });
    const off = buildThermostat(hassOf([climate("off", { hvac_action: "off" })]), cfg);
    expect([off.glow, off.k]).toEqual([undefined, 0]);
  });
  it("waits in blue for cool, and shows nothing at target in auto", () => {
    expect(bloomOf("idle", "cool")).toEqual({ glow: "cool", k: AT_TARGET_K });
    expect(bloomOf("idle", "heat_cool")).toEqual({ k: 0 });
    expect(bloomOf("cool", "heat_cool")).toEqual({ glow: "cool", k: 1 });
  });
});
