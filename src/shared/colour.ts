// Colour helpers shared by the cards: bloom tints from one colour, and a palette read from artwork.

export interface Palette { c0: string; c1: string; ca: string }
export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function rgbToHsl(r8: number, g8: number, b8: number): Hsl {
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 1) + 1) % 1;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Bloom colours from a hue and saturation: the colour, a lighter tint, and an accent 25 degrees round the wheel. */
export function shades(h: number, s: number, dark: boolean): Palette {
  if (!dark) return { c0: hslToHex(h, Math.min(s * 1.1, 0.9), 0.62), c1: hslToHex(h, Math.min(s, 0.8), 0.84), ca: hslToHex(h + 25 / 360, Math.min(s, 0.85), 0.66) };
  return { c0: hslToHex(h, Math.min(s, 0.7), 0.26), c1: hslToHex(h, Math.min(s, 0.6), 0.18), ca: hslToHex(h + 25 / 360, Math.min(s, 0.7), 0.3) };
}

export function shadesFromHex(hex: string | undefined, dark: boolean): Palette | undefined {
  const c = hex ? hexToHsl(hex) : undefined;
  return c ? shades(c.h, Math.max(c.s, 0.35), dark) : undefined;
}

/**
 * Picks a main and an accent hue from RGBA pixels. Near-black, near-white and washed-out pixels are
 * ignored; hues are grouped in twelve bins weighted by colourfulness. Returns undefined for artwork
 * with no real colour in it (greyscale, or empty).
 */
export function paletteFromPixels(data: ArrayLike<number>): { h: number; s: number; ha: number } | undefined {
  const bins = Array.from({ length: 12 }, () => ({ w: 0, h: 0, s: 0 }));
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.12 || l > 0.92 || s < 0.18) continue;
    const w = s * (1 - Math.abs(2 * l - 1));
    const b = bins[Math.min(11, Math.floor(h * 12))];
    b.w += w; b.h += h * w; b.s += s * w; total += w;
  }
  const px = data.length / 4;
  if (!px || total / px < 0.04) return undefined;
  const ranked = bins.map((b) => ({ ...b, h: b.w ? b.h / b.w : 0, s: b.w ? b.s / b.w : 0 })).filter((b) => b.w > 0).sort((a, b) => b.w - a.w);
  const main = ranked[0];
  const dist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
  const other = ranked.find((b) => dist(b.h, main.h) >= 40 / 360 && b.w >= main.w * 0.2);
  return { h: main.h, s: main.s, ha: other ? other.h : main.h + 25 / 360 };
}

export function artPalette(p: { h: number; s: number; ha: number }, dark: boolean): Palette {
  const base = shades(p.h, p.s, dark);
  const acc = shades(p.ha, p.s, dark);
  return { c0: base.c0, c1: base.c1, ca: acc.c0 };
}

const cache = new Map<string, Promise<{ h: number; s: number; ha: number } | undefined>>();

/** Reads the colours of an image. Resolves undefined if it can't be read (blocked by its host, or no colour). */
export function paletteFromUrl(url: string): Promise<{ h: number; s: number; ha: number } | undefined> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = 32;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(undefined);
          ctx.drawImage(img, 0, 0, 32, 32);
          resolve(paletteFromPixels(ctx.getImageData(0, 0, 32, 32).data));
        } catch { resolve(undefined); }
      };
      img.onerror = () => resolve(undefined);
      img.src = url;
    });
    cache.set(url, p);
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  }
  return p;
}
