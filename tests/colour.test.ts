import { describe, expect, it } from "vitest";
import { artPalette, hexToHsl, hslToHex, paletteFromPixels, shades, shadesFromHex } from "../src/shared/colour";

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
    expect(Math.min(p.h, 1 - p.h)).toBeLessThan(0.03); // red
    expect(p.distinct).toBe(true);
    expect(Math.abs(p.ha - 0.65)).toBeLessThan(0.05); // blue
  });
  it("keeps a red cover red, even when its hues straddle the wrap-around", () => {
    // Reds on both sides of 0 degrees (350 and 10), plus a little dark and white as on a real cover.
    const data = [...px(220, 40, 60, 200), ...px(220, 50, 30, 200), ...px(240, 240, 240, 80), ...px(15, 10, 10, 80)];
    const p = paletteFromPixels(data)!;
    const off = Math.min(p.h, 1 - p.h) * 360;
    expect(off).toBeLessThan(12);
    for (const dark of [false, true]) {
      const pal = artPalette(p, dark);
      for (const hex of [pal.c0, pal.c1, pal.ca]) {
        const h = hexToHsl(hex)!.h; expect(Math.min(h, 1 - h) * 360).toBeLessThan(15);
      }
    }
  });
  it("uses the same hue deeper as the accent for single-colour art", () => {
    const p = paletteFromPixels(px(220, 40, 40, 200))!;
    expect(p.distinct).toBe(false);
    expect(p.ha).toBeCloseTo(p.h, 3);
  });
  it("returns nothing for greyscale, black or empty art", () => {
    expect(paletteFromPixels(px(128, 128, 128))).toBeUndefined();
    expect(paletteFromPixels(px(5, 5, 5))).toBeUndefined();
    expect(paletteFromPixels([])).toBeUndefined();
  });
});
