import { describe, expect, it, vi } from "vitest";
import "../src/index";
import { badgeAction, badgeRule, buildBooleanBadge, buildGaugeBadge, buildThermostatBadge, buildWeatherBadge, rainToday, softBloom } from "../src/cards/badges/logic";
import { cleanBadge } from "../src/cards/badges/editors";
import { hexToHsl, shades } from "../src/shared/colour";
import { ent, hassOf } from "./helpers";

const climate = (state: string, a: Record<string, unknown> = {}) => ent("climate.hall", state, {
  friendly_name: "Hallway", hvac_modes: ["heat", "cool", "heat_cool", "auto", "off"], current_temperature: 19.4, temperature: 22, min_temp: 9, max_temp: 32, ...a,
});
const th = (e: ReturnType<typeof ent>, cfg: Record<string, unknown> = {}) => buildThermostatBadge(hassOf([e]), { type: "x", entity: e.entity_id, ...cfg });

describe("colour rules", () => {
  it("takes the first rule met, and a rule with no bounds catches the rest", () => {
    const rules = [{ below: 18, colour: "blue" }, { below: 20, colour: "yellow" }, { colour: "red" }];
    expect([15, 19, 25].map((v) => badgeRule(rules, v))).toEqual(["blue", "yellow", "red"]);
    expect(badgeRule([{ above: 10, below: 20, colour: "green" }], 25)).toBeUndefined();
  });
});

describe("thermostat badge, climate entity: the thermostat card's logic", () => {
  it("heating: ticks lit from the room to the target, bloom rising in the heat colour", () => {
    const m = th(climate("heat", { hvac_action: "heating" }));
    expect([m.bloom, m.bloomHex, m.tgt, m.lit]).toEqual(["active", "#e8742f", 22, { from: 19.5, to: 22, band: false }]);
  });
  it("cooling: blue, rising", () => {
    const m = th(climate("cool", { hvac_action: "cooling", current_temperature: 24, temperature: 21 }));
    expect([m.bloom, m.bloomHex, m.lit?.from, m.lit?.to]).toEqual(["active", "#2f86cf", 21, 24]);
  });
  it("on at target: wide and low in the mode's colour, nothing lit, target tick shown", () => {
    const m = th(climate("heat", { hvac_action: "idle", current_temperature: 22 }));
    expect([m.bloom, m.bloomHex, m.lit, m.tgt]).toEqual(["rest", "#e8742f", undefined, 22]);
  });
  it("auto at target: no bloom, as the card", () => {
    const m = th(climate("auto", { hvac_action: "idle", current_temperature: 22 }));
    expect([m.bloom, m.bloomHex]).toEqual(["none", undefined]);
  });
  it("off: no bloom, no lit ticks, no target tick, the room temperature still shown", () => {
    const m = th(climate("off", { hvac_action: "off" }));
    expect([m.bloom, m.lit, m.tgt, m.cur, m.label]).toEqual(["none", undefined, undefined, 19.5, "19.5°, off"]);
  });
  it("heat/cool range: both setpoints, the range as a band", () => {
    const m = th(climate("heat_cool", { temperature: null, target_temp_low: 19.5, target_temp_high: 24, hvac_action: "heating", current_temperature: 18.7 }));
    expect([m.low, m.high, m.tgt, m.lit]).toEqual([19.5, 24, undefined, { from: 19.5, to: 24, band: true }]);
  });
  it("can take its bloom colour from the temperature bands instead, keeping the card's shape", () => {
    const m = th(climate("heat", { hvac_action: "heating" }), { bloom_colour: "temperature" });
    expect([m.bloom, m.bloomHex]).toEqual(["active", "#c28a0c"]);
    expect(th(climate("off"), { bloom_colour: "temperature" }).bloom).toBe("none");
  });
  it("uses the thermostat's own range for the dial", () => {
    expect([th(climate("heat")).min, th(climate("heat")).max]).toEqual([9, 32]);
  });
});

describe("thermostat badge, temperature sensor", () => {
  const sensor = (v: string) => ent("sensor.lounge_temp", v, { friendly_name: "Lounge", unit_of_measurement: "°C", device_class: "temperature" });
  it("lies low in the band's colour, with no target", () => {
    const m = th(sensor("17.2"));
    expect([m.cur, m.bloom, m.bloomHex, m.tgt, m.climate, m.min, m.max]).toEqual([17, "rest", "#2f7bff", undefined, false, 10, 30]);
    expect(th(sensor("23")).bloomHex).toBe("#d6453d");
  });
  it("follows your own rules and range", () => {
    const m = th(sensor("20"), { colour_rules: [{ above: 19, colour: "green" }], min: 15, max: 25 });
    expect([m.bloomHex, m.min, m.max]).toEqual(["#1f9d63", 15, 25]);
  });
  it("has no bloom when unavailable", () => {
    expect(th(sensor("unavailable")).bloom).toBe("none");
  });
});

