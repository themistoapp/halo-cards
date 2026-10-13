import { describe, expect, it } from "vitest";
import { attributeUnit, buildTiles, columnsFor, fmtValue, readValue, rowsFor, valueOptions } from "../src/cards/entities/logic";
import { cleanCss, sanitizeSvg, svgKind, themeColour } from "../src/cards/entities/svg-icon";
import { ent, hassOf } from "./helpers";

const hass = () => hassOf([
  ent("sensor.power", "1800", { friendly_name: "House", unit_of_measurement: "W", device_class: "power" }),
  ent("sensor.temp", "19.4567", { unit_of_measurement: "°C", device_class: "temperature" }),
  ent("climate.hall", "heat", { friendly_name: "Hallway", current_temperature: 19.4, current_humidity: 48, temperature: 22, hvac_modes: ["heat", "off"], hvac_action: "heating", min_temp: 7 }),
  ent("weather.home", "rainy", { temperature: 12, temperature_unit: "°C", wind_speed: 14.4, wind_speed_unit: "km/h", forecast: [] }),
  ent("sensor.dead", "unavailable", { friendly_name: "Dead" }),
  ent("binary_sensor.door", "off", { friendly_name: "Door", tampered: false }),
]);

describe("readValue", () => {
  const h = hass();
  it("reads a numeric state with its unit, without thousands separators", () => {
    expect(readValue(h, h.states["sensor.power"], { entity: "sensor.power" })).toEqual({ value: "1800", unit: "W", available: true });
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

describe("buildTiles", () => {
  const tiles = buildTiles(hass(), { type: "x", entities: [
    "sensor.power",
    { entity: "climate.hall", attribute: "current_humidity" },
    { entity: "climate.hall", attribute: "current_temperature", name: "Hall", icon: "mdi:home-thermometer", colour: "#e8742f" },
    { entity: "sensor.temp", icon_svg: "  <svg></svg> " },
    { entity: "" },
  ] });
  it("skips rows with no entity", () => expect(tiles).toHaveLength(4));
  it("names from the row, the attribute, or the friendly name", () => {
    expect(tiles.map((t) => t.name)).toEqual(["House", "Current humidity", "Hall", "Temp"]);
  });
  it("picks icons: chosen, then by attribute, then the state icon", () => {
    expect(tiles.map((t) => [t.icon, t.stateIcon])).toEqual([["mdi:flash", true], ["mdi:water-percent", false], ["mdi:home-thermometer", false], ["mdi:thermometer", true]]);
    expect(tiles[3].svg).toBe("<svg></svg>");
    expect(tiles[2].colour).toBe("#e8742f");
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

describe("layout", () => {
  it("is one row of up to four, and grows two grid rows per line of tiles", () => {
    expect([1, 3, 4, 7].map(columnsFor)).toEqual([1, 3, 4, 4]);
    expect([rowsFor(4, false), rowsFor(5, false), rowsFor(4, true)]).toEqual([2, 4, 3]);
  });
  it("formats with a fixed number of decimals", () => expect(fmtValue(3, 1)).toBe("3.0"));
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
