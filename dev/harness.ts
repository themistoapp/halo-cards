import "../src/index";
import type { HomeAssistant } from "../src/types";

// Browser-only mock of Home Assistant: static states and a synthetic history for the graphs.
if (!customElements.get("ha-card")) customElements.define("ha-card", class extends HTMLElement {});
const q = new URLSearchParams(location.search);
if (q.has("dark")) document.body.classList.add("dark");

const now = new Date().toISOString();
const e = (id: string, state: string, attributes: Record<string, unknown> = {}) => [id, { entity_id: id, state, attributes, last_updated: now, last_changed: now }] as const;
const drop = new Set((q.get("drop") ?? "").split(",").filter(Boolean));
const states = Object.fromEntries([
  e("sensor.solar_power", "820", { unit_of_measurement: "W" }), e("sensor.solar_today", "5.4", { unit_of_measurement: "kWh" }),
  e("sensor.solar_forecast", "9.1", { unit_of_measurement: "kWh" }), e("sensor.soc", "62", { unit_of_measurement: "%" }),
  e("sensor.battery_power", "350", { unit_of_measurement: "W" }), e("sensor.grid_power", "630", { unit_of_measurement: "W" }),
  e("sensor.grid_cost", "1.59", { unit_of_measurement: "£" }), e("sensor.home_power", "1800", { unit_of_measurement: "W" }),
  e("number.reserve", "65", { min: 0, max: 100, step: 5 }), e("select.mode", "Self-powered", { options: ["Self-powered", "AI"] }),
].filter(([id]) => !drop.has(id.split(".")[1])));

const shape: Record<string, (x: number) => number> = {
  "sensor.solar_power": (x) => Math.max(0, Math.sin(x * Math.PI)) * 1100,
  "sensor.soc": (x) => 30 + x * 32,
  "sensor.battery_power": (x) => 200 + Math.sin(x * 9) * 150,
  "sensor.grid_power": (x) => 900 - x * 300 + Math.sin(x * 12) * 120,
  "sensor.home_power": (x) => 1400 + Math.sin(x * 7) * 500,
};

const hass = {
  states,
  themes: { darkMode: q.has("dark") },
  connection: {
    async subscribeMessage(cb: (m: unknown) => void, msg: { entity_ids: string[]; start_time: string }) {
      const t0 = Date.parse(msg.start_time), t1 = Date.now();
      const out: Record<string, { s: string; lu: number }[]> = {};
      for (const id of msg.entity_ids) {
        out[id] = Array.from({ length: 120 }, (_, i) => {
          const x = i / 119;
          return { s: String(shape[id]?.(x) ?? 0), lu: (t0 + x * (t1 - t0)) / 1000 };
        });
      }
      setTimeout(() => cb({ states: out }), 50);
      return () => {};
    },
  },
  async callService(d: string, s: string, data: Record<string, unknown>) {
    console.log("service", d, s, data);
    if (s === "select_option") { (states["select.mode"] as any).state = String(data.option); (card as any).hass = { ...hass, states: { ...states } }; }
  },
} as unknown as HomeAssistant;

const card = document.createElement("halo-energy-card") as any;
card.setConfig({
  type: "custom:halo-energy-card",
  solar_power: "sensor.solar_power", solar_energy: "sensor.solar_today", solar_forecast: "sensor.solar_forecast",
  battery_soc: "sensor.soc", battery_power: "sensor.battery_power", grid_power: "sensor.grid_power",
  grid_cost: "sensor.grid_cost", home_power: "sensor.home_power", reserve_entity: "number.reserve", mode_entity: "select.mode",
});
card.hass = hass;
document.getElementById("c")!.append(card);
