import type { HomeAssistant } from "./types";

// History for the small graphs on the Energy, Solar and Entity cards.

export interface Sample { t: number; v: number | null }

/** Puts samples on n buckets between start and end; empty buckets carry the last value forward. */
export function bucket(samples: Sample[], start: number, end: number, n: number): (number | null)[] {
  const out: (number | null)[] = new Array(n).fill(null);
  const width = (end - start) / n;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  let i = 0;
  let last: number | null = null;
  while (i < sorted.length && sorted[i].t < start) last = sorted[i++].v;
  for (let b = 0; b < n; b++) {
    const bEnd = start + (b + 1) * width;
    let sum = 0, count = 0;
    while (i < sorted.length && sorted[i].t < bEnd) {
      const v = sorted[i++].v;
      if (v !== null) { sum += v; count++; }
      last = v;
    }
    out[b] = count ? sum / count : last;
  }
  return out;
}

/** Graph window: today from the start hour to now; early in the day, the last six hours instead. */
export function historyWindow(now: number, startHour: number): [number, number] {
  const d = new Date(now);
  d.setHours(startHour, 0, 0, 0);
  const start = d.getTime();
  return now - start < 30 * 60_000 ? [now - 6 * 3600_000, now] : [start, now];
}

/** Smooth path through points (Catmull-Rom as cubic Beziers) in a 100 x 60 box, from `min` (bottom) to `max` (top). */
export function graphPath(values: (number | null)[], max: number, min = 0): { line: string; area: string } | undefined {
  const pts: [number, number][] = [];
  const n = values.length;
  values.forEach((v, i) => {
    if (v === null) return;
    pts.push([(i / (n - 1)) * 100, 56 - Math.min(Math.max((v - min) / (max - min || 1), 0), 1) * 48]);
  });
  if (pts.length < 2) return undefined;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  const last = pts[pts.length - 1], first = pts[0];
  return { line: d, area: `${d} L${last[0].toFixed(2)},60 L${first[0].toFixed(2)},60 Z` };
}

/** Value that maps to the top of the graph. */
export function graphMax(scale: "kw" | "percent", values: (number | null)[]): number {
  if (scale === "percent") return 100;
  const m = Math.max(0, ...values.filter((v): v is number => v !== null));
  return Math.max(m * 1.15, 1);
}

/**
 * How an entity's graph is scaled: "zero" runs from zero to just above the peak (power, energy, money),
 * "range" from just below the lowest reading to just above the highest (temperature, CO2), "percent" is 0 to 100.
 * A pinned min or max replaces that end.
 */
export type GraphScale = "zero" | "range" | "percent";
export function graphRange(values: (number | null)[], scale: GraphScale, pinMin?: number, pinMax?: number): [number, number] {
  const nums = values.filter((v): v is number => v !== null);
  let lo = 0, hi = 1;
  if (scale === "percent") [lo, hi] = [0, 100];
  else if (nums.length && scale === "zero") {
    lo = Math.min(0, Math.min(...nums) * 1.15);
    hi = Math.max(Math.max(0, ...nums) * 1.15, lo + 1);
  } else if (nums.length) {
    const mn = Math.min(...nums), mx = Math.max(...nums), pad = (mx - mn) * 0.15 || Math.max(Math.abs(mx) * 0.05, 0.5);
    [lo, hi] = [mn - pad, mx + pad];
  }
  if (pinMin !== undefined) lo = pinMin;
  if (pinMax !== undefined) hi = pinMax;
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}

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

type StatRow = { start: number | string; mean?: number | null; state?: number | null };
const statTime = (s: number | string) => (typeof s === "number" ? (s < 1e12 ? s * 1000 : s) : Date.parse(s));

/**
 * Hourly long-term statistics, for graphs longer than a day: a week of raw readings from a busy power sensor
 * is tens of thousands of points. Only sensors with a state_class have them; others get an empty list.
 */
export async function fetchStatistics(hass: HomeAssistant, entityId: string, startMs: number): Promise<Sample[]> {
  const r = await hass.callWS<Record<string, StatRow[]>>({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    statistic_ids: [entityId],
    period: "hour",
    types: ["mean", "state"],
  });
  return (r?.[entityId] ?? []).map((x) => ({ t: statTime(x.start), v: x.mean ?? x.state ?? null }));
}
