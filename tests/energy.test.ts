import { describe, expect, it } from "vitest";
import { bucket, buildModel, graphPath, historyWindow, layoutFor, randomOrigin } from "../src/cards/energy/logic";
import type { HaloEnergyConfig, HomeAssistant } from "../src/shared/types";

const ent = (id: string, state: string, attributes: Record<string, any> = {}) => ({
  entity_id: id, state, attributes, last_updated: "2026-10-12T10:00:00Z", last_changed: "2026-10-12T10:00:00Z",
});
const hassOf = (list: ReturnType<typeof ent>[]): HomeAssistant =>
  ({ states: Object.fromEntries(list.map((e) => [e.entity_id, e])) }) as unknown as HomeAssistant;

const cfg: HaloEnergyConfig = {
  type: "x", solar_power: "sensor.sp", solar_energy: "sensor.se", solar_forecast: "sensor.sf",
  battery_soc: "sensor.soc", battery_power: "sensor.bp", grid_power: "sensor.gp", grid_cost: "sensor.gc",
  home_power: "sensor.hp", reserve_entity: "number.res", mode_entity: "select.mode",
};
const full = () => hassOf([
  ent("sensor.sp", "820", { unit_of_measurement: "W" }), ent("sensor.se", "5.4", { unit_of_measurement: "kWh" }),
  ent("sensor.sf", "9.1", { unit_of_measurement: "kWh" }), ent("sensor.soc", "62", { unit_of_measurement: "%" }),
  ent("sensor.bp", "350", { unit_of_measurement: "W" }), ent("sensor.gp", "630", { unit_of_measurement: "W" }),
  ent("sensor.gc", "1.59", { unit_of_measurement: "£" }), ent("sensor.hp", "1800", { unit_of_measurement: "W" }),
  ent("number.res", "65", { min: 0, max: 100, step: 5 }), ent("select.mode", "Self-powered", { options: ["Self-powered", "AI"] }),
]);

describe("buildModel", () => {
  it("builds all four tiles with their detail lines", () => {
    const m = buildModel(full(), cfg);
    expect(m.tiles.map((t) => t.key)).toEqual(["solar", "battery", "grid", "house"]);
    expect(m.tiles[0]).toMatchObject({ figure: "0.82", detail: "5.4 of 9.1 kWh forecast" });
    expect(m.tiles[1]).toMatchObject({ figure: "62", unit: "%", detail: "Discharging · 0.35 kW" });
    expect(m.tiles[2]).toMatchObject({ figure: "0.63", detail: "Importing · £1.59 today" });
    expect(m.tiles[3]).toMatchObject({ figure: "1.80" });
    expect(m.tiles[3].detail).toBeUndefined();
    expect(m.soc).toBe(62);
    expect(m.reserve).toMatchObject({ value: 65, step: 5 });
    expect(m.mode?.selected).toBe("self");
  });

  it("hides tiles whose entities are missing or unavailable", () => {
    const h = full();
    h.states["sensor.gp"] = ent("sensor.gp", "unavailable");
    delete h.states["sensor.hp"];
    const m = buildModel(h, cfg);
    expect(m.tiles.map((t) => t.key)).toEqual(["solar", "battery"]);
    expect(m.bloom.grid).toBe(0);
  });

  it("hides the light bar without a battery level but keeps the tile on power", () => {
    const h = full();
    h.states["sensor.soc"] = ent("sensor.soc", "unknown");
    const m = buildModel(h, cfg);
    expect(m.soc).toBeUndefined();
    expect(m.tiles[1]).toMatchObject({ unit: "kW", figure: "0.35" });
  });

  it("hides the slider and the pill independently", () => {
    const h = full();
    h.states["number.res"] = ent("number.res", "unavailable");
    let m = buildModel(h, cfg);
    expect(m.reserve).toBeUndefined();
    expect(m.mode).toBeDefined();
    delete h.states["select.mode"];
    m = buildModel(h, cfg);
    expect(m.mode).toBeUndefined();
  });

  it("sizes blooms by share of supply, capped", () => {
    const m = buildModel(full(), cfg);
    expect(m.bloom.solar).toBeCloseTo((0.82 / 1.8) * 1.6, 2);
    expect(m.bloom.battery).toBeCloseTo((0.35 / 1.8) * 1.6, 2);
    const solo = buildModel(hassOf([ent("sensor.sp", "1000", { unit_of_measurement: "W" })]), { type: "x", solar_power: "sensor.sp" });
    expect(solo.bloom.solar).toBe(1.1);
  });

  it("honours sign inversion and kW units", () => {
    const h = hassOf([ent("sensor.gp", "-1.5", { unit_of_measurement: "kW" })]);
    expect(buildModel(h, { type: "x", grid_power: "sensor.gp" }).tiles[0].detail).toBe("Exporting");
    expect(buildModel(h, { type: "x", grid_power: "sensor.gp", grid_invert: true }).tiles[0].detail).toBe("Importing");
  });

  it("falls back to the first two select options when the names differ", () => {
    const h = hassOf([ent("select.mode", "Smart", { options: ["Smart", "Cloud AI"] })]);
    const m = buildModel(h, { type: "x", mode_entity: "select.mode" });
    expect(m.mode).toMatchObject({ self: "Smart", ai: "Cloud AI", selected: "self" });
  });

  it("uses the picked entity for the updated time", () => {
    const h = full();
    h.states["sensor.x"] = { ...ent("sensor.x", "1"), last_updated: "2026-10-12T12:30:00Z" };
    expect(buildModel(h, { ...cfg, updated_entity: "sensor.x" }).updated?.toISOString()).toBe("2026-10-12T12:30:00.000Z");
  });
});

describe("layoutFor", () => {
  it("follows tile count", () => {
    expect(layoutFor(4)).toEqual({ cols: 2, rows: 2, spanLast: false });
    expect(layoutFor(3)).toEqual({ cols: 2, rows: 2, spanLast: true });
    expect(layoutFor(2)).toEqual({ cols: 1, rows: 2, spanLast: false });
    expect(layoutFor(1)).toEqual({ cols: 1, rows: 1, spanLast: false });
  });
});

describe("history helpers", () => {
  it("buckets with carry-forward", () => {
    const out = bucket([{ t: 0, v: 10 }, { t: 25, v: 20 }], 10, 50, 4);
    expect(out).toEqual([10, 20, 20, 20]);
  });
  it("needs two points for a graph", () => {
    expect(graphPath([null, 1, null], 2)).toBeUndefined();
    expect(graphPath([0, 1, 2], 2)?.area).toMatch(/Z$/);
  });
  it("starts the window at the start hour, or six hours back early in the day", () => {
    const noon = new Date(2026, 9, 12, 12, 0).getTime();
    expect(new Date(historyWindow(noon, 7)[0]).getHours()).toBe(7);
    const early = new Date(2026, 9, 12, 7, 10).getTime();
    expect(historyWindow(early, 7)[0]).toBe(early - 6 * 3600_000);
  });
  it("picks origins on an edge", () => {
    const [x, y] = randomOrigin(() => 0.1);
    expect(parseFloat(x)).toBeGreaterThanOrEqual(-6);
    expect(parseFloat(y)).toBeLessThanOrEqual(106);
  });
});
