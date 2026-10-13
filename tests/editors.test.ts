import { describe, expect, it } from "vitest";
import "../src/index";
import { hassOf } from "./helpers";

// "Add" puts a row with no entity yet; the editor must still show it so the entity can be picked.
async function addRow(tag: string, config: Record<string, unknown>, key: string) {
  const ed = document.createElement(tag) as any;
  ed.hass = hassOf([]);
  ed.setConfig(config);
  document.body.append(ed);
  await ed.updateComplete;
  let emitted: any;
  ed.addEventListener("config-changed", (e: CustomEvent) => { emitted = e.detail.config; });
  (ed.shadowRoot.querySelector("button.add") as HTMLButtonElement).click();
  await ed.updateComplete;
  const rows = ed.shadowRoot.querySelectorAll(".row, .rule").length;
  ed.remove();
  return { rows, list: emitted[key] };
}

describe("editors: Add shows a new empty row", () => {
  it("Scenes", async () => {
    const r = await addRow("halo-scenes-card-editor", { type: "x", scenes: ["scene.movie"] }, "scenes");
    expect(r.rows).toBe(2);
    expect(r.list).toHaveLength(2);
  });
  it("Lights", async () => {
    const r = await addRow("halo-light-card-editor", { type: "x", lights: ["light.lamp"] }, "lights");
    expect(r.rows).toBe(2);
  });
  it("Entity colour rules", async () => {
    const r = await addRow("halo-entity-card-editor", { type: "x", entity: "sensor.power", colour_rules: [{ above: 1, colour: "red" }] }, "colour_rules");
    expect(r.rows).toBe(2);
    expect(r.list).toHaveLength(2);
  });
});
