import type { HassEntity, HomeAssistant } from "../../shared/types";
import { clamp, isAvailable } from "../../shared/util";

export interface HaloMediaConfig {
  type: string;
  entity: string;
  name?: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
  /** Speaker picture: auto matches the device model. */
  speaker?: "auto" | "none" | "beam-sub-mini" | "era-300" | "one";
  /** Your own picture (URL) instead of the built-in speaker. */
  image?: string;
  /** Every player in the house: the title becomes a dropdown to switch between them, and the others show as group chips. */
  players?: string[];
  /** Only these as group chips (defaults to `players`). */
  speakers?: string[];
  favourites_entity?: string;
  favourites_include?: string[];
  favourites?: { name: string; media_content_id: string; media_content_type?: string; image?: string }[];
}

export type Speaker = "beam-sub-mini" | "era-300" | "one";
export type Phase = "playing" | "paused" | "idle";

// MediaPlayerEntityFeature bits
export const F = { PAUSE: 1, VOLUME_SET: 4, VOLUME_MUTE: 8, PREV: 16, NEXT: 32, PLAY_MEDIA: 512, PLAY: 16384, SHUFFLE: 32768, REPEAT: 262144 };
const ACTIVE = ["playing", "paused", "buffering"];

export function speakerFor(model: string | null | undefined, choice: HaloMediaConfig["speaker"] = "auto"): Speaker | undefined {
  if (choice === "none") return undefined;
  if (choice && choice !== "auto") return choice;
  const m = String(model || "").toLowerCase();
  if (/era\s*300/.test(m)) return "era-300";
  if (/\b(beam|arc|ray)\b/.test(m)) return "beam-sub-mini";
  if (/\bone\b|play:1/.test(m)) return "one";
  return undefined;
}

const hasMedia = (x?: HassEntity) => !!x && ACTIVE.includes(x.state) && !!(x.attributes.media_title || x.attributes.media_content_id);

/** The speaker whose track to show: a grouped follower can report no track, so use the member that has one. */
export function mediaSource(s: HassEntity, states: Record<string, HassEntity>): HassEntity {
  if (hasMedia(s)) return s;
  const others = (Array.isArray(s.attributes.group_members) ? s.attributes.group_members : [])
    .filter((e: string) => e !== s.entity_id).map((e: string) => states[e]).filter(Boolean) as HassEntity[];
  return others.find((o) => o.state === "playing" && hasMedia(o)) ?? others.find(hasMedia) ?? s;
}

export const phaseOf = (s: HassEntity): Phase => (s.state === "playing" || s.state === "buffering" ? "playing" : s.state === "paused" ? "paused" : "idle");

