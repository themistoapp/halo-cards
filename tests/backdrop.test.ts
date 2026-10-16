import { describe, expect, it } from "vitest";
import "../src/index";
import { cleanBackdrop } from "../src/cards/backdrop/editor";
import { SKY, daylight, duration, frames, skyAt, skyBackground, sunTimes } from "../src/cards/backdrop/logic";
import { ent, hassOf } from "./helpers";

const at = (h: number, m = 0) => { const d = new Date(2026, 9, 16, h, m, 0, 0); return d; };
// 07:28 sunrise and 18:01 sunset today, as sun.sun gives them: the next ones.
const sunUp = ent("sun.sun", "above_horizon", { next_rising: at(7, 28).getTime() + 864e5, next_setting: at(18, 1).toISOString() });
sunUp.attributes.next_rising = new Date(sunUp.attributes.next_rising).toISOString();
const R = 448, S = 1081;

describe("backdrop: sun times", () => {
  it("reads today's sunrise and sunset from next_rising and next_setting", () => {
    const s = sunTimes(sunUp, at(12));
    expect(s.known).toBe(true);
    expect(s.up).toBe(true);
    expect(Math.round(s.rise)).toBe(R);
    expect(Math.round(s.set)).toBe(S);
  });
  it("falls back to 06:00 and 18:00 without a sun entity", () => {
    const s = sunTimes(undefined, at(12));
    expect(s).toMatchObject({ rise: 360, set: 1080, known: false, up: true });
  });
  it("time to sunset and since sunrise by day", () => {
    const d = daylight(sunTimes(sunUp, at(14, 19)), at(14, 19).getTime())!;
    expect(duration(d.until)).toBe("3h 42m");
    expect(duration(d.since)).toBe("6h 51m");
    expect(d.p).toBeGreaterThan(0.6);
  });
  it("time to sunrise at night", () => {
    const down = ent("sun.sun", "below_horizon", { next_rising: new Date(at(7, 28).getTime() + 864e5).toISOString(), next_setting: new Date(at(18, 1).getTime() + 864e5).toISOString() });
    const d = daylight(sunTimes(down, at(22)), at(22).getTime())!;
    expect(d.up).toBe(false);
    expect(duration(d.until)).toBe("9h 28m");
    expect(duration(d.length)).toBe("10h 33m");
  });
  it("short durations in minutes", () => expect(duration(25 * 60_000)).toBe("25m"));
});

describe("backdrop: sky", () => {
  it("stages are in order, even on a very short day", () => {
    for (const [r, s] of [[R, S], [600, 840]]) {
      const f = frames(r, s);
      for (let i = 1; i < f.length; i++) expect(f[i][0]).toBeGreaterThan(f[i - 1][0]);
    }
  });
  it("is the deep sunrise colour at sunrise and golden before sunset", () => {
    expect(skyAt(R, R, S, false)).toMatchObject({ stage: "sunrise", b: SKY.light.sunrise.b, a: SKY.light.sunrise.a });
    expect(skyAt(S - 50, R, S, false).a).toBe(SKY.light.golden.a);
  });
  it("is night with the aurora at midnight and none of the sun", () => {
    const s = skyAt(0, R, S, true);
    expect(s.stage).toBe("night");
    expect(s.b).toBe(SKY.dark.night.b);
    expect(s.aurora.w).toBeGreaterThan(0.9);
    expect(s.sun.w).toBe(0);
    expect(skyBackground(s)).toContain("ellipse");
  });
  it("no aurora at midday; the sun is high in the middle", () => {
    const s = skyAt((R + S) / 2, R, S, false);
    expect(s.aurora.w).toBe(0);
    expect(s.sun.x).toBeCloseTo(50, 0);
    expect(s.sun.y).toBeLessThan(15);
    expect(skyBackground(s)).not.toContain("ellipse");
  });
  it("the sun rises on the left and sets on the right", () => {
    expect(skyAt(R + 10, R, S, false).sun.x).toBeLessThan(15);
    expect(skyAt(S - 10, R, S, false).sun.x).toBeGreaterThan(85);
  });
  it("a fixed sun stays top left", () => {
    const s = skyAt(S - 10, R, S, false, { fixed: true });
    expect(s.sun).toMatchObject({ x: 14, y: 8 });
  });
  it("evenings past midnight still blend (midsummer far north)", () => {
    // Sunset 23:00: at 00:10 it is still dusk, not night.
    expect(skyAt(10, 180, 1380, false).stage).not.toBe("sunrise");
    expect(skyAt(10, 180, 1380, false).aurora.w).toBeLessThan(1);
  });
  it("grain can be turned off", () => {
    expect(skyBackground(skyAt(720, R, S, false))).toContain("svg");
    expect(skyBackground(skyAt(720, R, S, false), false)).not.toContain("svg");
  });
});

describe("backdrop: card", () => {
  it("paints the dashboard's background and takes it away again", async () => {
    const root = document.createElement("hui-root");
    const shadow = root.attachShadow({ mode: "open" });
    document.body.append(root);
    const card = document.createElement("halo-backdrop-card") as any;
    card.setConfig({ type: "custom:halo-backdrop-card" });
    card.hass = hassOf([sunUp]);
    shadow.append(card);
    await card.updateComplete;
    expect(root.style.getPropertyValue("--lovelace-background")).toContain("radial-gradient");
    expect(card.shadowRoot.textContent).toContain("left");
    card.remove();
    expect(root.style.getPropertyValue("--lovelace-background")).toBe("");
    root.remove();
  });
  it("hidden takes no room, but shows a strip in the editor", async () => {
    const card = document.createElement("halo-backdrop-card") as any;
    card.setConfig({ type: "custom:halo-backdrop-card", show: "hidden" });
    card.hass = hassOf([sunUp]);
    document.body.append(card);
    await card.updateComplete;
    expect(card.hasAttribute("hidden-backdrop")).toBe(true);
    card.preview = true;
    await card.updateComplete;
    expect(card.hasAttribute("hidden-backdrop")).toBe(false);
    expect(card.shadowRoot.textContent).toContain("Paints this view");
    card.remove();
  });
  it("the editor drops defaults", () => {
    expect(cleanBackdrop({ type: "custom:halo-backdrop-card", show: "tile", strength: 1, sun: "moves", grain: true, shadow: true, entity: "sun.sun", name: "" }))
      .toEqual({ type: "custom:halo-backdrop-card" });
    expect(cleanBackdrop({ type: "x", show: "hidden", strength: 1.2 })).toEqual({ type: "x", show: "hidden", strength: 1.2 });
  });
});
