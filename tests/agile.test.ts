import { describe, expect, it } from "vitest";
import { bandOf, buildAgile, fmtP, niceRange, parseRates } from "../src/cards/agile/logic";
import { startOfDay } from "../src/cards/solar/logic";
import { ent, hassOf } from "./helpers";

const NOW = new Date(2026, 9, 12, 14, 10).getTime();
const slot = (day: number, i: number, pounds: number) => {
  const s = new Date(2026, 9, day, 0, i * 30);
  return { start: s.toISOString(), end: new Date(s.getTime() + 1_800_000).toISOString(), value_inc_vat: pounds };
};
// today: 10p all day except 14:00 = 12p, 14:30 = 20p, 18:00 = 40p, 03:00 = 5p
const today = Array.from({ length: 48 }, (_, i) => slot(12, i, i === 28 ? 0.12 : i === 29 ? 0.2 : i === 36 ? 0.4 : i === 6 ? 0.05 : 0.1));
const tomorrow = Array.from({ length: 48 }, (_, i) => slot(13, i, i === 6 ? -0.03 : 0.2));
const hass = hassOf([ent("event.t", "x", { rates: today }), ent("event.n", "x", { rates: tomorrow })]);
const cfg = { type: "x", rates_today: "event.t", rates_tomorrow: "event.n" } as any;

describe("parseRates", () => {
  it("converts pounds to pence", () => {
    const r = parseRates(ent("event.t", "x", { rates: today }) as any);
    expect(r).toHaveLength(48);
    expect(r[28].p).toBeCloseTo(12);
  });
  it("keeps pence as they are", () => {
    expect(parseRates(ent("sensor.a", "x", { rates: [{ ...slot(12, 0, 24.5) }, { ...slot(12, 1, 30) }] }) as any)[0].p).toBe(24.5);
  });
  it("copes with missing data", () => {
    expect(parseRates(undefined)).toEqual([]);
    expect(parseRates(ent("event.t", "x") as any)).toEqual([]);
  });
});

describe("helpers", () => {
  it("bands", () => {
    expect(bandOf(10, 15, 30)).toBe("low");
    expect(bandOf(20, 15, 30)).toBe("mid");
    expect(bandOf(31, 15, 30)).toBe("high");
  });
  it("formats", () => {
    expect(fmtP(24.567)).toBe("24.6");
    expect(fmtP(105.2)).toBe("105");
  });
  it("ranges include zero and negatives", () => {
    expect(niceRange(5, 40).yMin).toBe(0);
    const n = niceRange(-3, 40);
    expect(n.yMin).toBeLessThan(0);
    expect(n.ticks).toContain(0);
  });
});

describe("buildAgile", () => {
  const m = buildAgile({ hass, cfg, day: "today", now: NOW });
  const fig = (id: string) => m.figures.find((f) => f.id === id)!;
  it("current and next", () => {
    expect(fig("current").value).toBe("12.0");
    expect(fig("next").value).toBe("20.0");
  });
  it("lowest, average, highest for the day", () => {
    expect(fig("lowest").value).toBe("5.0");
    expect(fig("highest").value).toBe("40.0");
    expect(Number(fig("average").value)).toBeCloseTo((44 * 10 + 5 + 12 + 20 + 40) / 48, 1);
  });
  it("bars mark past and current", () => {
    expect(m.bars).toHaveLength(48);
    expect(m.bars.filter((b) => b.current)).toHaveLength(1);
    expect(m.bars[0].past).toBe(true);
    expect(m.bars[47].past).toBe(false);
  });
  it("tomorrow", () => {
    const t = buildAgile({ hass, cfg, day: "tomorrow", now: NOW });
    expect(t.hasTomorrow).toBe(true);
    expect(t.figures.find((f) => f.id === "lowest")!.value).toBe("-3.0");
    expect(t.yMin).toBeLessThan(0);
    expect(t.nowX).toBeUndefined();
  });
  it("respects chosen figures and empties", () => {
    expect(buildAgile({ hass, cfg: { ...cfg, figures: ["highest", "current"] }, day: "today", now: NOW }).figures.map((f) => f.id)).toEqual(["current", "highest"]);
    const e = buildAgile({ hass: hassOf([]), cfg, day: "today", now: NOW });
    expect(e.empty).toBe(true);
    expect(e.hasTomorrow).toBe(false);
    expect(startOfDay(NOW, 0)).toBeLessThanOrEqual(NOW);
  });
});
