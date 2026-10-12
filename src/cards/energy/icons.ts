import { svg, type SVGTemplateResult } from "lit";

export const ICONS: Record<string, SVGTemplateResult> = {
  solar: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  battery: svg`<rect x="3" y="6" width="17" height="12" rx="2"/><path d="M20 10h2v4h-2M7 10v4M10 10v4M13 10v4"/>`,
  grid: svg`<path d="M8 22 12 2l4 20M6 8h12M5 13h14M3 22h18"/>`,
  house: svg`<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>`,
};
