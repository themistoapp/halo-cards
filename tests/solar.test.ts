import { describe, expect, it } from "vitest";
import { buildSolar, fmtClock, fmtKwh, hoursOn, niceAxis, parseForecast, smoothPath, startOfDay, toKw } from "../src/cards/solar/logic";
import { ent } from "./helpers";

const NOW = new Date(2026, 9, 12, 14, 0).getTime(); // 12 Oct 2026, 14:00 local
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const iso = (day: number, h: number) => new Date(2026, 9, day, h).toISOString();
// 1 kWh in each of 10:00..13:00 today, 2 kWh at 12:00, and 0.5 kWh at 11:00 tomorrow.
const raw = { a: { wh_hours: { [iso(12, 10)]: 1000, [iso(12, 11)]: 1000, [iso(12, 12)]: 2000, [iso(12, 13)]: 1000, [iso(13, 11)]: 500 } } };

describe("forecast data", () => {
  it("adds entries together, or picks one", () => {
    const two = { ...raw, b: { wh_hours: { [iso(12, 10)]: 400 } } };
    expect(parseForecast(two).find((h) => h.t === at(12, 10))?.wh).toBe(1400);
    expect(parseForecast(two, "b")).toEqual([{ t: at(12, 10), wh: 400 }]);
    expect(parseForecast(undefined)).toEqual([]);
    expect(parseForecast({ a: { wh_hours: { nonsense: 5, [iso(12, 9)]: Number.NaN } } })).toEqual([]);
  });
  it("sorts by time and splits days at local midnight", () => {
    const h = parseForecast(raw);
    expect(h.map((x) => x.wh)).toEqual([1000, 1000, 2000, 1000, 500]);
    expect(hoursOn(h, startOfDay(NOW)).length).toBe(4);
    expect(hoursOn(h, startOfDay(NOW, 1)).length).toBe(1);
  });
});

describe("axis and formats", () => {
  it("picks three even steps with headroom", () => {
    expect(niceAxis(1.0)).toEqual({ step: 0.4, max: 1.2 });
    expect(niceAxis(0)).toEqual({ step: 0.1, max: 0.3 });
    expect(niceAxis(3.2)).toEqual({ step: 1.2, max: 3.6 });
  });
  it("formats", () => {
    expect([fmtKwh(5.96), fmtKwh(12.04), fmtKwh(120.4)]).toEqual(["6.0", "12.0", "120"]);
    expect([fmtClock(12.5), fmtClock(7.25), fmtClock(0)]).toEqual(["12:30", "07:15", "00:00"]);
  });
  it("reads power in W or kW", () => {
    expect(toKw(ent("sensor.pv", "0", { unit_of_measurement: "W" }), 870)).toBe(0.87);
    expect(toKw(ent("sensor.pv", "0", { unit_of_measurement: "kW" }), 0.87)).toBe(0.87);
    expect(toKw(undefined, 500)).toBe(0.5);
    expect(toKw(undefined, null)).toBeNull();
  });
});

describe("forecast chart", () => {
  const hours = parseForecast(raw);
  it("totals the day and finds the peak", () => {
    const m = buildSolar({ hours, day: "today", now: NOW });
    expect(m.forecastKwh).toBe(5);
    expect(m.peak).toEqual({ kw: 2, x: 12.5 });
    expect(m.forecast[0]).toEqual({ x: 10, kw: 0 });
    expect(m.forecast[m.forecast.length - 1]).toEqual({ x: 14, kw: 0 });
    expect(m.axis.max).toBeGreaterThanOrEqual(2);
    expect(m.ticks.every((t) => t % 3 === 0)).toBe(true);
    expect(m.x1 - m.x0).toBeGreaterThanOrEqual(8);
  });
  it("works out the forecast still to come today", () => {
    expect(buildSolar({ hours, day: "today", now: NOW }).remainingKwh).toBe(0); // 14:00: every forecast hour is over
    expect(buildSolar({ hours, day: "today", now: at(12, 12, 30) }).remainingKwh).toBeCloseTo(2, 5); // 3 of 5 kWh done by 12:30
    expect(buildSolar({ hours, day: "today", now: at(12, 9) }).remainingKwh).toBe(5);
    expect(buildSolar({ hours, day: "tomorrow", now: NOW }).remainingKwh).toBeUndefined();
  });
  it("does tomorrow separately and has no generated figure", () => {
    const m = buildSolar({ hours, day: "tomorrow", now: NOW, samples: [{ t: at(12, 8), v: 900 }] });
    expect([m.forecastKwh, m.generatedKwh, m.nowX]).toEqual([0.5, undefined, undefined]);
  });
  it("is empty when there is no forecast for the day", () => {
    expect(buildSolar({ hours: [], day: "today", now: NOW }).empty).toBe(true);
    expect(buildSolar({ hours: hours.filter((h) => h.t < at(13, 0)), day: "tomorrow", now: NOW }).empty).toBe(true);
  });
});

describe("generated", () => {
  const hours = parseForecast(raw);
  const pv = ent("sensor.pv", "0", { unit_of_measurement: "W" });
  it("adds up the power sensor and compares with the forecast so far", () => {
    // 1000 W from 10:00 to 14:00 = 4 kWh generated; forecast to 14:00 = 5 kWh.
    const m = buildSolar({ hours, day: "today", now: NOW, entity: pv, samples: [{ t: at(12, 0), v: 0 }, { t: at(12, 10), v: 1000 }] });
    expect(m.generatedKwh).toBeCloseTo(4, 1);
    expect(m.pct).toBe(80);
    expect(m.nowX).toBeCloseTo(14, 5);
    expect(m.nowKw).toBe(1);
  });
  it("starts the line where generation starts", () => {
    const m = buildSolar({ hours, day: "today", now: NOW, entity: pv, samples: [{ t: at(12, 0), v: 0 }, { t: at(12, 10), v: 1000 }] });
    expect(m.actual[0].x).toBeGreaterThan(9.5);
    expect(m.actual[m.actual.length - 1]).toEqual({ x: 14, kw: 1 });
  });
  it("works in kW", () => {
    const kw = ent("sensor.pv", "0", { unit_of_measurement: "kW" });
    const m = buildSolar({ hours, day: "today", now: NOW, entity: kw, samples: [{ t: at(12, 0), v: 0 }, { t: at(12, 10), v: 1 }] });
    expect(m.generatedKwh).toBeCloseTo(4, 1);
  });
  it("shows nothing generated before the forecast starts, and no percentage", () => {
    const m = buildSolar({ hours, day: "today", now: at(12, 9, 30), entity: pv, samples: [{ t: at(12, 0), v: 0 }] });
    expect(m.generatedKwh).toBe(0);
    expect(m.pct).toBeUndefined();
    expect(m.actual).toEqual([]);
  });
});

describe("curve", () => {
  it("never dips below the baseline", () => {
    const d = smoothPath([[0, 100], [10, 20], [20, 100]], 100);
    const ys = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });
});
