import { HaloEnergyCard } from "./halo-energy-card";
import { HaloEnergyCardEditor } from "./editor";

customElements.define("halo-energy-card", HaloEnergyCard);
customElements.define("halo-energy-card-editor", HaloEnergyCardEditor);

declare global { interface Window { customCards?: Record<string, unknown>[] } }
window.customCards ||= [];
window.customCards.push({
  type: "halo-energy-card",
  name: "Halo Energy",
  description: "EcoFlow Stream energy card: live flows, history graphs, backup reserve and operating mode.",
  preview: true,
});

console.info("%c HALO-CARDS %c 0.1.0 ", "background:#111;color:#fff;border-radius:3px 0 0 3px", "background:#3ee08a;color:#111;border-radius:0 3px 3px 0");
