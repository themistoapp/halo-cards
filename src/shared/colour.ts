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

export interface ArtColours { h: number; s: number; l: number; ha: number; distinct: boolean }

/**
 * Picks a main and an accent hue from RGBA pixels. Near-black, near-white and washed-out pixels are
 * ignored; hues are grouped in twelve bins (centred on the primaries, so red does not split across the
 * wrap-around) weighted by colourfulness, and averaged as angles. Returns undefined for artwork with
 * no real colour in it (greyscale, or empty).
 */
export function paletteFromPixels(data: ArrayLike<number>): ArtColours | undefined {
  const bins = Array.from({ length: 12 }, () => ({ w: 0, x: 0, y: 0, s: 0, l: 0 }));
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.12 || l > 0.92 || s < 0.18) continue;
    const w = s * (1 - Math.abs(2 * l - 1));
    const b = bins[Math.floor(((h * 360 + 15) % 360) / 30)];
    b.w += w; b.x += Math.cos(h * 2 * Math.PI) * w; b.y += Math.sin(h * 2 * Math.PI) * w; b.s += s * w; b.l += l * w; total += w;
  }
  const px = data.length / 4;
  if (!px || total / px < 0.04) return undefined;
  const ranked = bins.filter((b) => b.w > 0).map((b) => ({ w: b.w, h: (Math.atan2(b.y, b.x) / (2 * Math.PI) + 1) % 1, s: b.s / b.w, l: b.l / b.w })).sort((a, b) => b.w - a.w);
  const main = ranked[0];
  const dist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
  const other = ranked.find((b) => dist(b.h, main.h) >= 40 / 360 && b.w >= main.w * 0.2);
  return { h: main.h, s: main.s, l: main.l, ha: other ? other.h : main.h, distinct: !!other };
}

/**
 * Bloom colours from artwork: the main hue at the artwork's own lightness, a lighter tint, and the
 * second hue as the accent. With one colour only, the accent is the same hue deeper, never a shifted hue.
 */
export function artPalette(p: ArtColours, dark: boolean): Palette {
  const clampL = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  if (!dark) {
    return {
      c0: hslToHex(p.h, Math.min(p.s * 1.05, 0.9), clampL(p.l, 0.5, 0.66)),
      c1: hslToHex(p.h, Math.min(p.s, 0.8), 0.84),
      ca: p.distinct ? hslToHex(p.ha, Math.min(p.s, 0.85), 0.66) : hslToHex(p.h, Math.min(p.s * 1.05, 0.9), 0.5),
    };
  }
  return {
    c0: hslToHex(p.h, Math.min(p.s, 0.7), clampL(p.l * 0.5, 0.2, 0.32)),
    c1: hslToHex(p.h, Math.min(p.s, 0.6), 0.18),
    ca: p.distinct ? hslToHex(p.ha, Math.min(p.s, 0.7), 0.3) : hslToHex(p.h, Math.min(p.s, 0.7), 0.38),
  };
}

const cache = new Map<string, Promise<ArtColours | undefined>>();

/** Reads the colours of an image. Resolves undefined if it can't be read (blocked by its host, or no colour). */
export function paletteFromUrl(url: string): Promise<ArtColours | undefined> {
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
