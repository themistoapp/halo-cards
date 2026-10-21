import { describe, expect, it } from "vitest";
import { attributeUnit, buildTile, defaultScale, displayOf, gaugeBands, graphHours, isOnOff, matchRule, readValue, tapDefault, valueOptions, type HaloEntityConfig } from "../src/cards/entity/logic";
import { actionFor } from "../src/shared/actions";
import { cleanConfig } from "../src/cards/entity/editor";
import { cleanCss, sanitizeSvg, svgKind, themeColour } from "../src/cards/entity/svg-icon";
import { ent, hassOf } from "./helpers";

const hass = () => hassOf([
  ent("sensor.power", "1800", { friendly_name: "House", unit_of_measurement: "W", device_class: "power", state_class: "measurement" }),
  ent("sensor.temp", "19.4567", { unit_of_measurement: "°C", device_class: "temperature" }),
  ent("climate.hall", "heat", { friendly_name: "Hallway", current_temperature: 19.4, current_humidity: 48, temperature: 22, hvac_modes: ["heat", "off"], hvac_action: "heating", min_temp: 7 }),
  ent("weather.home", "rainy", { temperature: 12, temperature_unit: "°C", wind_speed: 14.4, wind_speed_unit: "km/h", forecast: [] }),
  ent("sensor.dead", "unavailable", { friendly_name: "Dead" }),
  ent("binary_sensor.door", "off", { friendly_name: "Door", tampered: false }),
  ent("binary_sensor.motion", "on", { friendly_name: "Motion", device_class: "motion" }),
  ent("switch.kettle", "on", { friendly_name: "Kettle" }),
  ent("light.lamp", "off", { friendly_name: "Lamp", brightness: null }),
  ent("light.dead", "unavailable", {}),
  ent("sensor.soc", "64", { unit_of_measurement: "%" }),
  ent("number.reserve", "30", { min: 10, max: 90, step: 5 }),
]);

describe("readValue", () => {
  const h = hass();
  it("reads a numeric state with its unit, without thousands separators", () => {
    expect(readValue(h, h.states["sensor.power"], { entity: "sensor.power" })).toEqual({ value: "1800", unit: "W", available: true, num: 1800 });
  });
  it("uses decimals from config, else the entity's display precision, else up to two", () => {
    expect(readValue(h, h.states["sensor.temp"], { entity: "sensor.temp" }).value).toBe("19.46");
    expect(readValue(h, h.states["sensor.temp"], { entity: "sensor.temp", decimals: 1 }).value).toBe("19.5");
    const withPrecision = { ...h, entities: { "sensor.temp": { display_precision: 0 } } };
    expect(readValue(withPrecision, h.states["sensor.temp"], { entity: "sensor.temp" }).value).toBe("19");
  });
  it("reads an attribute and guesses its unit", () => {
    expect(readValue(h, h.states["climate.hall"], { entity: "climate.hall", attribute: "current_humidity" })).toMatchObject({ value: "48", unit: "%" });
    expect(readValue(h, h.states["weather.home"], { entity: "weather.home", attribute: "wind_speed" })).toMatchObject({ value: "14.4", unit: "km/h" });
    expect(readValue(h, h.states["weather.home"], { entity: "weather.home", attribute: "temperature" })).toMatchObject({ value: "12", unit: "°C" });
  });
  it("lets the unit be overridden, including to nothing", () => {
    expect(readValue(h, h.states["sensor.power"], { entity: "sensor.power", unit: "watts" }).unit).toBe("watts");
  });
  it("tidies text values and booleans when Home Assistant can't format them", () => {
    expect(readValue(h, h.states["climate.hall"], { entity: "climate.hall", attribute: "hvac_action" }).value).toBe("Heating");
    expect(readValue(h, h.states["binary_sensor.door"], { entity: "binary_sensor.door", attribute: "tampered" }).value).toBe("No");
  });
  it("prefers Home Assistant's own formatting for text", () => {
    const fmt = { ...h, formatEntityState: () => "Rain" };
    expect(readValue(fmt, h.states["weather.home"], { entity: "weather.home" }).value).toBe("Rain");
  });
  it("shows a dash when unavailable, missing, or the attribute is gone", () => {
    expect(readValue(h, h.states["sensor.dead"], { entity: "sensor.dead" })).toEqual({ value: "–", unit: "", available: false });
    expect(readValue(h, undefined, { entity: "sensor.nope" }).available).toBe(false);
    expect(readValue(h, h.states["climate.hall"], { entity: "climate.hall", attribute: "gone" })).toEqual({ value: "–", unit: "", available: true });
    expect(readValue(h, h.states["weather.home"], { entity: "weather.home", attribute: "forecast" }).value).toBe("–");
  });
});

