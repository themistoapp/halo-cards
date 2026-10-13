import { describe, expect, it } from "vitest";
import { accentK, bloomK, buildMedia, favouritesOf, fmtTime, mediaSource, nextRepeat, playersOf, position, speakerFor } from "../src/cards/media/logic";
import { ent, hassOf } from "./helpers";

const feats = 1 | 4 | 8 | 16 | 32 | 512 | 16384 | 32768 | 262144;
const player = (state = "playing", extra: Record<string, any> = {}) => ent("media_player.lounge", state, {
  supported_features: feats, media_title: "Sample", media_artist: "Artist", media_album_name: "Album", media_duration: 200,
  media_position: 50, media_position_updated_at: "2026-10-12T10:00:00Z", volume_level: 0.34, entity_picture: "/art.png", ...extra,
});

describe("speakerFor", () => {
  it("matches the model", () => {
    expect(speakerFor("Era 300")).toBe("era-300");
    expect(speakerFor("Beam")).toBe("beam-sub-mini");
    expect(speakerFor("Sonos One")).toBe("one");
    expect(speakerFor("Roam")).toBeUndefined();
    expect(speakerFor("Era 300", "none")).toBeUndefined();
    expect(speakerFor("Era 300", "one")).toBe("one");
  });
});

describe("buildMedia", () => {
  it("reads a playing track", () => {
    const m = buildMedia(hassOf([player()]), { type: "x", entity: "media_player.lounge" }, Date.parse("2026-10-12T10:00:10Z"))!;
    expect(m.phase).toBe("playing");
    expect(m).toMatchObject({ title: "Sample", artist: "Artist · Album", art: "/art.png", dur: 200, live: false, volume: 0.34 });
    expect(Math.round(m.pos)).toBe(60);
    expect(m.can).toMatchObject({ play: true, prev: true, next: true, volume: true, shuffle: true, repeat: true, media: true });
  });
  it("is idle with no track and shows no art", () => {
    const m = buildMedia(hassOf([ent("media_player.lounge", "idle", { supported_features: feats })]), { type: "x", entity: "media_player.lounge" })!;
    expect(m.phase).toBe("idle");
    expect(m.title).toBeUndefined();
    expect(m.art).toBeUndefined();
  });
  it("treats a stream with no duration as live", () => {
    const m = buildMedia(hassOf([player("playing", { media_duration: undefined })]), { type: "x", entity: "media_player.lounge" })!;
    expect(m.live).toBe(true);
  });
  it("is undefined when the player is unavailable", () => {
    expect(buildMedia(hassOf([ent("media_player.lounge", "unavailable")]), { type: "x", entity: "media_player.lounge" })).toBeUndefined();
  });
  it("lists speaker chips with group membership", () => {
    const h = hassOf([player("playing", { group_members: ["media_player.lounge", "media_player.kitchen"] }), ent("media_player.kitchen", "playing", { friendly_name: "Kitchen" }), ent("media_player.bedroom", "idle", { friendly_name: "Bedroom" })]);
    const m = buildMedia(h, { type: "x", entity: "media_player.lounge", speakers: ["media_player.kitchen", "media_player.bedroom"] })!;
    expect(m.grouped).toBe(2);
    expect(m.speakers.map((s) => [s.name, s.inGroup])).toEqual([["lounge", true], ["Kitchen", true], ["Bedroom", false]]);
  });
  it("uses players as chips and lists them for the dropdown", () => {
    const h = hassOf([player(), ent("media_player.kitchen", "idle", { friendly_name: "Kitchen" }), ent("media_player.bedroom", "idle", { friendly_name: "Bedroom" })]);
    const cfg = { type: "x", entity: "media_player.lounge", players: ["media_player.kitchen", "media_player.bedroom"] };
    expect(buildMedia(h, cfg)!.speakers.map((s) => s.name)).toEqual(["lounge", "Kitchen", "Bedroom"]);
    expect(playersOf(cfg)).toEqual(["media_player.lounge", "media_player.kitchen", "media_player.bedroom"]);
  });
  it("shows no chips when none are listed", () => {
    expect(buildMedia(hassOf([player()]), { type: "x", entity: "media_player.lounge" })!.speakers).toEqual([]);
  });
});

describe("helpers", () => {
  it("follows the playing group member", () => {
    const lead = ent("media_player.lounge", "idle", { group_members: ["media_player.lounge", "media_player.kitchen"] });
    const k = ent("media_player.kitchen", "playing", { media_title: "T" });
    expect(mediaSource(lead, { [lead.entity_id]: lead, [k.entity_id]: k }).entity_id).toBe("media_player.kitchen");
  });
  it("formats times and cycles repeat", () => {
    expect(fmtTime(65)).toBe("1:05");
    expect(nextRepeat("off")).toBe("all"); expect(nextRepeat("all")).toBe("one"); expect(nextRepeat("one")).toBe("off");
  });
  it("sizes the bloom by phase and volume", () => {
    expect(bloomK("idle", 1)).toBe(0.2);
    expect(bloomK("playing", 0.34)).toBeGreaterThan(bloomK("paused", 0.34));
    expect(bloomK("playing", 1)).toBeGreaterThan(bloomK("playing", 0.1));
  });
  it("position never passes the duration", () => {
    expect(position(player(), Date.parse("2026-10-12T11:00:00Z"))).toBe(200);
  });
  it("builds favourites from the sensor, honouring include order", () => {
    const h = hassOf([ent("sensor.sonos_favorites", "3", { items: { a: "Alpha", b: "Beta", c: "Gamma" } })]);
    expect(favouritesOf(h, { type: "x", entity: "e" }).map((f) => f.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(favouritesOf(h, { type: "x", entity: "e", favourites_include: ["c", "a"] }).map((f) => f.name)).toEqual(["Gamma", "Alpha"]);
    expect(favouritesOf(hassOf([]), { type: "x", entity: "e" })).toEqual([]);
  });
});

describe("accentK", () => {
  it("reaches as far as the main bloom, for one-colour artwork too", () => {
    const k = bloomK("playing", 0.5);
    expect(accentK("playing", 0.5, true) * 0.38).toBeCloseTo(k * 0.75, 1);
    expect(accentK("paused", 0.5, true)).toBeLessThan(accentK("playing", 0.5, true));
  });
  it("is off when idle or there is no artwork colour", () => {
    expect(accentK("idle", 0.5, true)).toBe(0);
    expect(accentK("playing", 0.5, false)).toBe(0);
  });
});