describe("thermostat bloom is softer than the card's", () => {
  it("keeps the hue at well under the saturation", () => {
    const card = shades(hexToHsl("#e8742f")!.h, hexToHsl("#e8742f")!.s, false), badge = softBloom("#e8742f", false)!;
    expect(hexToHsl(badge.c0)!.s).toBeLessThan(hexToHsl(card.c0)!.s * 0.7);
    expect(Math.abs(hexToHsl(badge.c0)!.h - hexToHsl(card.c0)!.h)).toBeLessThan(0.02);
  });
});

describe("gauge badge", () => {
  const co2 = (v: string) => ent("sensor.co2", v, { friendly_name: "Office CO₂", unit_of_measurement: "ppm" });
  it("places the value between min and max and colours it by rule", () => {
    const m = buildGaugeBadge(hassOf([co2("1200")]), { type: "x", entity: "sensor.co2", min: 400, max: 2000, colour_rules: [{ below: 800, colour: "green" }, { below: 1500, colour: "yellow" }, { colour: "red" }] });
    expect([m.value, m.unit, m.frac, m.colour]).toEqual(["1200", "ppm", 0.5, "yellow"]);
  });
  it("defaults to 0 to 100, clamps, and reads attributes", () => {
    const h = hassOf([ent("sensor.bat", "120", { unit_of_measurement: "%" }), climate("heat", { current_humidity: 48.2 })]);
    expect(buildGaugeBadge(h, { type: "x", entity: "sensor.bat" }).frac).toBe(1);
    const m = buildGaugeBadge(h, { type: "x", entity: "climate.hall", attribute: "current_humidity" });
    expect(m.value).toBe("48.2");
    expect(m.frac).toBeCloseTo(0.482);
  });
  it("shows a dash when unavailable", () => {
    expect(buildGaugeBadge(hassOf([co2("unknown")]), { type: "x", entity: "sensor.co2" })).toMatchObject({ available: false, value: "–" });
  });
});

describe("weather badge", () => {
  const now = new Date(2026, 9, 17, 15, 0);
  const w = ent("weather.home", "partlycloudy", { friendly_name: "Home", temperature: 14.4, supported_features: 1 });
  it("now: the temperature, with the conditions as the icon", () => {
    const m = buildWeatherBadge(hassOf([w, ent("sun.sun", "above_horizon")]), { type: "x", entity: "weather.home" }, {}, now);
    expect([m.value, m.icon, m.label]).toEqual(["14°", "pc", "14°, Partly cloudy"]);
  });
  it("sun: the time of whichever comes next", () => {
    const sun = (rise: Date, set: Date) => hassOf([ent("sun.sun", "above_horizon", { next_rising: rise.toISOString(), next_setting: set.toISOString() })]);
    const a = buildWeatherBadge(sun(new Date(2026, 9, 18, 7, 34), new Date(2026, 9, 17, 18, 12)), { type: "x", show: "sun" });
    expect([a.name, a.value, a.icon]).toEqual(["Sunset", "18:12", "sunset"]);
    const b = buildWeatherBadge(sun(new Date(2026, 9, 18, 7, 34), new Date(2026, 9, 18, 18, 10)), { type: "x", show: "sun" });
    expect([b.name, b.value]).toEqual(["Sunrise", "07:34"]);
  });
  it("rain: today's daily chance, else the highest of today's hours left", () => {
    expect(rainToday({ daily: [{ datetime: new Date(2026, 9, 17, 12).toISOString(), precipitation_probability: 40 }] }, now)).toBe(40);
    const hourly = [13, 16, 18, 23].map((h, i) => ({ datetime: new Date(2026, 9, 17, h).toISOString(), precipitation_probability: [90, 20, 55, 10][i] }));
    expect(rainToday({ hourly }, now)).toBe(55);
    expect(rainToday({}, now)).toBeUndefined();
    const m = buildWeatherBadge(hassOf([w]), { type: "x", entity: "weather.home", show: "rain" }, { daily: [{ datetime: new Date(2026, 9, 17).toISOString(), precipitation_probability: 35 }] }, now);
    expect([m.name, m.value, m.rain]).toEqual(["Rain today", "35%", 35]);
  });
});

