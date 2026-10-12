import type { HomeAssistant } from "../src/shared/types";
export const ent = (id: string, state: string, attributes: Record<string, any> = {}) => ({
  entity_id: id, state, attributes, last_updated: "2026-10-12T10:00:00Z", last_changed: "2026-10-12T10:00:00Z",
});
export const hassOf = (list: ReturnType<typeof ent>[]): HomeAssistant =>
  ({ states: Object.fromEntries(list.map((e) => [e.entity_id, e])) }) as unknown as HomeAssistant;
