import type { HomeAssistant } from "../../shared/types";

export interface SceneRow { entity: string; name?: string; icon?: string; colour?: string }
export interface HaloScenesConfig {
  type: string;
  /** Optional heading above the buttons. Leave empty for the compact one-row look. */
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  scenes: (string | SceneRow)[];
}

export interface SceneButton { entity: string; name: string; icon: string; colour?: string; available: boolean; domain: string }

const DEFAULT_ICON: Record<string, string> = { scene: "mdi:palette", script: "mdi:script-text-play", button: "mdi:gesture-tap-button", input_button: "mdi:gesture-tap-button" };

export const rowsOf = (cfg: HaloScenesConfig): SceneRow[] =>
  (cfg.scenes ?? []).map((r) => (typeof r === "string" ? { entity: r } : r)).filter((r) => r?.entity);

export const watchedScenes = (cfg: HaloScenesConfig) => rowsOf(cfg).map((r) => r.entity);

export function buildScenes(hass: HomeAssistant, cfg: HaloScenesConfig): SceneButton[] {
  return rowsOf(cfg).map((r) => {
    const s = hass.states[r.entity];
    const domain = r.entity.split(".")[0];
    return {
      entity: r.entity, domain, colour: r.colour,
      name: r.name || (s?.attributes.friendly_name as string | undefined) || r.entity.split(".")[1].replace(/_/g, " "),
      icon: r.icon || (s?.attributes.icon as string | undefined) || DEFAULT_ICON[domain] || "mdi:palette",
      available: !!s && s.state !== "unavailable",
    };
  });
}

/** The service that runs a scene, script or button. */
export function runService(domain: string): [string, string] {
  return domain === "script" ? ["script", "turn_on"] : domain === "button" ? ["button", "press"] : domain === "input_button" ? ["input_button", "press"] : ["scene", "turn_on"];
}

/** Columns: one row of up to four buttons; more than four wrap onto further rows. */
export const columnsFor = (n: number) => Math.min(Math.max(n, 1), 4);
