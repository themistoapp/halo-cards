import type { HomeAssistant } from "./types";
import type { Sample } from "./logic";

type StreamMsg = { states?: Record<string, { s: string; lu?: number; lc?: number }[]> };

/**
 * Live history through HA's history/stream subscription: the first message carries the backlog,
 * later ones append. Returns an unsubscribe function.
 */
export function subscribeHistory(
  hass: HomeAssistant,
  entityIds: string[],
  startMs: number,
  onData: (data: Record<string, Sample[]>) => void,
): () => void {
  const store: Record<string, Sample[]> = Object.fromEntries(entityIds.map((e) => [e, []]));
  let unsub: (() => void) | undefined;
  let closed = false;
  hass.connection
    .subscribeMessage<StreamMsg>((msg) => {
      for (const [id, list] of Object.entries(msg.states || {})) {
        const arr = (store[id] ||= []);
        for (const x of list) {
          const n = Number(x.s);
          arr.push({ t: (x.lu ?? x.lc ?? 0) * 1000, v: x.s !== "" && Number.isFinite(n) ? n : null });
        }
      }
      onData(store);
    }, {
      type: "history/stream",
      entity_ids: entityIds,
      start_time: new Date(startMs).toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    })
    .then((u) => { if (closed) u(); else unsub = u; })
    .catch(() => onData(store));
  return () => { closed = true; unsub?.(); };
}
