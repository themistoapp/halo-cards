import { describe, expect, it } from "vitest";
import "../src/index";
import { LIBRARY, linesFor, pickGreeting, toneAt, type Fired } from "../src/cards/today/greetings";
import {
  binDate, birthdayOf, boxesOf, buildAgile, buildBins, buildCalendar, buildMediaBox, buildTodayWeather, buildVehicleBox, minutesOf, parseBinDate, parseEvents, rank, triggersOf,
  type CalEvent, type Ranked,
} from "../src/cards/today/logic";
import { ent, hassOf } from "./helpers";

const T = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime(); // October 2026; the 13th is a Tuesday
const ev = (summary: string, s: number, e: number, extra: Partial<CalEvent> = {}): CalEvent =>
  ({ cal: "calendar.family", colour: "#e0568a", calName: "Family", summary, start: s, end: e, allDay: false, ...extra });

describe("greetings", () => {
  it("has lots of lines in every tone", () => {
    const all = Object.values(LIBRARY).flatMap((t) => t.lines.flat());
    expect(all.length).toBeGreaterThanOrEqual(280);
    for (const t of Object.values(LIBRARY)) for (const tone of t.lines) expect(tone.length).toBeGreaterThanOrEqual(2);
  });
  it("fills placeholders and drops lines it can't fill", () => {
    const lines = linesFor([{ id: "binsTonight", vars: { bin: "Recycling" } }, { id: "evLow", vars: { car: "e-Vivaro", pct: 22 } }], "polite", "");
    expect(lines).toContain("Bin night: Recycling.");
    expect(lines).toContain("The e-Vivaro is on 22%.");
    expect(lines.some((l) => l.includes("{"))).toBe(false); // "{bin} goes out tonight, {name}." needs a name
  });
  it("only adds the time-of-day lines when little else is going on", () => {
    const busy: Fired[] = [{ id: "rainNow" }, { id: "peak" }, { id: "evening" }];
    expect(linesFor(busy, "cheeky", "Sam")).not.toContain("Evening, legend.");
    expect(linesFor([{ id: "peak" }, { id: "evening" }], "cheeky", "Sam")).toContain("Evening, legend.");
  });
  it("adds your own lines in the right tone", () => {
    const own = [{ trigger: "morning" as const, text: "Up and at 'em, {name}." }, { trigger: "morning" as const, tone: "rude" as const, text: "Rude only" }];
    const polite = linesFor([{ id: "morning" }], "polite", "Sam", own);
    expect(polite).toContain("Up and at 'em, Sam.");
    expect(polite).not.toContain("Rude only");
  });
  it("keeps a line for the hour and moves on when tapped", () => {
    const lines = ["a", "b", "c", "d", "e"];
    const at = new Date(2026, 9, 13, 9, 5), later = new Date(2026, 9, 13, 9, 55), next = new Date(2026, 9, 13, 10, 5);
    expect(pickGreeting(lines, at)).toBe(pickGreeting(lines, later));
    expect(pickGreeting(lines, at)).not.toBe(pickGreeting(lines, next));
    expect(pickGreeting(lines, at, 1)).toBe(pickGreeting(lines, next));
    // Over a day each line comes round before any repeats.
    expect(new Set([0, 1, 2, 3, 4].map((h) => pickGreeting(lines, new Date(2026, 9, 13, h)))).size).toBe(5);
  });
  it("keeps Rude for after the watershed", () => {
    const wf = minutesOf("21:00:00", "21:00");
    expect(toneAt("rude", true, wf, new Date(2026, 9, 13, 14))).toBe("cheeky");
    expect(toneAt("rude", true, wf, new Date(2026, 9, 13, 21, 30))).toBe("rude");
    expect(toneAt("rude", true, wf, new Date(2026, 9, 13, 2))).toBe("rude");
    expect(toneAt("rude", false, wf, new Date(2026, 9, 13, 14))).toBe("rude");
    expect(toneAt("polite", true, wf, new Date(2026, 9, 13, 22))).toBe("polite");
  });
});