export function position(s: HassEntity, now = Date.now()): number {
  const a = s.attributes;
  let pos = Number(a.media_position) || 0;
  if (s.state === "playing" && a.media_position_updated_at) pos += (now - Date.parse(a.media_position_updated_at)) / 1000;
  const dur = Number(a.media_duration) || 0;
  return dur ? Math.min(pos, dur) : pos;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Bloom size: grows with volume while playing, shrinks when paused, small and grey when idle. */
export function bloomK(phase: Phase, volume: number | undefined): number {
  if (phase === "idle") return 0.2;
  const k = 0.6 + clamp(volume ?? 0.3, 0, 1) * 0.9;
  return +(phase === "paused" ? k * 0.55 : k).toFixed(2);
}

export interface MediaModel {
  source: HassEntity;
  main: HassEntity;
  phase: Phase;
  title?: string;
  artist?: string;
  art?: string;
  pos: number;
  dur: number;
  live: boolean;
  can: { play: boolean; prev: boolean; next: boolean; volume: boolean; mute: boolean; shuffle: boolean; repeat: boolean; media: boolean };
  volume?: number;
  muted: boolean;
  shuffle: boolean;
  repeat: string;
  grouped: number;
  speakers: { id: string; name: string; inGroup: boolean; main: boolean }[];
}

export function buildMedia(hass: HomeAssistant, cfg: HaloMediaConfig, now = Date.now()): MediaModel | undefined {
  const main = hass.states[cfg.entity];
  if (!isAvailable(main)) return undefined;
  const source = mediaSource(main, hass.states);
  const feat = Number(source.attributes.supported_features) || 0;
  const mfeat = Number(main.attributes.supported_features) || 0;
  const members: string[] = Array.isArray(main.attributes.group_members) ? main.attributes.group_members : [];
  const dur = Number(source.attributes.media_duration) || 0;
  const hasTrack = hasMedia(source);
  const artist = [source.attributes.media_artist, source.attributes.media_album_name].filter(Boolean).join(" · ");
  const name = (id: string) => String(hass.states[id]?.attributes.friendly_name ?? id.split(".")[1]);
  const ids = (cfg.speakers ?? cfg.players)?.filter((id) => hass.states[id] && isAvailable(hass.states[id])) ?? [];
  return {
    source, main,
    phase: phaseOf(source.state === "idle" && main.state !== "idle" ? main : source),
    title: hasTrack ? String(source.attributes.media_title ?? source.attributes.media_content_id ?? "") || undefined : undefined,
    artist: hasTrack ? artist || undefined : undefined,
    art: hasTrack ? ((source.attributes.entity_picture_local ?? source.attributes.entity_picture) as string | undefined) : undefined,
    pos: position(source, now), dur, live: hasTrack && !dur,
    can: {
      play: !!(feat & (F.PLAY | F.PAUSE)), prev: !!(feat & F.PREV), next: !!(feat & F.NEXT),
      volume: !!(mfeat & F.VOLUME_SET), mute: !!(mfeat & F.VOLUME_MUTE),
      shuffle: !!(feat & F.SHUFFLE), repeat: !!(feat & F.REPEAT), media: !!(mfeat & F.PLAY_MEDIA),
    },
    volume: typeof main.attributes.volume_level === "number" ? main.attributes.volume_level : undefined,
    muted: !!main.attributes.is_volume_muted,
    shuffle: !!source.attributes.shuffle,
    repeat: String(source.attributes.repeat ?? "off"),
    grouped: members.length,
    speakers: ids.length ? [{ id: main.entity_id, name: name(main.entity_id), inGroup: true, main: true }, ...ids.filter((id) => id !== main.entity_id).map((id) => ({ id, name: name(id), inGroup: members.includes(id), main: false }))] : [],
  };
}

/** Players offered in the dropdown: the configured entity first, then `players`. */
export const playersOf = (cfg: HaloMediaConfig): string[] => [...new Set([cfg.entity, ...(cfg.players ?? [])])];

export const nextRepeat = (r: string) => (r === "off" ? "all" : r === "all" ? "one" : "off");

export function watchedMedia(cfg: HaloMediaConfig, hass?: HomeAssistant): string[] {
  const ids = new Set<string>([cfg.entity, ...(cfg.players ?? []), ...(cfg.speakers ?? [])]);
  const main = hass?.states[cfg.entity];
  for (const m of (Array.isArray(main?.attributes.group_members) ? main!.attributes.group_members : []) as string[]) ids.add(m);
  if (cfg.favourites_entity) ids.add(cfg.favourites_entity);
  return [...ids];
}

export interface Favourite { name: string; media_content_id: string; media_content_type: string; image?: string }

export function favouritesOf(hass: HomeAssistant, cfg: HaloMediaConfig): Favourite[] {
  const src = cfg.favourites_entity || (hass.states["sensor.sonos_favorites"] ? "sensor.sonos_favorites" : undefined);
  const items: Record<string, string> = (src && hass.states[src]?.attributes.items) || {};
  const ids = cfg.favourites_include?.length ? cfg.favourites_include.filter((id) => items[id]) : Object.keys(items);
  return [
    ...ids.map((id) => ({ name: items[id], media_content_id: id, media_content_type: "favorite_item_id" })),
    ...(cfg.favourites ?? []).map((f) => ({ ...f, media_content_type: f.media_content_type || "favorite_item_id" })),
  ];
}
