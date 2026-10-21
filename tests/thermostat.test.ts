import { describe, expect, it } from "vitest";
import "../src/index";
import { bloomOf, buildThermostat, dialAngle, dialValue, fmtTemp, glyphKeys, round05, snapTarget, stepTarget, toneOf, turnOnMode } from "../src/cards/thermostat/logic";
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
  it("reads a temperature off a point on the dial, the bottom gap going to the nearer end", () => {
    expect(dialValue(0, -100, 10, 30)).toBeCloseTo(20);
    expect(dialValue(100, 0, 10, 30)).toBeCloseTo(20 + 20 / 3);
    expect(dialValue(-1, 100, 10, 30)).toBe(10);
    expect(dialValue(1, 100, 10, 30)).toBe(30);
    const a = (dialAngle(23, 7, 35) * Math.PI) / 180;
    expect(dialValue(Math.sin(a), -Math.cos(a), 7, 35)).toBeCloseTo(23);
  });
  it("keys the figure's characters around the decimal point", () => {
    expect(glyphKeys("20")).toEqual(["0i2", "0i1"]);
    expect(glyphKeys("20.5")).toEqual(["0i2", "0i1", "0f0", "0f1"]);
    expect(glyphKeys("9,5")).toEqual(["0i1", "0f0", "0f1"]);
    expect(glyphKeys("19–24")).toEqual(["0i2", "0i1", "d1", "1i2", "1i1"]);
  });
  it("snaps a dragged temperature to the step and range", () => {
    expect(snapTarget(21.26, 0.5, 7, 35)).toBe(21.5);
    expect(snapTarget(21.4, 1, 7, 35)).toBe(21);
    expect(snapTarget(40, 0.5, 7, 35)).toBe(35);
  });
  it("is unavailable when the entity is missing", () => {
    expect(buildThermostat(hassOf([]), cfg).available).toBe(false);
  });
});

describe("bloom", () => {
  it("rises while heating, lies wide and low in heat mode at target, none when off", () => {
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "heating" })]), cfg)).toMatchObject({ glow: "heat", bloom: "active" });
    expect(buildThermostat(hassOf([climate("heat", { hvac_action: "idle" })]), cfg)).toMatchObject({ glow: "heat", bloom: "rest" });
    const off = buildThermostat(hassOf([climate("off", { hvac_action: "off" })]), cfg);
    expect([off.glow, off.bloom]).toEqual([undefined, "none"]);
  });
  it("does the same in blue for cool, and nothing at target in auto", () => {
    expect(bloomOf("idle", "cool")).toEqual({ glow: "cool", bloom: "rest" });
    expect(bloomOf("idle", "heat_cool")).toEqual({ bloom: "none" });
    expect(bloomOf("cool", "heat_cool")).toEqual({ glow: "cool", bloom: "active" });
  });
});

describe("bloom on the card", () => {
  it("shrinks away in the colour it had, never grey, when off or unavailable", async () => {
    const card = document.createElement("halo-thermostat-card") as any;
    card.setConfig({ type: "custom:halo-thermostat-card", entity: "climate.hall" });
    card.hass = hassOf([climate("heat", { hvac_action: "heating" })]);
    document.body.append(card);
    await card.updateComplete;
    const style = () => (card.shadowRoot.querySelector("ha-card") as HTMLElement).style;
    const heat = style().getPropertyValue("--c0");
    expect(Number(style().getPropertyValue("--bw"))).toBeGreaterThan(0);
    for (const s of [ent("climate.hall", "unavailable"), climate("off", { hvac_action: "off" })]) {
      card.hass = hassOf([s]);
      await card.updateComplete;
      expect(style().getPropertyValue("--bw")).toBe("0");
      expect(style().getPropertyValue("--c0")).toBe(heat);
    }
    card.remove();
  });
});

describe("turnOnMode", () => {
  it("returns to the last mode, else heat, else the first offered", () => {
    expect(turnOnMode(["heat", "cool", "off"], "cool")).toBe("cool");
    expect(turnOnMode(["heat", "cool", "off"], "dry")).toBe("heat");
    expect(turnOnMode(["heat", "cool", "off"])).toBe("heat");
    expect(turnOnMode(["cool", "off"])).toBe("cool");
    expect(turnOnMode(["off"])).toBeUndefined();
  });
});