describe("calendar", () => {
  it("reads timed and all-day events", () => {
    const out = parseEvents([
      { summary: "Dentist", start: { dateTime: "2026-10-13T13:00:00+01:00" }, end: { dateTime: "2026-10-13T14:00:00+01:00" }, location: "Bath Road" },
      { summary: "Mum's birthday", start: { date: "2026-10-13" }, end: { date: "2026-10-14" } },
    ], { entity: "calendar.family", colour: "#e0568a", name: "Family" });
    expect(out[0]).toMatchObject({ summary: "Dentist", allDay: false, location: "Bath Road" });
    expect(out[1]).toMatchObject({ allDay: true, start: T(13, 0), end: T(14, 0) });
  });
  it("finds who has a birthday", () => {
    expect(["Mum's birthday", "Birthday: Tom", "Happy Birthday Ellie!", "Dentist"].map(birthdayOf)).toEqual(["Mum", "Tom", "Ellie", undefined]);
  });
  const day = [ev("Drop-off", T(13, 8, 15), T(13, 8, 45)), ev("Stand-up", T(13, 9, 30), T(13, 10, 15), { location: "Teams" }), ev("Dentist", T(13, 13), T(13, 14)),
    ev("Pick-up", T(13, 15, 15), T(13, 15, 45)), ev("Swimming", T(13, 17, 30), T(13, 18, 30)), ev("Boiler", T(14, 10), T(14, 12)),
    ev("Mum's birthday", T(13, 0), T(14, 0), { allDay: true })];
  it("counts down to the next event, soon within the hour", () => {
    const m = buildCalendar(day, T(13, 7, 40))!;
    expect([m.header, m.pill?.text, m.tier, m.soon?.mins]).toEqual(["Next up", "in 35 min", 2, 35]);
    expect(m.events.map((e) => e.title)).toEqual(["Drop-off", "Stand-up"]);
    expect(m.events[1].meta).toBe("Teams");
    expect(m.more).toBe("+3 more today · Mum's birthday");
    expect([m.todayCount, m.birthday]).toEqual([5, "Mum"]);
  });
  it("shows what's on now with time left", () => {
    const m = buildCalendar(day, T(13, 13, 20))!;
    expect([m.header, m.pill, m.tier, m.now, m.events[0].progress]).toEqual(["Now", { text: "40 min left", solid: true }, 0, "Dentist", 33]);
  });
  it("looks ahead to tomorrow once today is done", () => {
    const m = buildCalendar(day, T(13, 19, 30))!;
    expect(m.header).toMatch(/^Tomorrow · Wed 14/);
    expect([m.pill?.text, m.tier]).toEqual(["from 10:00", 3]);
  });
  it("is hidden with nothing coming up", () => {
    expect(buildCalendar([], T(13, 9))).toBeUndefined();
  });
});

describe("bins", () => {
  const now = T(13, 7, 40);
  it("reads dates in the forms integrations use", () => {
    expect(parseBinDate("2026-10-14", now)).toBe(T(14, 0));
    expect(parseBinDate("14/10/2026", now)).toBe(T(14, 0));
    expect(parseBinDate("Tomorrow", now)).toBe(T(14, 0));
    expect(parseBinDate("in 3 days", now)).toBe(T(16, 0));
    expect(parseBinDate(8, now)).toBe(T(21, 0));
    expect(parseBinDate("soon", now)).toBeUndefined();
  });
  it("reads UK Bin Collection Data, Waste Collection Schedule and bin calendars", () => {
    const hass = hassOf([
      ent("sensor.recycling", "Tomorrow", { next_collection: "14/10/2026", days: 1 }),
      ent("sensor.waste", "in 8 days", { daysTo: 8 }),
      ent("calendar.bins", "off", {}),
    ]);
    expect(binDate(hass, { name: "Recycling", entity: "sensor.recycling" }, now)).toBe(T(14, 0));
    expect(binDate(hass, { name: "Waste", entity: "sensor.waste" }, now)).toBe(T(21, 0));
    const cal = [ev("General waste collection", T(21, 7), T(21, 8), { cal: "calendar.bins" }), ev("Recycling collection", T(14, 7), T(14, 8), { cal: "calendar.bins" })];
    expect(binDate(hass, { name: "Recycling", entity: "calendar.bins", match: "recycl" }, now, cal)).toBe(T(14, 0));
    expect(binDate(hass, { name: "Waste", entity: "calendar.bins", match: "general|refuse" }, now, cal)).toBe(T(21, 0));
  });
  const rows = [{ name: "Waste", entity: "sensor.waste", colour: "black" }, { name: "Recycling", entity: "sensor.recycling", colour: "blue" }];
  const opts = { within: 48, outFrom: 17 * 60, dark: false };
  it("shows within 48 hours, soonest first, the rest faded", () => {
    const m = buildBins(rows, [T(21, 0), T(14, 0)], now, opts)!;
    expect(m.bins.map((b) => [b.name, b.count, b.unit, b.later])).toEqual([["Recycling", "1", "day", false], ["Waste", "8", "days", true]]);
    expect([m.pill, m.tier]).toEqual([undefined, 2]);
  });
  it("says put it out tonight from the reminder time", () => {
    const m = buildBins(rows, [T(21, 0), T(14, 0)], T(13, 19, 30), opts)!;
    expect([m.pill, m.tier, m.bins[0].line, m.bins[0].out, m.first]).toEqual(["Out tonight", 1, "Out tonight", true, { name: "Recycling", days: 1, out: true }]);
  });
  it("is hidden when the next collection is further off, and done after midday on the day", () => {
    expect(buildBins(rows, [T(21, 0), T(16, 0)], now, opts)).toBeUndefined();
    expect(buildBins(rows, [T(21, 0), T(13, 0)], T(13, 8), opts)?.pill).toBe("Today");
    expect(buildBins(rows, [T(21, 0), T(13, 0)], T(13, 13), opts)).toBeUndefined();
  });
});

