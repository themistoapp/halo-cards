import { describe, expect, it } from "vitest";
import { cleanFigure, cleanSeries, cleanTop } from "../src/cards/graph/editor";
import {
  agilePreset, axesOf, barColour, buildFigure, buildSeries, chartWindow, fitWindow, hasTomorrow, niceAxis, sideOf, solarPreset, sourceOf, toSlots, total, valueAt,
  type FigureConfig, type HaloGraphConfig,
} from "../src/cards/graph/logic";
import { normalUnit, parseRates, readForecast, readList } from "../src/cards/graph/sources";
import { ent, hassOf } from "./helpers";

const H = 3600_000;
const NOW = new Date(2026, 9, 12, 14, 10).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const slot = (day: number, i: number, v: number) => {
  const s = new Date(2026, 9, day, 0, i * 30);
  return { start: s.toISOString(), end: new Date(s.getTime() + 1_800_000).toISOString(), value_inc_vat: v };
};
// Today: 10p all day except 03:00 = 5p, 14:00 = 12p, 14:30 = 20p, 18:00 = 40p. Tomorrow: 20p, with -3p at 03:00.
const today = Array.from({ length: 48 }, (_, i) => slot(12, i, i === 28 ? 0.12 : i === 29 ? 0.2 : i === 36 ? 0.4 : i === 6 ? 0.05 : 0.1));
const tomorrow = Array.from({ length: 48 }, (_, i) => slot(13, i, i === 6 ? -0.03 : 0.2));
const hours = (day: number, pairs: [number, number][]) => Object.fromEntries(pairs.map(([h, wh]) => [new Date(2026, 9, day, h).toISOString(), wh]));
const FORECAST = { a: { wh_hours: hours(12, [[10, 1000], [11, 2000], [12, 1000]]) }, b: { wh_hours: hours(12, [[11, 500]]) } };

const hass = () => hassOf([
  ent("event.t", "x", { rates: today }), ent("event.n", "x", { rates: tomorrow }),
  ent("sensor.pv", "1500", { unit_of_measurement: "W", device_class: "power", friendly_name: "PV" }),
  ent("sensor.np", "0.2", { unit_of_measurement: "EUR/kWh", raw_today: [{ start: "2026-10-12T00:00:00Z", end: "2026-10-12T01:00:00Z", value: 0.2 }], raw_tomorrow: [{ start: "2026-10-13T00:00:00Z", end: "2026-10-13T01:00:00Z", value: 0.3 }] }),
  ent("sensor.sc", "5", { detailedForecast: [{ period_start: "2026-10-12T10:00:00Z", pv_estimate: 1.2 }, { period_start: "2026-10-12T10:30:00Z", pv_estimate: 1.6 }] }),
  ent("sensor.temp", "19", { unit_of_measurement: "°C" }),
]);
const pvHistory = [{ t: at(12, 10), v: 0 }, { t: at(12, 12), v: 2000 }, { t: at(12, 14), v: 2000 }];
const cfg = (c: Partial<HaloGraphConfig>): HaloGraphConfig => ({ type: "x", series: [], ...c });
const series = (c: HaloGraphConfig) => buildSeries(hass(), c, { history: { "sensor.pv": pvHistory }, statistics: {}, forecast: FORECAST }, NOW);

describe("reading lists", () => {
  it("turns Octopus pounds into pence, and keeps pence", () => {
    const r = readList(hass().states["event.t"]);
    expect([r.slots.length, r.unit, r.slots[28].v]).toEqual([48, "p", 12]);
    expect(readList(ent("sensor.a", "x", { rates: [slot(12, 0, 24.5), slot(12, 1, 30)] }) as any).slots[0].v).toBe(24.5);
    expect(parseRates(hass().states["event.t"])[29]).toMatchObject({ p: 20 });
  });
  it("reads Nordpool's today and tomorrow from one entity, in its own unit", () => {
    const r = readList(hass().states["sensor.np"]);
    expect([r.slots.length, r.unit]).toEqual([2, "EUR/kWh"]);
  });
  it("gives Solcast rows (no end time) the gap to the next row, in kW", () => {
    const r = readList(hass().states["sensor.sc"]);
    expect(r.unit).toBe("kW");
    expect(r.slots.map((s) => (s.t1 - s.t0) / 60_000)).toEqual([30, 30]);
  });
  it("reads any list with the keys you name", () => {
    const e = ent("sensor.x", "1", { prices: [{ from: "2026-10-12T00:00:00Z", till: "2026-10-12T01:00:00Z", cost: "7" }], unit_of_measurement: "c" });
    expect(readList(e as any, { attribute: "prices", start_key: "from", end_key: "till", value_key: "cost" }).slots).toEqual([{ t0: Date.parse("2026-10-12T00:00:00Z"), t1: Date.parse("2026-10-12T01:00:00Z"), v: 7 }]);
    expect(readList(e as any).slots).toEqual([]);
    expect(readList(undefined).slots).toEqual([]);
  });
  it("adds forecast entries together as average kW, rising from zero", () => {
    const s = readForecast(FORECAST);
    expect(s.map((x) => [new Date(x.t0).getHours(), x.v])).toEqual([[9, 0], [10, 1], [11, 2.5], [12, 1], [13, 0]]);
    expect(readForecast(FORECAST, "b").map((x) => x.v)).toEqual([0, 0.5, 0]);
    expect(readForecast(undefined)).toEqual([]);
  });
  it("puts power in kW and energy in kWh", () => {
    expect([normalUnit("W"), normalUnit("MWh"), normalUnit("°C")]).toEqual([{ unit: "kW", k: 0.001 }, { unit: "kWh", k: 1000 }, { unit: "°C", k: 1 }]);
  });
});

