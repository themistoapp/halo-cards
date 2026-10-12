import { svg } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import type { IconKey } from "./logic";

// Fixed line-icon paths (24 x 24, stroked in the current colour). Never built from user input.
const CLOUD = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";
const RAIN_CLOUD = "M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2";
const PATHS: Record<IconKey, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pc: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  pcn: '<path d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6Z"/><path d="M10.1 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6 6 6 0 0 1-3 5.2"/>',
  cloud: `<path d="${CLOUD}"/>`,
  rain: `<path d="${RAIN_CLOUD}"/><path d="M16 14v6M8 14v6M12 16v6"/>`,
  pour: `<path d="${RAIN_CLOUD}"/><path d="M8 13v4M8 21v1M12 13v4M12 21v1M16 13v4M16 21v1"/>`,
  snow: `<path d="${RAIN_CLOUD}"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>`,
  bolt: '<path d="M6 16.3A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="m13 12-3 5h4l-3 5"/>',
  fog: `<path d="${RAIN_CLOUD}"/><path d="M5 19h14M8 22h8"/>`,
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
};

export const icon = (key: IconKey, size: number, width = 1.8) =>
  svg`<svg class="ic ${key}" width=${size} height=${size} viewBox="0 0 24 24" style="stroke-width:${width}" aria-hidden="true">${unsafeSVG(PATHS[key])}</svg>`;
