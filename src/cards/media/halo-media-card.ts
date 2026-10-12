import { LitElement, html, nothing, svg, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { GREY_DAY, GREY_NIGHT, randomOrigin, registerBloomProps } from "../../shared/bloom";
import { artPalette, paletteFromUrl, type ArtColours, type Palette } from "../../shared/colour";
import type { HomeAssistant } from "../../shared/types";
import { observeHeight } from "../../shared/util";
import { bloomK, buildMedia, favouritesOf, fmtTime, nextRepeat, playersOf, speakerFor, watchedMedia, type Favourite, type HaloMediaConfig, type MediaModel } from "./logic";
import { SPEAKER_HEIGHT, SPEAKER_IMAGES } from "./speakers";
import { styles } from "./styles";

registerBloomProps();

const P = {
  play: svg`<path d="m7 4 13 8-13 8V4Z"/>`,
  pause: svg`<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>`,
  prev: svg`<path d="M19 20 9 12l10-8v16ZM5 19V5"/>`,
  next: svg`<path d="m5 4 10 8-10 8V4ZM19 5v14"/>`,
  shuffle: svg`<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>`,
  repeat: svg`<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>`,
  vol: svg`<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,
  mute: svg`<path d="M11 5 6 9H3v6h3l5 4V5ZM22 9l-6 6M16 9l6 6"/>`,
  chev: svg`<path d="m6 9 6 6 6-6"/>`,
  check: svg`<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
};
const icon = (p: ReturnType<typeof svg>) => html`<svg viewBox="0 0 24 24">${p}</svg>`;
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const placeholder = (name: string) => `linear-gradient(135deg, hsl(${hue(name)} 70% 62%), hsl(${(hue(name) + 50) % 360} 70% 52%))`;

export class HaloMediaCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-media-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloMediaConfig> {
    const id = hass && Object.keys(hass.states).find((e) => e.startsWith("media_player."));
    return { entity: id ?? "media_player.living_room" };
  }

  @state() private _config?: HaloMediaConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _height = 0;
  @state() private _palette?: ArtColours;
  @state() private _thumbs: Record<string, string> = {};
  @state() private _draft?: number;
  @state() private _sel?: string;

  private _origins = { a: randomOrigin(), b: randomOrigin() };
  private _artKey = "";
  private _thumbKey = "";
  private _timer?: number;
  private _unobserve?: () => void;

  setConfig(config: HaloMediaConfig) {
    if (!config?.entity) throw new Error("Choose a media player (entity)");
    this._config = config;
    try { const v = localStorage.getItem(`halo-media:${config.entity}`); this._sel = v && playersOf(config).includes(v) ? v : undefined; } catch { this._sel = undefined; }
  }

  /** The config with the dropdown's choice as the active player. */
  private get _cfg(): HaloMediaConfig {
    const c = this._config!;
    return this._sel && this._sel !== c.entity && playersOf(c).includes(this._sel) ? { ...c, entity: this._sel } : c;
  }

  private _pick(id: string) {
    this._sel = id; this._palette = undefined; this._artKey = "";
    try { localStorage.setItem(`halo-media:${this._config!.entity}`, id); } catch { /* private mode */ }
  }

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const ids = watchedMedia(this._config, hass);
    if (!old || ids.some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }

  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 6, min_columns: 6, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeHeight(this, (h) => { if (Math.abs(h - this._height) > 1) this._height = h; });
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unobserve?.(); clearInterval(this._timer); this._timer = undefined;
  }

  override shouldUpdate() { return !!this._config && !!this._hass; }

  protected override willUpdate() {
    const m = this._model();
    // Colours from the artwork, read once per picture.
    const art = m?.phase !== "idle" ? m?.art : undefined;
    if (art !== this._artKey) {
      this._artKey = art ?? "";
      if (!art) this._palette = undefined;
      else paletteFromUrl(art).then((p) => { if (this._artKey === art) this._palette = p; });
    }
    // Favourite artwork from the player's own browser.
    const cfg = this._cfg, hass = this._hass!;
    const fav = cfg.favourites_entity ?? (hass.states["sensor.sonos_favorites"] ? "sensor.sonos_favorites" : undefined);
    const key = `${cfg.entity}|${fav ? hass.states[fav]?.last_updated : ""}`;
    if (fav && key !== this._thumbKey) {
      this._thumbKey = key;
      this._loadThumbs(hass, cfg.entity).then((t) => { if (this._thumbKey === key) this._thumbs = t; }, () => {});
    }
  }

  protected override updated() {
    const g = this.renderRoot.querySelector<HTMLElement>("header .grp"); if (g) this._fade(g);
    const m = this._model();
    const tick = m?.phase === "playing" && m.dur > 0;
    if (tick && !this._timer) this._timer = window.setInterval(() => this.requestUpdate(), 1000);
    if (!tick && this._timer) { clearInterval(this._timer); this._timer = undefined; }
  }

  private _model(): MediaModel | undefined { return this._hass && this._config ? buildMedia(this._hass, this._cfg) : undefined; }

  private async _loadThumbs(hass: HomeAssistant, entity: string) {
    type Node = { media_content_id: string; media_content_type: string; thumbnail?: string; children?: Node[] };
    const browse = (type: string, id: string) => hass.callWS<Node>({ type: "media_player/browse_media", entity_id: entity, media_content_type: type, media_content_id: id });
    const root = await browse("favorites", "");
    const folders = (root.children || []).filter((n) => n.media_content_type === "favorites_folder");
    const kids = (await Promise.all(folders.map((f) => browse("favorites_folder", f.media_content_id).catch(() => ({ children: [] } as unknown as Node))))).flatMap((f) => f.children || []);
    const out: Record<string, string> = {};
    for (const n of [...(root.children || []), ...kids]) if (n.thumbnail && n.media_content_type === "favorite_item_id") out[n.media_content_id] = n.thumbnail;
    return out;
  }

  private _svc(service: string, data: Record<string, unknown> = {}, entity = this._cfg.entity) {
    this._hass!.callService("media_player", service, { entity_id: entity, ...data });
  }

  private _image(m: MediaModel): { src: string; h: number } | undefined {
    const cfg = this._cfg, hass = this._hass!;
    if (cfg.image) return { src: cfg.image, h: 140 };
    const dev = hass.entities?.[cfg.entity]?.device_id;
    const model = dev ? hass.devices?.[dev]?.model : undefined;
    const sp = speakerFor(model, cfg.speaker) ?? (cfg.speaker && cfg.speaker !== "auto" ? cfg.speaker : undefined);
    void m;
    return sp ? { src: SPEAKER_IMAGES[sp], h: SPEAKER_HEIGHT[sp] } : undefined;
  }

  private _colours(dark: boolean, active: boolean): Palette {
    if (active && this._palette) return artPalette(this._palette, dark);
    return dark ? GREY_NIGHT : GREY_DAY;
  }

  private _nowPlaying(m: MediaModel, mode: string): TemplateResult {
    const compact = mode === "compact", times = false;
    const art = m.art ? `url("${m.art}")` : undefined;
    const pct = m.dur ? (m.pos / m.dur) * 100 : 0;
    const title = m.title ?? "Nothing playing";
    const merged = mode !== "mini";
    return html`<div class="glass np ${merged ? "merged" : ""}">
      <div class="npr"><div class="art" style=${styleMap({ background: art ? `${art} center / cover` : "var(--sunken)" })}></div>
      <div class="tx"><div class="ti">${title}</div><div class="ar">${m.artist ?? ""}</div>
        ${m.title ? html`<div class="pr">${m.dur ? html`<i style=${styleMap({ width: `${pct}%` })}></i>` : nothing}</div>
          ${!times ? nothing : html`<div class="tm"><span>${m.dur ? fmtTime(m.pos) : ""}</span><span>${m.dur ? fmtTime(m.dur) : "Live"}</span></div>`}` : nothing}
      </div>
      ${compact ? this._playButton(m) : nothing}
      </div>
      ${merged ? this._volume(m, true) : nothing}
    </div>`;
  }

  private _playButton(m: MediaModel) {
    return html`<button class="play" aria-label=${m.phase === "playing" ? "Pause" : "Play"} @click=${() => this._svc("media_play_pause")}>${icon(m.phase === "playing" ? P.pause : P.play)}</button>`;
  }

  private _transport(m: MediaModel) {
    const c = m.can;
    return html`<div class="tr">
      ${c.shuffle ? html`<button class="b ${m.shuffle ? "on" : "dim"}" aria-label="Shuffle" @click=${() => this._svc("shuffle_set", { shuffle: !m.shuffle }, m.source.entity_id)}>${icon(P.shuffle)}</button>` : nothing}
      ${c.prev ? html`<button class="b" aria-label="Previous" @click=${() => this._svc("media_previous_track", {}, m.source.entity_id)}>${icon(P.prev)}</button>` : nothing}
      ${c.play ? this._playButton(m) : nothing}
      ${c.next ? html`<button class="b" aria-label="Next" @click=${() => this._svc("media_next_track", {}, m.source.entity_id)}>${icon(P.next)}</button>` : nothing}
      ${c.repeat ? html`<button class="b ${m.repeat !== "off" ? "on" : "dim"}" aria-label="Repeat" @click=${() => this._svc("repeat_set", { repeat: nextRepeat(m.repeat) }, m.source.entity_id)}>${icon(P.repeat)}</button>` : nothing}
    </div>`;
  }

  private _volume(m: MediaModel, inside = false) {
    if (!m.can.volume || m.volume === undefined) return nothing;
    const v = this._draft ?? Math.round(m.volume * 100);
    return html`<div class="${inside ? "vol in" : "glass vol"}">
      ${m.can.mute ? html`<button class="b" aria-label=${m.muted ? "Unmute" : "Mute"} @click=${() => this._svc("volume_mute", { is_volume_muted: !m.muted })}>${icon(m.muted ? P.mute : P.vol)}</button>` : html`<span class="b">${icon(P.vol)}</span>`}
      <input type="range" min="0" max="100" aria-label="Volume" .value=${String(v)} style=${styleMap({ "--p": `${v}%` })}
        @input=${(e: Event) => { this._draft = Number((e.target as HTMLInputElement).value); }}
        @change=${(e: Event) => { this._svc("volume_set", { volume_level: Number((e.target as HTMLInputElement).value) / 100 }); this._draft = undefined; }} />
      <span class="pc">${v}%</span>
    </div>`;
  }

  private _header(m: MediaModel, name: string) {
    const ids = playersOf(this._config!);
    return html`<header>
      <div class="pick">
        <h2>${name}</h2>${ids.length > 1 ? html`${icon(P.chev)}<select aria-label="Player" @change=${(e: Event) => this._pick((e.target as HTMLSelectElement).value)}>
          ${ids.map((id) => html`<option value=${id} ?selected=${id === this._cfg.entity}>${this._nameOf(id)}</option>`)}</select>` : nothing}
      </div>
      ${m.speakers.length > 1 ? html`<div class="grp" @scroll=${(e: Event) => this._fade(e.target as HTMLElement)}>${m.speakers.filter((s) => !s.main).map((s) => html`<button class="p ${s.inGroup ? "on" : ""}"
        @click=${() => s.inGroup ? this._svc("unjoin", {}, s.id) : this._svc("join", { group_members: [s.id] })}>${s.inGroup ? icon(P.check) : nothing}${s.name}</button>`)}</div>` : nothing}
    </header>`;
  }

  /** Fade the chips' right edge only while more chips are hidden beyond it. */
  private _fade(el: HTMLElement) { el.classList.toggle("more", el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1); }

  private _nameOf(id: string) { return String(this._hass!.states[id]?.attributes.friendly_name ?? id.split(".")[1]); }

  private _favourites(m: MediaModel) {
    const favs: Favourite[] = favouritesOf(this._hass!, this._cfg);
    if (!favs.length || !m.can.media) return nothing;
    return html`<div class="lab">Favourites</div><div class="fav">${favs.map((f) => {
      const img = f.image ?? this._thumbs[f.media_content_id];
      return html`<button class="f" @click=${() => this._svc("play_media", { media_content_id: f.media_content_id, media_content_type: f.media_content_type })}>
        <div class="im" style=${styleMap({ background: img ? `url("${img}") center / cover` : placeholder(f.name) })}></div><div class="nm">${f.name}</div></button>`;
    })}</div>`;
  }

  override render() {
    const hass = this._hass!, cfg = this._cfg;
    const m = buildMedia(hass, cfg);
    const dark = !!hass.themes?.darkMode;
    const name = this._sel && this._sel !== this._config!.entity ? this._nameOf(cfg.entity) : (cfg.name ?? this._nameOf(cfg.entity));
    if (!m) return html`<ha-card><div style="padding:16px">${name}: unavailable</div></ha-card>`;
    const active = m.phase !== "idle";
    const c = this._colours(dark, active);
    const vars = {
      "--x1": this._origins.a[0], "--y1": this._origins.a[1], "--x2": this._origins.b[0], "--y2": this._origins.b[1],
      "--k": String(bloomK(m.phase, m.volume)), "--k2": active && this._palette?.distinct ? String(+(bloomK(m.phase, m.volume) * 0.55).toFixed(2)) : "0",
      "--c0": c.c0, "--c1": c.c1, "--ca": c.ca,
    };
    const img = this._image(m);
    const mode = this._height && this._height < 150 ? "mini" : this._height && this._height < 300 ? "compact" : this._height && this._height < 480 ? "regular" : "full";
    const cls = `${dark ? "dark" : ""} ${mode} ${cfg.shadow === false ? "" : "halo-shadow"}`;
    const bg = html`<div class="bg"></div><div class="grain"></div>`;

    if (mode === "mini") {
      return html`<ha-card class=${cls} style=${styleMap(vars)}>${bg}<div class="inner">
        ${img ? html`<img class="thumb" src=${img.src} alt="" />` : nothing}
        <div class="who"><b>${m.title ?? "Nothing playing"}</b>${m.artist ? html`<span>${m.artist}</span>` : nothing}</div>
        ${m.can.play ? this._playButton(m) : nothing}</div></ha-card>`;
    }
    if (mode === "compact") {
      return html`<ha-card class=${cls} style=${styleMap(vars)}>${bg}<div class="inner">
        ${this._nowPlaying(m, "compact")}</div></ha-card>`;
    }
    return html`<ha-card class=${cls} style=${styleMap(vars)}>${bg}<div class="inner">
      ${this._header(m, name)}
      <div class="hero ${m.phase}"><div class="ring"></div>${img ? html`<img src=${img.src} style=${styleMap({ height: `${img.h}px` })} alt="" />` : nothing}</div>
      ${this._nowPlaying(m, mode)}${m.can.play || m.can.prev || m.can.next ? this._transport(m) : nothing}${mode === "full" ? this._favourites(m) : nothing}
    </div></ha-card>`;
  }
}