describe("vehicles", () => {
  const hass = (soc: string, charging = "off") => hassOf([ent("sensor.van_soc", soc, { unit_of_measurement: "%" }), ent("sensor.van_range", "48", { unit_of_measurement: "mi" }), ent("binary_sensor.van_charging", charging)]);
  const row = { name: "e-Vivaro", level: "sensor.van_soc", range: "sensor.van_range", charging: "binary_sensor.van_charging" };
  it("shows only below the low level and not while charging", () => {
    expect(buildVehicleBox(hass("22"), row, 30)).toMatchObject({ name: "e-Vivaro", kind: "ev", pct: 22, range: "48 mi" });
    expect(buildVehicleBox(hass("64"), row, 30)).toBeUndefined();
    expect(buildVehicleBox(hass("22", "on"), row, 30)).toBeUndefined();
  });
});

describe("agile", () => {
  const rates = (day: number, prices: number[]) => prices.map((p, i) => ({ start: new Date(T(day, 0) + i * 1_800_000).toISOString(), end: new Date(T(day, 0) + (i + 1) * 1_800_000).toISOString(), value_inc_vat: p / 100 }));
  const today = Array.from({ length: 48 }, (_, i) => (i >= 27 && i <= 29 ? 6 + (i - 27) : i >= 32 && i < 38 ? 38 : 20));
  const hass = (prices = today) => hassOf([ent("event.today", "x", { rates: rates(13, prices) })]);
  const cfg = { type: "x", rates_today: "event.today", agile_slots: 3 };
  it("lists the cheapest slots still to come, in time order", () => {
    const m = buildAgile(hass(), cfg, T(13, 7, 40))!;
    expect(m.title).toBe("Cheapest today");
    expect(m.slots.map((s) => [s.start, s.price])).toEqual([["13:30", "6.0p"], ["14:00", "7.0p"], ["14:30", "8.0p"]]);
    expect(m.tier).toBe(3);
  });
  it("marks the next one and calls it soon", () => {
    const m = buildAgile(hass(), cfg, T(13, 13, 5))!;
    expect([m.slots[0].pill, m.tier, m.cheapSoon]).toEqual(["Next", 2, "13:30"]);
  });
  it("is Now while you're in one, and spots peak and plunge", () => {
    const m = buildAgile(hass(), cfg, T(13, 13, 40))!;
    expect([m.slots[0].pill, m.tier]).toEqual(["Now", 0]);
    expect(buildAgile(hass(), cfg, T(13, 16, 10))!.peak).toBe(true);
    const neg = today.map((p, i) => (i === 26 ? -2.1 : p));
    expect(buildAgile(hass(neg), cfg, T(13, 9))!.slots.find((s) => s.negative)).toMatchObject({ pill: "Plunge", price: "−2.1p" });
  });
});

describe("weather", () => {
  const hours = (from: number, wet: number[]) => Array.from({ length: 10 }, (_, i) => ({ datetime: new Date(T(13, from + i)).toISOString(), condition: wet.includes(from + i) ? "rainy" : "cloudy", temperature: 12, precipitation_probability: wet.includes(from + i) ? 80 : 10 }));
  it("says when rain starts, soon within two hours", () => {
    const hass = hassOf([ent("weather.home", "cloudy", { temperature: 14.6 })]);
    const m = buildTodayWeather(hass, "weather.home", { hourly: hours(14, [15, 16]) }, new Date(T(13, 13, 20)))!;
    expect([m.pill, m.tier, m.rainAt, m.temp]).toEqual(["Rain from 15:00", 2, "15:00", 15]);
    expect(m.hours[2]).toMatchObject({ label: "15", note: "80%" });
  });
  it("says when it dries up", () => {
    const hass = hassOf([ent("weather.home", "rainy", { temperature: 12 })]);
    const m = buildTodayWeather(hass, "weather.home", { hourly: hours(20, [20]) }, new Date(T(13, 19, 30)))!;
    expect([m.pill, m.rainNow, m.dryAt, m.tier]).toEqual(["Dry from 21:00", true, "21:00", 3]);
  });
});

