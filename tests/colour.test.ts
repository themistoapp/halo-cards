import { describe, expect, it } from "vitest";
import { hexToHsl, hslToHex, paletteFromPixels, shades, shadesFromHex } from "../src/shared/colour";

const px = (r: number, g: number, b: number, n = 100) => Array.from({ length: n }, () => [r, g, b, 255]).flat();

describe("colour", () => {
  it("round-trips hex through hsl", () => {
    const c = hexToHsl("#b3262f")!;
    expect(hslToHex(c.h, c.s, c.l)).toBe("#b3262f");
  });
  it("rejects bad hex", () => { expect(hexToHsl("red")).toBeUndefined(); expect(shadesFromHex("nope", false)).toBeUndefined(); });
  it("makes lighter tints by day and darker by night", () => {
    const d = shades(0.6, 0.7, false), n = shades(0.6, 0.7, true);
    expect(hexToHsl(d.c0)!.l).toBeGreaterThan(hexToHsl(n.c0)!.l);
  });
  it("finds the dominant hue and a different accent", () => {
    const data = [...px(220, 40, 40, 300), ...px(40, 60, 220, 120)];
    const p = paletteFromPixels(data)!;
    expect(p.h).toBeLessThan(0.05 + 0.02); // red
    expect(Math.abs(p.ha - 0.65)).toBeLessThan(0.05); // blue
  });
  it("falls back to a nearby accent for single-colour art", () => {
    const p = paletteFromPixels(px(220, 40, 40, 200))!;
    expect(p.ha).toBeCloseTo(p.h + 25 / 360, 2);
  });
  it("returns nothing for greyscale, black or empty art", () => {
    expect(paletteFromPixels(px(128, 128, 128))).toBeUndefined();
    expect(paletteFromPixels(px(5, 5, 5))).toBeUndefined();
    expect(paletteFromPixels([])).toBeUndefined();
  });
});
