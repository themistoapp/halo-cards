import { describe, expect, it, vi } from "vitest";
import "../src/index";
import { cleanSingleLight } from "../src/cards/single-light/editor";
import {
  DEFAULT_PRESETS, capsOf, headline, hsRgb, isSelected, kelvinRgb, pickLayout, presetService, presetsFor, readLight, rgbHs,
} from "../src/cards/single-light/logic";
import { ent, hassOf } from "./helpers";

const warm = ent("light.pendant", "on", { friendly_name: "Pendant", supported_color_modes: ["color_temp", "hs"], color_mode: "color_temp", color_temp_kelvin: 2700, rgb_color: [255, 167, 87], brightness: 204, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 });
const rose = ent("light.shelf", "on", { supported_color_modes: ["hs"], color_mode: "hs", hs_color: [335, 71], rgb_color: [245, 71, 144], brightness: 255 });
const dimmer = ent("light.hall", "on", { supported_color_modes: ["brightness"], color_mode: "brightness", brightness: 128 });
const plain = ent("light.porch", "on", { supported_color_modes: ["onoff"] });
const cfg = (entity: string, more = {}) => ({ type: "custom:halo-single-light-card", entity, ...more });

describe("single light: reading the light", () => {
  it("knows what each light can do", () => {
    expect(capsOf(warm)).toMatchObject({ dimmable: true, temp: true, colour: true, kMin: 2200, kMax: 6500 });
    expect(capsOf(dimmer)).toMatchObject({ dimmable: true, temp: false, colour: false });
    expect(capsOf(plain)).toMatchObject({ dimmable: false, temp: false, colour: false });
  });
  it("names the colour in words, never numbers", () => {
    const ps = presetsFor(cfg("light.pendant"), capsOf(warm));
    expect(headline(readLight(warm, cfg("light.pendant")), ps)).toBe("Warm white");
    expect(headline(readLight(rose, cfg("light.shelf")), presetsFor(cfg("light.shelf"), capsOf(rose)))).toBe("Rose");
    expect(headline(readLight(dimmer, cfg("light.hall")), [])).toBe("On");
    expect(headline(readLight(ent("light.x", "off", { supported_color_modes: ["hs"] }), cfg("light.x")), [])).toBe("Off");
    expect(headline(readLight(ent("light.x", "unavailable"), cfg("light.x")), [])).toBe("Unavailable");
  });
  it("falls back to hue names, and White for pale colours", () => {
    const green = ent("light.g", "on", { supported_color_modes: ["rgb"], color_mode: "rgb", rgb_color: [40, 220, 60] });
    expect(headline(readLight(green, cfg("light.g")), [])).toBe("Green");
    const pale = ent("light.p", "on", { supported_color_modes: ["rgb"], color_mode: "rgb", rgb_color: [250, 245, 240] });
    expect(headline(readLight(pale, cfg("light.p")), [])).toBe("White");
  });
  it("glows warm white when the light reports no colour, or the colour you give", () => {
    expect(readLight(dimmer, cfg("light.hall")).glow).toEqual([255, 227, 189]);
    expect(readLight(plain, cfg("light.porch", { colour: "#d0e4ff" })).glow).toEqual([208, 228, 255]);
    expect(readLight(dimmer, cfg("light.hall")).pct).toBe(50);
  });
});

describe("single light: presets", () => {
  it("shows whites and colours only where the light can do them", () => {
    expect(presetsFor(cfg("x"), capsOf(warm))).toHaveLength(8);
    expect(presetsFor(cfg("x"), capsOf(ent("l", "on", { supported_color_modes: ["color_temp"] }))).map((p) => p.kelvin)).toEqual([2200, 2700, 4000, 6000]);
    expect(presetsFor(cfg("x"), capsOf(dimmer))).toEqual([]);
    expect(presetsFor(cfg("x", { presets: [] }), capsOf(warm))).toEqual([]);
    expect(presetsFor(cfg("x", { presets: [{ name: "Bad", colour: "nope" }, { colour: "#00ff00" }] }), capsOf(warm))).toEqual([{ colour: "#00ff00" }]);
  });
  it("sends whites as colour temperature, kept in the light's range, or as a colour if it has none", () => {
    expect(presetService({ kelvin: 2000 }, capsOf(warm))).toEqual({ color_temp_kelvin: 2200 });
    expect(presetService({ kelvin: 2700 }, capsOf(rose))).toEqual({ rgb_color: kelvinRgb(2700) });
    expect(presetService({ colour: "#f54790" }, capsOf(rose))).toEqual({ rgb_color: [245, 71, 144] });
  });
  it("marks the preset the light is on", () => {
    const l = readLight(warm, cfg("x"));
    expect(DEFAULT_PRESETS.filter((p) => isSelected(p, l)).map((p) => p.name)).toEqual(["Warm white"]);
    const r = readLight(rose, cfg("x"));
    expect(DEFAULT_PRESETS.filter((p) => isSelected(p, r)).map((p) => p.name)).toEqual(["Rose"]);
  });
  it("colour maths round-trips", () => {
    const [h, s] = rgbHs(hsRgb(205, 0.7));
    expect(h).toBeCloseTo(205, 0);
    expect(s).toBeCloseTo(0.7, 1);
  });
});

