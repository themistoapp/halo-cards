import { describe, expect, it } from "vitest";
import { buildLights, glowColour, intensityOf, kelvinToCss } from "../src/cards/light/logic";
import { ent, hassOf } from "./helpers";

const hass = () => hassOf([
  ent("light.pendant", "on", { friendly_name: "Pendant", supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 2700, brightness: 128 }),
  ent("light.bar", "on", { supported_color_modes: ["rgb"], color_mode: "rgb", rgb_color: [255, 90, 160], brightness: 255 }),
  ent("light.lamp", "on", { supported_color_modes: ["onoff"] }),
  ent("light.hall", "off", { supported_color_modes: ["color_temp"] }),
  ent("light.dead", "unavailable"),
]);
const cfg = { type: "x", lights: ["light.pendant", { entity: "light.bar", name: "Shelf", type: "strip" as const }, "light.lamp", "light.hall", "light.dead", "light.missing"] };

describe("buildLights", () => {
  const m = buildLights(hass(), cfg);
  it("accepts strings and rows, with names and types", () => {
    expect(m.tiles.map((t) => [t.name, t.type])).toEqual([["Pendant", "none"], ["Shelf", "strip"], ["lamp", "none"], ["hall", "none"], ["dead", "none"], ["missing", "none"]]);
  });
  it("shows only percent brightness, never colour or temperature", () => {
    expect(m.tiles.map((t) => t.status)).toEqual(["50%", "100%", "On", "Off", "Unavailable", "Unavailable"]);
  });
  it("counts lights on of those available", () => {
    expect([m.nOn, m.total]).toEqual([3, 4]);
  });
  it("scales glow with brightness and is dark when off", () => {
    expect(m.tiles[0].intensity).toBeCloseTo(0.4 + 0.6 * 0.5, 1);
    expect(m.tiles[2].intensity).toBe(1);
    expect(m.tiles[3].intensity).toBe(0);
    expect(intensityOf(false, true, 0)).toBe(0);
  });
});

describe("glowColour", () => {
  it("prefers rgb, then colour temperature, then fallback, then warm white", () => {
    expect(glowColour(hass().states["light.bar"])).toBe("rgb(255, 90, 160)");
    expect(glowColour(hass().states["light.pendant"])).toBe(kelvinToCss(2700));
    expect(glowColour(hass().states["light.lamp"], "#fff")).toBe("#fff");
    expect(glowColour(hass().states["light.lamp"])).toBe("#ffe3bd");
  });
});