const tile = (cfg: Partial<HaloEntityConfig>) => buildTile(hass(), { type: "x", entity: "sensor.power", ...cfg });

describe("buildTile", () => {
  it("names from the config, the attribute, or the friendly name", () => {
    expect([tile({}), tile({ entity: "climate.hall", attribute: "current_humidity" }), tile({ name: "Hall" }), tile({ entity: "sensor.temp" })].map((t) => t.name))
      .toEqual(["House", "Current humidity", "Hall", "Temp"]);
  });
  it("picks icons: chosen, then by attribute, then the state icon", () => {
    expect([tile({}), tile({ entity: "climate.hall", attribute: "current_humidity" }), tile({ icon: "mdi:home-thermometer" })].map((t) => [t.icon, t.stateIcon]))
      .toEqual([["mdi:flash", true], ["mdi:water-percent", false], ["mdi:home-thermometer", false]]);
    expect(tile({ icon_svg: "  <svg></svg> " }).svg).toBe("<svg></svg>");
  });
  it("keeps icon and graph colours apart", () => {
    const t = tile({ icon_colour: "orange", graph_colour: "#123456" });
    expect([t.iconColour, t.graphColour]).toEqual(["orange", "#123456"]);
  });
  it("lets a colour rule recolour both", () => {
    const rules = [{ above: 2000, colour: "red" }, { above: 1000, colour: "orange" }];
    const t = tile({ icon_colour: "teal", graph_colour: "teal", colour_rules: rules });
    expect([t.iconColour, t.graphColour]).toEqual(["orange", "orange"]);
    expect(tile({ entity: "sensor.temp", icon_colour: "teal", colour_rules: rules }).iconColour).toBe("teal");
  });
});

describe("colour rules", () => {
  it("takes the first rule met: above, below, or a band", () => {
    const rules = [{ below: 0, colour: "blue" }, { above: 10, below: 20, colour: "green" }, { above: 20, colour: "red" }];
    expect([-5, 0, 15, 25].map((v) => matchRule(rules, v))).toEqual(["blue", undefined, "green", "red"]);
  });
  it("ignores rules with no bound or no colour", () => {
    expect(matchRule([{ colour: "red" }, { above: 1, colour: "" }], 5)).toBeUndefined();
    expect(matchRule(undefined, 5)).toBeUndefined();
  });
});

describe("graph", () => {
  it("is only for a numeric state, not an attribute or text", () => {
    expect(tile({ graph: true }).graph).toBeDefined();
    expect(tile({ graph: true, entity: "climate.hall", attribute: "current_humidity" }).graph).toBeUndefined();
    expect(tile({ graph: true, entity: "binary_sensor.door" }).graph).toBeUndefined();
    expect(tile({ graph: true, entity: "sensor.dead" }).graph).toBeUndefined();
    expect(tile({}).graph).toBeUndefined();
  });
  it("defaults to 24 hours, kept between 1 and 168", () => {
    expect([undefined, 0, 6, 500, 2.4].map((h) => graphHours(h))).toEqual([24, 24, 6, 168, 2]);
  });
  it("uses hourly statistics over a day, when the sensor has them", () => {
    expect(tile({ graph: true, graph_hours: 72 }).graph?.statistics).toBe(true);
    expect(tile({ graph: true }).graph?.statistics).toBe(false);
    expect(tile({ graph: true, graph_hours: 72, entity: "sensor.temp" }).graph?.statistics).toBe(false);
  });
  it("starts power at zero, runs percentages 0 to 100 and fits the rest, unless told", () => {
    const h = hass();
    expect(defaultScale(h.states["sensor.power"], "W")).toBe("zero");
    expect(defaultScale(h.states["sensor.temp"], "°C")).toBe("range");
    expect(defaultScale(h.states["sensor.temp"], "%")).toBe("percent");
    expect([defaultScale(h.states["sensor.temp"], "kWh"), defaultScale(h.states["sensor.temp"], "£")]).toEqual(["zero", "zero"]);
    expect(tile({ graph: true, graph_scale: "range", graph_min: 0 }).graph).toMatchObject({ scale: "range", min: 0 });
  });
});