describe("now playing", () => {
  it("shows the player that started last", () => {
    const a = { ...ent("media_player.kitchen", "playing", { media_title: "Midnight City", media_artist: "M83", friendly_name: "Kitchen" }), last_changed: "2026-10-13T18:00:00Z" };
    const b = { ...ent("media_player.lounge", "playing", { media_title: "6 Music", friendly_name: "Living room" }), last_changed: "2026-10-13T19:00:00Z" };
    const idle = ent("media_player.study", "idle", {});
    const hass = hassOf([a, b, idle]);
    expect(buildMediaBox(hass, ["media_player.kitchen", "media_player.lounge", "media_player.study"])?.room).toBe("Living room");
    expect(buildMediaBox(hass, ["media_player.study"])).toBeUndefined();
  });
});

describe("ranking", () => {
  const r = (key: string, tier: number, order: number, half = false): Ranked<null> => ({ key, box: "calendar", tier, order, half, data: null });
  it("puts now first, then needs doing, soon and later, pairing half boxes", () => {
    const out = rank([r("cal", 3, 0), r("wx", 3, 1), r("bins", 1, 2, true), r("van", 1, 3, true), r("agile", 3, 4, true), r("media", 0, 5)]);
    expect(out.map((x) => x.key)).toEqual(["media", "bins", "van", "cal", "wx", "agile"]);
    expect(out.find((x) => x.key === "agile")?.solo).toBe(true);
  });
  it("pulls the next half box up beside a lone one", () => {
    const out = rank([r("m140i", 1, 3, true), r("cal", 3, 0), r("agile", 3, 4, true)]);
    expect(out.map((x) => x.key)).toEqual(["m140i", "agile", "cal"]);
    expect(out.some((x) => x.solo)).toBe(false);
  });
  it("leaves out boxes that are unticked", () => {
    expect(boxesOf({ type: "x" })).toHaveLength(6);
    expect(boxesOf({ type: "x", boxes: ["weather", "calendar"] })).toEqual(["weather", "calendar"]);
    expect(boxesOf({ type: "x", boxes: [] })).toEqual([]);
  });
});

describe("what sets off a greeting", () => {
  it("lists the pressing things first and the time of day last", () => {
    const now = new Date(T(13, 19, 30));
    const bins = buildBins([{ name: "Recycling", entity: "x", colour: "blue" }], [T(14, 0)], now.getTime(), { within: 48, outFrom: 17 * 60, dark: false });
    const ids = triggersOf({ now, bins, vehicles: [{ name: "e-Vivaro", kind: "ev", pct: 22, entity: "x" }], hasCalendars: true }).map((f) => f.id);
    expect(ids[0]).toBe("binsTonight");
    expect(ids).toContain("evLow");
    expect(ids).not.toContain("nothing"); // too late in the day to say so
    expect(ids[ids.length - 1]).toBe("evening");
  });
  it("knows nights, weekends and empty days", () => {
    const sun = new Date(2026, 9, 18, 9, 10);
    expect(triggersOf({ now: sun, vehicles: [], hasCalendars: true }).map((f) => f.id)).toEqual(["nothing", "weekend", "morning"]);
    expect(triggersOf({ now: new Date(2026, 9, 13, 23, 45), vehicles: [], hasCalendars: false }).map((f) => f.id)).toEqual(["late", "evening"]);
  });
});

describe("editors", () => {
  it("adds a calendar row that shows before an entity is picked", async () => {
    const ed = document.createElement("halo-today-card-editor") as any;
    ed.hass = hassOf([]);
    ed.setConfig({ type: "x", calendars: ["calendar.family"] });
    document.body.append(ed);
    await ed.updateComplete;
    let emitted: any;
    ed.addEventListener("config-changed", (e: CustomEvent) => { emitted = e.detail.config; });
    const details = [...ed.shadowRoot.querySelectorAll("details")] as HTMLDetailsElement[];
    const cal = details.find((d) => d.querySelector("summary")?.textContent?.startsWith("Calendars"))!;
    (cal.querySelector("button.add") as HTMLButtonElement).click();
    await ed.updateComplete;
    expect(emitted.calendars).toHaveLength(2);
    expect(cal.querySelectorAll(".row").length).toBe(2);
    ed.remove();
  });
  it("unticks and reorders boxes", async () => {
    const ed = document.createElement("halo-today-card-editor") as any;
    ed.hass = hassOf([]);
    ed.setConfig({ type: "x" });
    document.body.append(ed);
    await ed.updateComplete;
    let emitted: any;
    ed.addEventListener("config-changed", (e: CustomEvent) => { emitted = e.detail.config; });
    const box = ed.shadowRoot.querySelector(".bxrow input") as HTMLInputElement;
    box.checked = false; box.dispatchEvent(new Event("change"));
    expect(emitted.boxes).toEqual(["weather", "bins", "vehicles", "agile", "media"]);
    ed.remove();
  });
});
