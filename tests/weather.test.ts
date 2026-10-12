import { describe, expect, it } from "vitest";
import { buildWeather, compass, forecastTypes, iconFor, neededHeight, roundTemp, rowsFor, sectionsOf, weeklyRows } from "../src/cards/weather/logic";
import { ent, hassOf } from "./helpers";

const NOW = new Date(2026, 9, 12, 15, 20); // 12 Oct 2026, 15:20 local
const at = (day: number, h: number) => new Date(2026, 9, day, h).toISOString();
const wx = (state = "partlycloudy", a: Record<string, unknown> = {}) => ent("weather.home", state, {
  friendly_name: "Swindon", temperature: 14.4, humidity: 71.6, pressure: 1008.3, pressure_unit: "hPa", wind_speed: 22.4, wind_speed_unit: "km/h", wind_bearing: 225, supported_features: 3, ...a,
});
const cfg = { type: "x", entity: "weather.home" };
const hourly = [15, 16, 17, 18, 19, 20, 21].map((h, i) => ({ datetime: at(12, h), condition: i % 2 ? "rainy" : "cloudy", temperature: 14 - i * 0.6 }));
const daily = [12, 13, 14, 15].map((d, i) => ({ datetime: at(d, 12), condition: "cloudy", temperature: 16 - i, templow: 9 - i }));
const opts = { now: NOW, locale: "en-GB" };

describe("conditions", () => {
  it("maps conditions to icons, with night variants", () => {
    expect(iconFor("sunny")).toBe("sun");
    expect(iconFor("sunny", true)).toBe("moon");
    expect(iconFor("partlycloudy", true)).toBe("pcn");
    expect(iconFor("lightning-rainy")).toBe("bolt");
    expect(iconFor("snowy-rainy")).toBe("snow");
    expect(iconFor("made-up")).toBe("cloud");
  });
  it("names the wind direction", () => {
    expect([0, 44, 90, 225, 350, -45].map(compass)).toEqual(["N", "NE", "E", "SW", "N", "NW"]);
  });
  it("rounds to whole degrees without -0", () => {
    expect([14.4, 14.5, -0.3, -1.6].map(roundTemp)).toEqual([14, 15, 0, -2]);
    expect(Object.is(roundTemp(-0.3), 0)).toBe(true);
  });
});

describe("now", () => {
  it("shows the entity's own numbers", () => {
    const m = buildWeather(hassOf([wx()]), cfg, {}, opts);
    expect([m.name, m.temp, m.conditionLabel, m.icon]).toEqual(["Swindon", 14, "Partly cloudy", "pc"]);
    expect(m.details.map((d) => [d.id, d.value, d.unit])).toEqual([["humidity", "72%", undefined], ["wind", "22", "km/h SW"], ["pressure", "1008", "hPa"]]);
  });
  it("only shows the details the entity has, and the ones chosen, at most four", () => {
    const a = buildWeather(hassOf([wx("sunny", { pressure: undefined })]), cfg, {}, opts);
    expect(a.details.map((d) => d.id)).toEqual(["humidity", "wind"]);
    const b = buildWeather(hassOf([wx("sunny", { cloud_coverage: 40, dew_point: 9.2 })]), { ...cfg, details: ["dew_point", "cloud", "humidity", "wind", "pressure"] }, {}, opts);
    expect(b.details.map((d) => [d.id, d.value])).toEqual([["dew_point", "9°"], ["cloud", "40%"], ["humidity", "72%"], ["wind", "22"]]);
  });
  it("has no feels-like unless the entity gives one", () => {
    expect(buildWeather(hassOf([wx()]), cfg, {}, opts).feels).toBeUndefined();
    expect(buildWeather(hassOf([wx("sunny", { apparent_temperature: 11.6 })]), cfg, {}, opts).feels).toBe(12);
  });
  it("copes with an unavailable entity", () => {
    const m = buildWeather(hassOf([wx("unavailable")]), cfg, { hourly }, opts);
    expect([m.available, m.conditionLabel, m.hours.length, m.details.length]).toEqual([false, "Unavailable", 0, 0]);
    expect(buildWeather(hassOf([]), cfg, {}, opts).available).toBe(false);
  });
});