describe("gauge", () => {
  it("is picked with display, and old graph: true still means a graph", () => {
    expect([{}, { graph: true }, { display: "gauge" }, { graph: true, display: "none" }, { display: "bogus" }].map((c) => displayOf({ type: "x", entity: "e", ...c } as HaloEntityConfig)))
      .toEqual(["none", "graph", "gauge", "none", "none"]);
    expect(tile({ display: "gauge" }).graph).toBeUndefined();
    expect(tile({ display: "graph" }).gauge).toBeUndefined();
  });
  it("runs percentages 0 to 100 and number entities over their own range, unless told", () => {
    expect(tile({ entity: "sensor.soc", display: "gauge" }).gauge).toMatchObject({ min: 0, max: 100, frac: 0.64, style: "ring", labels: true });
    expect(tile({ entity: "number.reserve", display: "gauge" }).gauge).toMatchObject({ min: 10, max: 90, frac: 0.25 });
    expect(tile({ entity: "number.reserve", display: "gauge", gauge_max: 50 }).gauge).toMatchObject({ min: 10, max: 50, frac: 0.5 });
    expect(tile({ display: "gauge", gauge_min: 0, gauge_max: 3600, gauge_style: "semicircle" }).gauge).toMatchObject({ frac: 0.5, style: "semicircle" });
  });
  it("pins readings outside the range at the ends and copes with a range of nothing", () => {
    expect(tile({ display: "gauge" }).gauge?.frac).toBe(1);
    expect(tile({ display: "gauge", gauge_min: 2000, gauge_max: 3000 }).gauge?.frac).toBe(0);
    expect(tile({ display: "gauge", gauge_min: 5, gauge_max: 5 }).gauge?.frac).toBe(0);
  });
  it("works on attributes, but not on text or a missing reading", () => {
    expect(tile({ entity: "climate.hall", attribute: "current_humidity", display: "gauge" }).gauge).toMatchObject({ min: 0, max: 100, frac: 0.48 });
    expect(tile({ entity: "binary_sensor.door", display: "gauge" }).gauge).toBeUndefined();
    expect(tile({ entity: "sensor.dead", display: "gauge" }).gauge).toBeUndefined();
  });
  it("takes a colour rule, then its own colour, then the icon's", () => {
    expect(tile({ display: "gauge", icon_colour: "teal" }).gauge?.colour).toBe("teal");
    expect(tile({ display: "gauge", icon_colour: "teal", gauge_colour: "pink" }).gauge?.colour).toBe("pink");
    expect(tile({ display: "gauge", gauge_colour: "pink", colour_rules: [{ above: 1000, colour: "red" }] }).gauge?.colour).toBe("red");
  });
  it("splits the track into bands by colour rule, only when asked", () => {
    const rules = [{ above: 1500, colour: "red" }, { above: 1000, colour: "orange" }];
    expect(gaugeBands(rules, "green", 400, 2000)).toEqual([
      { from: 0, to: 0.375, colour: "green" }, { from: 0.375, to: 0.6875, colour: "orange" }, { from: 0.6875, to: 1, colour: "red" }]);
    expect(gaugeBands(rules, undefined, 0, 1200)).toEqual([{ from: 1000 / 1200, to: 1, colour: "orange" }]);
    expect(gaugeBands([{ below: 10, colour: "blue" }, { below: 20, colour: "blue" }], "green", 0, 40)).toEqual([{ from: 0, to: 0.5, colour: "blue" }, { from: 0.5, to: 1, colour: "green" }]);
    expect(tile({ display: "gauge", colour_rules: rules }).gauge?.bands).toEqual([]);
    expect(tile({ display: "gauge", gauge_min: 0, gauge_max: 2000, gauge_bands: true, colour_rules: rules }).gauge?.bands).toHaveLength(2);
  });
});

