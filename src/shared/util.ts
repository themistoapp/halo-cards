import type { HassEntity } from "./types";

export const isAvailable = (e?: HassEntity): e is HassEntity =>
  !!e && e.state !== "unavailable" && e.state !== "unknown" && e.state !== "";

export function numState(e?: HassEntity): number | undefined {
  if (!isAvailable(e)) return undefined;
  const v = Number(e.state);
  return Number.isFinite(v) ? v : undefined;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export const unitOf = (e?: HassEntity) => (e?.attributes?.unit_of_measurement as string | undefined) ?? "";

/** "not_home" -> "Away", "home" -> "Home", "work_depot" -> "Work depot". */
export function prettyPlace(state: string): string {
  if (state === "not_home") return "Away";
  const s = state.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtNumber(v: number, decimals = 0): string {
  return v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fireMoreInfo(el: HTMLElement, entityId: string) {
  el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

/** Watches a host element's height so a card can switch between its sizes. */
export function observeHeight(el: HTMLElement, cb: (height: number) => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const ro = new ResizeObserver((entries) => cb(entries[0].contentRect.height));
  ro.observe(el);
  return () => ro.disconnect();
}

/** Watches a host element's width and height. */
export function observeSize(el: HTMLElement, cb: (width: number, height: number) => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const ro = new ResizeObserver((entries) => cb(entries[0].contentRect.width, entries[0].contentRect.height));
  ro.observe(el);
  return () => ro.disconnect();
}