describe("single light: layout", () => {
  it("picks mini when narrow, compact when short, else full", () => {
    expect(pickLayout(cfg("x"), 174, 120)).toBe("mini");
    expect(pickLayout(cfg("x"), 378, 120)).toBe("compact");
    expect(pickLayout(cfg("x"), 378, 248)).toBe("full");
    expect(pickLayout(cfg("x", { layout: "compact" }), 378, 400)).toBe("compact");
  });
  it("the editor drops defaults and keeps presets", () => {
    expect(cleanSingleLight({ type: "t", entity: "light.a", fitting: "none", layout: "auto", shadow: true, name: "", icon: undefined })).toEqual({ type: "t", entity: "light.a" });
    expect(cleanSingleLight({ type: "t", entity: "light.a", fitting: "pendant", icon: "mdi:ceiling-light" })).toEqual({ type: "t", entity: "light.a", fitting: "pendant", icon: "mdi:ceiling-light" });
  });
});

describe("single light: card", () => {
  const mount = async (config: Record<string, unknown>, list = [warm, rose, dimmer, plain]) => {
    const card = document.createElement("halo-single-light-card") as any;
    card.setConfig(config);
    const hass = hassOf(list) as any;
    hass.callService = vi.fn();
    card.hass = hass;
    document.body.append(card);
    await card.updateComplete;
    return { card, hass, root: card.shadowRoot as ShadowRoot };
  };
  it("full: headline, three tabs, the track and eight presets", async () => {
    const { card, root } = await mount(cfg("light.pendant", { layout: "full" }));
    expect(root.querySelector(".hl")!.textContent).toBe("Warm white");
    expect([...root.querySelectorAll(".seg button")].map((b) => b.textContent)).toEqual(["Brightness", "Warmth", "Colour"]);
    expect(root.querySelectorAll(".sw button")).toHaveLength(8);
    expect(root.textContent).not.toMatch(/\d+ ?%|\d{4} ?K/);
    card.remove();
  });
  it("a dimmer shows just the brightness track; on/off shows no track", async () => {
    let m = await mount(cfg("light.hall", { layout: "full" }));
    expect(m.root.querySelector(".seg")).toBeNull();
    expect(m.root.querySelectorAll(".track")).toHaveLength(1);
    expect(m.root.querySelector(".sw")).toBeNull();
    m.card.remove();
    m = await mount(cfg("light.porch", { layout: "full" }));
    expect(m.root.querySelector(".track")).toBeNull();
    m.card.remove();
  });
  it("a preset turns the light on in that colour; the power button toggles", async () => {
    const { card, hass, root } = await mount(cfg("light.pendant", { layout: "full" }));
    (root.querySelectorAll(".sw button")[3] as HTMLElement).click();
    expect(hass.callService).toHaveBeenCalledWith("light", "turn_on", { entity_id: "light.pendant", color_temp_kelvin: 6000 });
    (root.querySelector(".pw") as HTMLElement).click();
    expect(hass.callService).toHaveBeenCalledWith("light", "toggle", { entity_id: "light.pendant" });
    card.remove();
  });
  it("shows the fitting picture top right, or your icon", async () => {
    let m = await mount(cfg("light.pendant", { layout: "full", fitting: "pendant" }));
    expect(m.root.querySelector(".corner.pendant img")).not.toBeNull();
    expect(m.root.querySelector(".pw")).toBeNull();
    m.card.remove();
    m = await mount(cfg("light.pendant", { layout: "mini", icon: "mdi:ceiling-light" }));
    expect((m.root.querySelector("ha-icon") as any).icon).toBe("mdi:ceiling-light");
    expect(m.root.querySelector(".mini .nm")!.textContent).toBe("Pendant");
    m.card.remove();
  });
  it("compact: name, headline, three presets and brightness", async () => {
    const { card, root } = await mount(cfg("light.pendant", { layout: "compact", fitting: "path" }));
    expect(root.querySelector(".st")!.textContent).toBe("Warm white");
    expect(root.querySelectorAll(".sw button")).toHaveLength(3);
    expect(root.querySelector(".thumb .fx.path")).not.toBeNull();
    card.remove();
  });
});