describe("editor", () => {
  it("drops defaults and stand-ins from the YAML", () => {
    expect(cleanConfig({ type: "x", entity: "sensor.power", attribute: "$state", theme: "plain", show_icon: true, shadow: true, graph: false,
      graph_scale: "$auto", icon_colour: "$text", graph_colour: "grey", graph_hours: 24, name: "", colour_rules: [], size: "large" }))
      .toEqual({ type: "x", entity: "sensor.power", size: "large" });
  });
  it("drops the gauge's defaults too", () => {
    expect(cleanConfig({ type: "x", entity: "sensor.power", display: "none", gauge_style: "ring", gauge_labels: true, gauge_bands: false, gauge_colour: "$icon" }))
      .toEqual({ type: "x", entity: "sensor.power" });
    expect(cleanConfig({ type: "x", entity: "sensor.power", display: "gauge", gauge_style: "line", gauge_labels: false, gauge_min: 0, gauge_max: 3000 }))
      .toEqual({ type: "x", entity: "sensor.power", display: "gauge", gauge_style: "line", gauge_labels: false, gauge_min: 0, gauge_max: 3000 });
  });
});

describe("valueOptions", () => {
  it("offers the state and single-value attributes, not plumbing or lists", () => {
    const o = valueOptions(hass(), "climate.hall");
    expect(o.map((x) => x.value)).toEqual(["", "current_temperature", "current_humidity", "temperature", "hvac_action"]);
    expect(o[0].label).toBe("State · Heat");
    expect(o[2].label).toBe("Current humidity · 48 %");
  });
  it("keeps a chosen attribute that has gone, and a single option for plain sensors", () => {
    expect(valueOptions(hass(), "climate.hall", "old").map((x) => x.value)).toContain("old");
    expect(valueOptions(hass(), "sensor.power")).toHaveLength(1);
  });
});

describe("units", () => {
  it("finds weather units on the entity", () => expect(attributeUnit(hass(), hass().states["weather.home"], "wind_speed")).toBe("km/h"));
});

describe("custom SVG", () => {
  it("tells markup, paths and URLs apart", () => {
    expect(["<svg/>", "M7,2V13H10V22L17,10H13L17,2H7Z", "/local/i.svg", "https://x.y/i.svg", "hello"].map(svgKind)).toEqual(["markup", "path", "url", "url", "invalid"]);
  });
  it("strips scripts, handlers, foreign content and outside links", () => {
    // (happy-dom stops reading an <svg> at <script>, so it comes last here; browsers are checked in the dev harness.)
    const svg = sanitizeSvg(`<svg viewBox="0 0 24 24" onload="alert(1)"><a href="javascript:alert(1)"><path d="M0 0" onclick="x()"/></a>
      <image href="https://evil/x.png"/><use href="https://evil/s.svg#a"/><use href="#ok"/><foreignObject><p>x</p></foreignObject><script>alert(1)</script></svg>`)!;
    const out = svg.outerHTML;
    expect(out).not.toMatch(/script|onload|onclick|foreignObject|image|evil|javascript/i);
    expect(out).toContain('<path d="M0 0">');
    expect(out).toContain('href="#ok"');
  });
  it("cleans <style>: no imports or outside urls", () => {
    const out = cleanCss(`@import url(https://evil/x.css); .a{fill:url(https://evil/p);} .b{fill:url(#g)} .c{stroke:#000;fill:#FFF}`);
    expect(out).not.toContain("evil");
    expect(out).toContain("url(#g)");
    expect(out).toContain(".c{stroke:currentColor;fill:var(--surface)}");
  });
  it("turns black into ink and white into the card surface", () => {
    expect([themeColour("#000"), themeColour("BLACK"), themeColour("#FFFFFF"), themeColour("#f9c74f")]).toEqual(["currentColor", "currentColor", "var(--surface)", undefined]);
    const out = sanitizeSvg(`<svg width="64" height="48"><path stroke="#000" fill="white"/><rect style="fill:#000000;stroke-width:2"/><circle fill="#F9C74F"/></svg>`)!.outerHTML;
    expect(out).toContain('viewBox="0 0 64 48"');
    expect(out).not.toMatch(/width="64"/);
    expect(out).toMatch(/stroke:currentColor/);
    expect(out).toMatch(/fill:var\(--surface\)/);
    expect(out).toMatch(/fill:currentColor;stroke-width:2/);
    expect(out).toContain('fill="#F9C74F"');
  });
  it("keeps the artwork inside <switch> wrappers and returns nothing without an <svg>", () => {
    expect(sanitizeSvg(`<svg><switch><g><circle r="2"/></g></switch></svg>`)!.outerHTML).toContain("<circle");
    expect(sanitizeSvg("<div>no</div>")).toBeUndefined();
  });
});