describe("on/off badge", () => {
  it("reads on and off for the usual states", () => {
    const b = (state: string, id = "light.lamp") => buildBooleanBadge(hassOf([ent(id, state, { friendly_name: "Lamp" })]), { type: "x", entity: id });
    expect([b("on").on, b("off").on, b("open", "binary_sensor.door").on, b("closed", "cover.garage").on, b("not_home", "person.sam").on]).toEqual([true, false, true, false, false]);
    expect([b("on").state, b("unavailable").available]).toEqual(["On", false]);
  });
  it("taps toggle what can be toggled, and open more-info otherwise", () => {
    expect(badgeAction({}, "tap", true).action).toBe("toggle");
    expect(badgeAction({}, "tap", false).action).toBe("more-info");
    expect(badgeAction({}, "hold").action).toBe("more-info");
    expect(badgeAction({ tap_action: { action: "navigate", navigation_path: "/x" } }, "tap", true).action).toBe("navigate");
  });
});

describe("editor", () => {
  it("drops defaults and empty fields", () => {
    expect(cleanBadge({ entity: "light.x", theme: "plain", show_name: true, shadow: false, name: "", colour_rules: [] }, { theme: "plain", show_name: true, shadow: true }))
      .toEqual({ entity: "light.x", shadow: false });
  });
});

async function mount(tag: string, config: Record<string, unknown>, list: ReturnType<typeof ent>[], dark = false) {
  const el = document.createElement(tag) as any;
  el.setConfig({ type: `custom:${tag}`, ...config });
  const hass = { ...hassOf(list), themes: { darkMode: dark }, callService: vi.fn() };
  el.hass = hass;
  document.body.append(el);
  await el.updateComplete;
  return { el, hass, pill: el.shadowRoot.querySelector(".hb") as HTMLElement };
}

describe("badges render", () => {
  it("are registered as Home Assistant badges", () => {
    expect((window as any).customBadges.map((b: any) => b.type)).toEqual(["halo-thermostat-badge", "halo-gauge-badge", "halo-weather-badge", "halo-boolean-badge"]);
  });
  it("thermostat: a dial with the room temperature in the middle and a bloom while heating", async () => {
    const { el, pill } = await mount("halo-thermostat-badge", { entity: "climate.hall" }, [climate("heat", { hvac_action: "heating" })]);
    expect(pill.querySelector(".dial text")!.textContent).toBe("19.5");
    expect(pill.querySelector(".bloom")).not.toBeNull();
    expect(pill.querySelectorAll(".tk.lit").length).toBeGreaterThan(0);
    expect(pill.querySelector(".nm")!.textContent).toBe("Hallway");
    el.remove();
  });
  it("thermostat off: no bloom; without its name it is a round badge", async () => {
    const { el, pill } = await mount("halo-thermostat-badge", { entity: "climate.hall", show_name: false }, [climate("off")]);
    expect(pill.querySelector(".bloom")).toBeNull();
    expect(pill.querySelector(".tgt")).toBeNull();
    expect(pill.classList.contains("icon-only")).toBe(true);
    el.remove();
  });
  it("gauge: value in the ring, or the icon with the value beside it", async () => {
    const list = [ent("sensor.bat", "64", { unit_of_measurement: "%", friendly_name: "Battery" })];
    const a = await mount("halo-gauge-badge", { entity: "sensor.bat" }, list);
    expect(a.pill.querySelector(".ring text")!.textContent).toBe("64%");
    expect(a.pill.querySelector(".bloom")).toBeNull();
    const b = await mount("halo-gauge-badge", { entity: "sensor.bat", inside: "icon", icon: "mdi:battery" }, list);
    expect(b.pill.querySelector(".ring text")).toBeNull();
    expect(b.pill.querySelector(".st")!.textContent).toBe("64%");
    a.el.remove(); b.el.remove();
  });
  it("on/off: pressed in when on, a gradient look for on, tap toggles", async () => {
    const { el, hass, pill } = await mount("halo-boolean-badge", { entity: "light.lamp", on_colour: "ember" }, [ent("light.lamp", "on", { friendly_name: "Lamp" })]);
    expect(pill.className).toContain("on");
    expect(pill.className).toContain("g-ember");
    pill.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(hass.callService).toHaveBeenCalledWith("homeassistant", "toggle", { entity_id: "light.lamp" });
    el.remove();
  });
  it("weather sun needs no weather entity", async () => {
    const { el, pill } = await mount("halo-weather-badge", { show: "sun" }, [ent("sun.sun", "above_horizon", { next_rising: new Date(Date.now() + 9e6).toISOString(), next_setting: new Date(Date.now() + 3e6).toISOString() })]);
    expect(pill.querySelector(".nm")!.textContent).toBe("Sunset");
    el.remove();
  });
});
