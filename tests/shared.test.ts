import { afterEach, describe, expect, it, vi } from "vitest";
import { actionFor, gestures, hasAction, runAction } from "../src/shared/actions";
import { clock, clockAt, currencyAfter, fmtNum, hourLabel, resetLocale, setLocale } from "../src/shared/format";
import { graphPath, graphRange } from "../src/shared/history";
import { graphColours, iconColour, unitParts } from "../src/shared/tile";
import type { HomeAssistant } from "../src/shared/types";

afterEach(() => resetLocale());
const at = (h: number, m: number) => new Date(2026, 9, 13, h, m).getTime();

describe("locale", () => {
  it("is British with a 24-hour clock until Home Assistant says otherwise", () => {
    expect([fmtNum(3.5, 2), fmtNum(1840), clock(at(16, 5)), clock(at(0, 0)), hourLabel(6), clockAt(7.25)]).toEqual(["3.50", "1840", "16:05", "00:00", "06", "07:15"]);
    expect(unitParts("£")).toEqual({ pre: "£", inline: "", small: "" });
  });
  it("follows the user's number format", () => {
    setLocale({ locale: { language: "en-GB", number_format: "decimal_comma", time_format: "24" } });
    expect(fmtNum(3.5, 2)).toBe("3,50");
    expect(fmtNum(12345, 0, { group: true })).toBe("12.345");
    expect(currencyAfter()).toBe(true);
    expect(unitParts("€")).toEqual({ pre: "", inline: "", small: "€" });
  });
  it("follows the user's language", () => {
    setLocale({ locale: { language: "de", number_format: "language", time_format: "language" } });
    expect(fmtNum(21.4, 1)).toBe("21,4");
    expect(clock(at(16, 5))).toBe("16:05");
  });
  it("uses a 12-hour clock when chosen, or when the language does", () => {
    setLocale({ locale: { language: "en-GB", number_format: "language", time_format: "12" } });
    expect(clock(at(16, 5))).toMatch(/^4:05\s?pm$/i);
    expect(hourLabel(18)).toBe("6pm");
    setLocale({ locale: { language: "en-US", number_format: "language", time_format: "language" } });
    expect(clock(at(9, 30))).toMatch(/^9:30\s?AM$/i);
  });
});

describe("graph range", () => {
  const v = [19.2, 21.8, null, 21.4];
  it("fits the readings with a margin", () => {
    const [lo, hi] = graphRange(v, "range");
    expect(lo).toBeCloseTo(18.81); expect(hi).toBeCloseTo(22.19);
  });
  it("starts at zero, below zero for negatives, or runs 0 to 100", () => {
    expect(graphRange([0, 100], "zero")[1]).toBeCloseTo(115);
    expect(graphRange([-100, 100], "zero")[0]).toBeCloseTo(-115);
    expect(graphRange([30, 40], "percent")).toEqual([0, 100]);
  });
  it("can be pinned at either end, and never collapses", () => {
    expect(graphRange(v, "range", 0, 30)).toEqual([0, 30]);
    expect(graphRange([5, 5], "range")[1]).toBeGreaterThan(5);
    expect(graphRange([], "zero")).toEqual([0, 1]);
  });
  it("draws between min and max", () => {
    expect(graphPath([10, 20], 20, 10)?.line).toBe("M0.00,56.00 C16.67,48.00 83.33,16.00 100.00,8.00");
  });
});

describe("palette", () => {
  it("has a day and a night version, white on gradients, and takes your own colour", () => {
    expect(graphColours("teal", "day").ln).toBe("#1a7f77");
    expect(graphColours("Teal", "night").ln).toBe("#5fe0d4");
    expect(graphColours("teal", "white").ln).toBe("#fff");
    expect(graphColours(undefined, "day").ln).toBe("#666670");
    expect(graphColours("#e8a33d", "day").a0).toBe("#e8a33d");
    expect(graphColours("red;}body{x", "day").ln).toBe("#666670");
  });
  it("colours the icon from the same palette, or not at all", () => {
    expect([iconColour("orange", "day"), iconColour("#123", "night"), iconColour(undefined, "day")]).toEqual(["#c4561a", "#123", undefined]);
  });
});

describe("actions", () => {
  const hass = () => ({ callService: vi.fn() }) as unknown as HomeAssistant & { callService: ReturnType<typeof vi.fn> };
  it("taps open more-info; hold and double tap do nothing unless set", () => {
    expect([actionFor({}, "tap").action, actionFor({}, "hold").action, hasAction({}, "double_tap")]).toEqual(["more-info", "none", false]);
    expect(hasAction({ double_tap_action: { action: "toggle" } }, "double_tap")).toBe(true);
  });
  it("toggles, performs actions and opens more-info", () => {
    const h = hass(), el = document.createElement("div");
    const seen: string[] = [];
    el.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    runAction(el, h, { action: "toggle" }, "light.lamp");
    runAction(el, h, { action: "perform-action", perform_action: "script.bedtime", data: { quiet: true } });
    runAction(el, h, { action: "call-service", service: "light.turn_on", service_data: { brightness: 9 } });
    runAction(el, h, { action: "more-info", entity: "sensor.other" }, "light.lamp");
    expect(h.callService.mock.calls).toEqual([
      ["homeassistant", "toggle", { entity_id: "light.lamp" }],
      ["script", "bedtime", { quiet: true }, undefined],
      ["light", "turn_on", { brightness: 9 }, undefined],
    ]);
    expect(seen).toEqual(["sensor.other"]);
  });
  it("tells tap, hold and double tap apart", () => {
    vi.useFakeTimers();
    const got: string[] = [];
    let double = false;
    const g = gestures((x) => got.push(x), () => double);
    const down = { button: 0, clientX: 0, clientY: 0 } as PointerEvent;
    g.down(down); g.up();
    g.down(down); vi.advanceTimersByTime(600); g.up();
    g.down(down); g.move({ clientX: 40, clientY: 0 } as PointerEvent); g.up();
    double = true;
    g.down(down); g.up(); g.down(down); g.up();
    g.down(down); g.up(); vi.advanceTimersByTime(300);
    expect(got).toEqual(["tap", "hold", "double_tap", "tap"]);
    vi.useRealTimers();
  });
});