describe("themes and the line below", () => {
  it("keeps a known theme and falls back to plain", () => {
    expect([tile({ theme: "dusk" }), tile({ theme: "light", show_icon: false }), tile({ theme: "nonsense" as any }), tile({})].map((t) => [t.theme, t.showIcon]))
      .toEqual([["dusk", true], ["light", false], ["plain", true], ["plain", true]]);
  });
  it("shows a second entity as its name and value, or your text", () => {
    expect(tile({ secondary_entity: "climate.hall", secondary_attribute: "current_humidity" }).secondary).toEqual({ name: "Current humidity", value: "48", unit: "%" });
    expect(tile({ secondary_text: "  Hallway  " }).secondary).toEqual({ text: "Hallway" });
    expect(tile({ secondary_entity: "sensor.temp", secondary_name: "Inside", secondary_text: "ignored" }).secondary).toEqual({ name: "Inside", value: "19.46", unit: "°C" });
    expect(tile({}).secondary).toBeUndefined();
  });
});

describe("on/off entities", () => {
  const h = hass();
  const tile = (cfg: Partial<HaloEntityConfig>) => buildTile(h, { type: "custom:halo-entity-card", entity: "switch.kettle", ...cfg });
  it("knows on/off entities by domain, reading the state only", () => {
    expect([isOnOff("switch.kettle"), isOnOff("light.lamp"), isOnOff("binary_sensor.door"), isOnOff("input_boolean.guest"), isOnOff("sensor.power"), isOnOff("climate.hall"), isOnOff("light.lamp", "brightness")])
      .toEqual([true, true, true, true, false, false, false]);
  });
  it("fills the disc orange while on, nothing while off, unavailable or for other entities", () => {
    expect(tile({})).toMatchObject({ on: true, onFill: "#e8742f" });
    expect(tile({ entity: "light.lamp" })).toMatchObject({ on: false, onFill: undefined });
    expect(tile({ entity: "light.dead" })).toMatchObject({ on: undefined, onFill: undefined, available: false });
    expect(tile({ entity: "sensor.power" })).toMatchObject({ on: undefined, onFill: undefined });
    expect(tile({ entity: "binary_sensor.door", attribute: "tampered" }).on).toBeUndefined();
    expect(tile({ entity: "binary_sensor.motion" })).toMatchObject({ on: true, onFill: "#e8742f" });
  });
  it("takes your on colour: a palette name, your own, or none", () => {
    expect(tile({ on_colour: "teal" }).onFill).toBe("#1a9f95");
    expect(tile({ on_colour: "#123456" }).onFill).toBe("#123456");
    expect(tile({ on_colour: "none" }).onFill).toBeUndefined();
    expect(tile({ on_colour: "None" }).on).toBe(true);
  });
  it("keeps the icon colour for the off state", () => {
    expect(tile({ entity: "light.lamp", icon_colour: "blue" }).iconColour).toBe("blue");
  });
  it("taps toggle what can be toggled, else open more-info", () => {
    const tap = (cfg: Partial<HaloEntityConfig>) => { const c = { type: "x", entity: "switch.kettle", ...cfg }; return actionFor(c, "tap", tapDefault(c)).action; };
    expect([tap({}), tap({ entity: "light.lamp" }), tap({ entity: "binary_sensor.door" }), tap({ entity: "sensor.power" }), tap({ tap_action: { action: "more-info" } })])
      .toEqual(["toggle", "toggle", "more-info", "more-info", "more-info"]);
    expect(actionFor({}, "hold", "toggle").action).toBe("none");
  });
  it("drops the default on colour from the YAML", () => {
    expect(cleanConfig({ type: "x", entity: "switch.kettle", on_colour: "orange" })).toEqual({ type: "x", entity: "switch.kettle" });
    expect(cleanConfig({ type: "x", entity: "switch.kettle", on_colour: "none" })).toEqual({ type: "x", entity: "switch.kettle", on_colour: "none" });
  });
});