describe("series", () => {
  it("finds the source: forecast with no entity, a list, or history", () => {
    const h = hass();
    expect([sourceOf(h, {}), sourceOf(h, { entities: ["event.t"] }), sourceOf(h, { entity: "sensor.pv" }), sourceOf(h, { entity: "sensor.pv", source: "statistics" })])
      .toEqual(["energy_forecast", "attribute", "history", "statistics"]);
  });
  it("joins today and tomorrow, draws rates as bars, forecasts as areas and history as a line", () => {
    const [rate, fc, pv] = series(cfg({ series: [{ entities: ["event.t", "event.n"] }, {}, { entity: "sensor.pv" }] }));
    expect([rate.slots.length, rate.style, rate.unit, rate.kind]).toEqual([96, "bars", "p", "slots"]);
    expect([fc.style, fc.unit, fc.name]).toEqual(["area", "kW", "Forecast"]);
    expect([pv.style, pv.unit, pv.name, pv.points.length]).toEqual(["line", "kW", "PV", 4]);
    expect(pv.points[3]).toEqual({ t: NOW, v: 1.5 });
  });
  it("averages history into bars of the length you choose", () => {
    expect(toSlots([{ t: at(12, 10), v: 1 }, { t: at(12, 10, 30), v: 3 }, { t: at(12, 11, 15), v: 5 }], H).map((s) => s.v)).toEqual([2, 5]);
    const [pv] = series(cfg({ series: [{ entity: "sensor.pv", style: "bars", slot_minutes: 60 }] }));
    expect(pv.kind).toBe("slots");
  });
  it("reads a value at any time", () => {
    const [rate, , pv] = series(cfg({ series: [{ entities: ["event.t"] }, {}, { entity: "sensor.pv" }] }));
    expect([valueAt(rate, at(12, 14, 40)), valueAt(pv, at(12, 11)), valueAt(pv, at(12, 9))]).toEqual([20, 1, undefined]);
  });
  it("puts a second unit on the right", () => {
    const s = series(cfg({ series: [{ entities: ["event.t"] }, {}, { entity: "sensor.pv" }] }));
    expect(axesOf(s)).toEqual(["p", "kW"]);
    expect(s.map((x) => sideOf(s, x))).toEqual(["L", "R", "R"]);
  });
  it("colours bars by the first rule they meet", () => {
    const [rate] = series(cfg({ series: [{ entities: ["event.t"], colour: "yellow", colour_rules: [{ below: 15, colour: "green" }, { above: 30, colour: "red" }] }] }));
    expect([barColour(rate, 10), barColour(rate, 20), barColour(rate, 40)]).toEqual(["green", "yellow", "red"]);
  });
});

describe("time", () => {
  it("covers a day, or hours before, after or around now", () => {
    expect(chartWindow(cfg({}), NOW, "today")).toEqual([at(12, 0), at(13, 0)]);
    expect(chartWindow(cfg({}), NOW, "tomorrow")).toEqual([at(13, 0), at(14, 0)]);
    expect(chartWindow(cfg({ period: "last", hours: 6 }), NOW, "today")).toEqual([NOW - 6 * H, NOW]);
    expect(chartWindow(cfg({ period: "next" }), NOW, "today")).toEqual([NOW, NOW + 24 * H]);
    expect(chartWindow(cfg({ period: "around", hours: 500 }), NOW, "today")).toEqual([NOW - 84 * H, NOW + 84 * H]);
  });
  it("trims empty hours, keeping an hour either side and at least eight hours", () => {
    const s = series(cfg({ series: [{}] }));
    expect(fitWindow(s, [at(12, 0), at(13, 0)])).toEqual([at(12, 9), at(12, 17)]);
  });
  it("offers tomorrow once there is data for it", () => {
    expect(hasTomorrow(series(cfg({ series: [{ entities: ["event.t", "event.n"] }] })), NOW)).toBe(true);
    expect(hasTomorrow(series(cfg({ series: [{ entities: ["event.t"] }] })), NOW)).toBe(false);
  });
});