describe("night", () => {
  it("follows the sun entity when there is one", () => {
    const sun = (s: string) => ent("sun.sun", s);
    expect(buildWeather(hassOf([wx("sunny"), sun("below_horizon")]), cfg, {}, opts).icon).toBe("moon");
    expect(buildWeather(hassOf([wx("sunny"), sun("above_horizon")]), cfg, {}, { now: new Date(2026, 9, 12, 23) }).icon).toBe("sun");
  });
  it("falls back to 20:00 to 06:00", () => {
    expect(buildWeather(hassOf([wx("partlycloudy")]), cfg, {}, { now: new Date(2026, 9, 12, 22) }).icon).toBe("pcn");
    expect(buildWeather(hassOf([wx("partlycloudy")]), cfg, {}, opts).icon).toBe("pc");
  });
  it("uses is_daytime on forecast hours", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { hourly: [{ datetime: at(12, 16), condition: "sunny", temperature: 13, is_daytime: false }] }, opts);
    expect(m.hours[1].icon).toBe("moon");
  });
});

describe("hours", () => {
  it("starts with Now, then the hours still to come", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { hourly }, { ...opts, hours: 4 });
    expect(m.hours.map((h) => h.label)).toEqual(["Now", "16:00", "17:00", "18:00"]);
    expect(m.hours[0].temp).toBe(14);
    expect(m.hours[1]).toMatchObject({ icon: "rain", temp: 13 });
  });
  it("is just Now when there is no hourly forecast", () => {
    expect(buildWeather(hassOf([wx()]), cfg, {}, opts).hours.length).toBe(1);
  });
});

describe("high and low", () => {
  it("come from today's daily forecast", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { daily }, opts);
    expect([m.hi, m.lo]).toEqual([16, 9]);
  });
  it("are worked out from the hours when there is no daily forecast", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { hourly }, opts);
    expect([m.hi, m.lo]).toEqual([14, 10]);
  });
});

describe("days", () => {
  it("labels today and then weekdays, and sizes the bars to the whole range", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { daily }, opts);
    expect(m.days.map((d) => d.label)).toEqual(["Today", "Tue", "Wed", "Thu"]);
    expect(m.days[0]).toMatchObject({ today: true, lo: 9, hi: 16, icon: "cloud" });
    expect(m.scale).toEqual([6, 16]);
  });
  it("leaves out days already gone and respects the limit", () => {
    const m = buildWeather(hassOf([wx()]), cfg, { daily: [{ datetime: at(10, 12), temperature: 1 }, ...daily] }, { ...opts, days: 2 });
    expect(m.days.map((d) => d.label)).toEqual(["Today", "Tue"]);
  });
});

describe("forecast types", () => {
  it("reads them from supported_features", () => {
    expect(forecastTypes(wx("sunny", { supported_features: 3 }))).toEqual(["hourly", "daily"]);
    expect(forecastTypes(wx("sunny", { supported_features: 1 }))).toEqual(["daily"]);
    expect(forecastTypes(wx("sunny", { supported_features: 0 }))).toEqual([]);
    expect(forecastTypes(wx("sunny", { supported_features: undefined }))).toEqual(["hourly", "daily"]);
  });
});

describe("sections", () => {
  it("defaults to current and hourly, in a fixed order", () => {
    expect(sectionsOf(cfg)).toEqual(["current", "hourly"]);
    expect(sectionsOf({ ...cfg, sections: ["weekly", "current"] })).toEqual(["current", "weekly"]);
    expect(sectionsOf({ ...cfg, sections: [] })).toEqual(["current", "hourly"]);
  });
  it("still understands the old week layout", () => {
    expect(sectionsOf({ ...cfg, layout: "week" })).toEqual(["current", "weekly"]);
    expect(sectionsOf({ ...cfg, layout: "week", sections: ["hourly"] })).toEqual(["hourly"]);
  });
  it("makes the card taller for each part", () => {
    const h = (s: Parameters<typeof neededHeight>[0]) => rowsFor(neededHeight(s));
    expect([h(["current", "hourly"]), h(["current"]), h(["hourly"]), h(["current", "weekly"]), h(["current", "hourly", "weekly"])]).toEqual([6, 5, 3, 9, 11]);
  });
  it("trims the week to the height left, between 2 and 7 days", () => {
    const s = ["current", "weekly"] as const;
    expect(weeklyRows(568, [...s], true, false)).toBe(7);
    expect(weeklyRows(376, [...s], true, true)).toBe(2);
    expect(weeklyRows(100, [...s], true, false)).toBe(2);
    expect(weeklyRows(376, ["weekly"], false, false)).toBe(7);
  });
});
