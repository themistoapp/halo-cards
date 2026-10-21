import type { HomeAssistant } from "./types";
import { fireMoreInfo } from "./util";

// Tap, hold and double tap, in Home Assistant's own action format (what its action picker writes):
// more-info, toggle, navigate, url, perform-action (or the older call-service) and none. Assist is not supported.

export interface ActionConfig {
  action: string;
  entity?: string;
  navigation_path?: string;
  navigation_replace?: boolean;
  url_path?: string;
  perform_action?: string;
  service?: string;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  confirmation?: boolean | { text?: string };
}
export type Gesture = "tap" | "hold" | "double_tap";
export interface ActionSet { tap_action?: ActionConfig; hold_action?: ActionConfig; double_tap_action?: ActionConfig }

/** Tap opens more-info (or `tap`, where a card toggles by default) unless told otherwise; hold and double tap do nothing unless set. */
export function actionFor(cfg: ActionSet, g: Gesture, tap = "more-info"): ActionConfig {
  const a = g === "tap" ? cfg.tap_action : g === "hold" ? cfg.hold_action : cfg.double_tap_action;
  return a?.action ? a : { action: g === "tap" ? tap : "none" };
}

export const hasAction = (cfg: ActionSet, g: Gesture) => actionFor(cfg, g).action !== "none";

export function runAction(el: HTMLElement, hass: HomeAssistant, a: ActionConfig, entity?: string) {
  if (a.action === "none") return;
  if (a.confirmation) {
    const text = typeof a.confirmation === "object" && a.confirmation.text ? a.confirmation.text : "Are you sure?";
    if (!window.confirm(text)) return;
  }
  const id = a.entity ?? entity;
  switch (a.action) {
    case "more-info": if (id) fireMoreInfo(el, id); break;
    case "toggle": if (id) hass.callService("homeassistant", "toggle", { entity_id: id }); break;
    case "navigate":
      if (!a.navigation_path) break;
      if (a.navigation_replace) history.replaceState(null, "", a.navigation_path); else history.pushState(null, "", a.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !!a.navigation_replace } }));
      break;
    case "url": if (a.url_path) window.open(a.url_path); break;
    case "perform-action": case "call-service": {
      const [domain, service] = (a.perform_action ?? a.service ?? "").split(".");
      if (domain && service) hass.callService(domain, service, a.data ?? a.service_data, a.target);
      break;
    }
  }
}

/**
 * Pointer and keyboard handling for one element. Hold is 500 ms. A double tap is only waited for when one is set,
 * so plain taps aren't delayed. Moving the finger more than 10 px (a scroll) cancels.
 */
export function gestures(fire: (g: Gesture) => void, wantsDouble: () => boolean) {
  let timer: number | undefined, held = false, pending: number | undefined, x = 0, y = 0;
  const stop = () => { clearTimeout(timer); timer = undefined; };
  return {
    down: (e: PointerEvent) => {
      if (e.button !== 0) return;
      held = false; x = e.clientX; y = e.clientY; stop();
      timer = window.setTimeout(() => { timer = undefined; held = true; fire("hold"); }, 500);
    },
    move: (e: PointerEvent) => { if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) stop(); },
    up: () => {
      if (held) { held = false; return; }
      if (timer === undefined) return;
      stop();
      if (!wantsDouble()) { fire("tap"); return; }
      if (pending !== undefined) { clearTimeout(pending); pending = undefined; fire("double_tap"); return; }
      pending = window.setTimeout(() => { pending = undefined; fire("tap"); }, 250);
    },
    cancel: () => { stop(); held = false; },
    key: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire("tap"); } },
  };
}