describe("figures", () => {
  const c = cfg({ series: [{ name: "Rate", entities: ["event.t", "event.n"] }, { name: "Forecast" }, { name: "Actual", entity: "sensor.pv" }] });
  const s = series(c);
  const fig = (f: FigureConfig) => buildFigure(hass(), c, s, f, NOW, [at(12, 0), at(13, 0)]);
  it("reads the current and next slot", () => {
    expect(fig({ calc: "now" })).toMatchObject({ label: "Now", value: "12.0", unit: "p", note: "until 14:30" });
    expect(fig({ calc: "next", label: "Next rate" })).toMatchObject({ label: "Next rate", value: "20.0", note: "from 14:30" });
  });
  it("finds the lowest, highest and average over a window", () => {
    expect(fig({ calc: "lowest", window: "today" })).toMatchObject({ value: "5.0", note: "at 03:00" });
    expect(fig({ calc: "highest", window: "today" })).toMatchObject({ value: "40.0", note: "at 18:00" });
    expect(fig({ calc: "lowest", window: "tomorrow" })).toMatchObject({ value: "-3.0", note: "at 03:00" });
    expect(fig({ calc: "average", window: "tomorrow" }).note).toBe("tomorrow");
    expect(fig({ calc: "lowest", window: "next", hours: 2 })).toMatchObject({ value: "10.0" });
  });
  it("totals power as energy, and what is left of today", () => {
    expect(fig({ series: "Forecast", calc: "total", window: "today" })).toMatchObject({ value: "4.5", unit: "kWh" });
    expect(fig({ series: "Forecast", calc: "remaining", window: "today" })).toMatchObject({ value: "0.0" });
    expect(total(s[2], at(12, 10), at(12, 14))).toEqual({ v: 6, unit: "kWh" });
  });
  it("compares against another series so far", () => {
    expect(fig({ series: "Actual", calc: "total", window: "today", compare: "Forecast" })).toMatchObject({ value: "6.3", note: "140%", good: true });
  });
  it("can show a plain entity, hide the note, and copes with nothing", () => {
    expect(fig({ entity: "sensor.temp" })).toMatchObject({ label: "sensor.temp", value: "19.0", unit: "°C" });
    expect(fig({ calc: "now", note: false }).note).toBeUndefined();
    expect(fig({ series: "Nope", calc: "now" }).value).toBe("–");
  });
});

describe("axis", () => {
  it("runs from zero (or below) to just over the top in round steps", () => {
    expect(niceAxis(0, 40)).toEqual({ min: 0, max: 60, ticks: [0, 20, 40, 60] });
    expect(niceAxis(0, 3.4).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(niceAxis(-3, 40).min).toBeLessThan(0);
  });
});

describe("presets", () => {
  const h = hassOf([ent("event.octopus_energy_electricity_1_2_current_day_rates", "x"), ent("event.octopus_energy_electricity_1_2_next_day_rates", "x"),
    ent("sensor.solar_pv_power", "0", { device_class: "power" })]);
  it("find the Agile rate entities and the solar power sensor", () => {
    expect(agilePreset(h).series[0].entities).toHaveLength(2);
    expect(solarPreset(h).series.map((s) => s.entity)).toEqual([undefined, "sensor.solar_pv_power"]);
    expect(solarPreset(h).figures).toHaveLength(4);
    expect(solarPreset().figures!.map((f) => f.label)).toEqual(["Remaining", "Today", "Tomorrow"]);
  });
});

describe("editor", () => {
  it("drops stand-ins, empties and defaults from the YAML", () => {
    expect(cleanSeries({ name: "", entities: [], source: "$auto", style: "bars", colour_rules: [], entity: "old" })).toEqual({ style: "bars" });
    expect(cleanFigure({ calc: "now", compare: "$none", icon_colour: "$none", note: true })).toEqual({ calc: "now" });
    expect(cleanTop({ type: "x", shadow: true, fit: false, period: "day", series: [] })).toEqual({ type: "x", period: "day" });
  });
});
