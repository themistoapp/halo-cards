import { LitElement, html, nothing, svg } from "lit";
import { state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { GREY_DAY, GREY_NIGHT, registerBloomProps } from "../../shared/bloom";
import { shadesFromHex } from "../../shared/colour";
import type { HomeAssistant } from "../../shared/types";
import { observeSize } from "../../shared/util";
import { BLOOM_SHAPE, buildThermostat, dialAngle, dialValue, fmtTemp, glyphKeys, round05, snapTarget, stepTarget, turnOnMode, watchedThermostat, type HaloThermostatConfig, type ThermoModel } from "./logic";
import { styles } from "./styles";
import { fmtNum, setLocale } from "../../shared/format";

registerBloomProps();

const HEAT = { day: "#e8742f", night: "#ff9a5c" }, COOL = { day: "#2f86cf", night: "#6cc3ec" };
const CX = 173, CY = 152, RO = 142, RI = 120, TICKS = 76;
/** Grab band along the ring: its middle radius, and how far past each end of the sweep it reaches. */
const RM = (RI + RO) / 2, GRAB_END = 142;
const pol = (r: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; };
const tick = (r1: number, r2: number, deg: number, cls: string, w: number) => {
  const [x1, y1] = pol(r1, deg), [x2, y2] = pol(r2, deg);
  return svg`<line class=${cls} x1=${x1.toFixed(2)} y1=${y1.toFixed(2)} x2=${x2.toFixed(2)} y2=${y2.toFixed(2)} stroke-width=${w}></line>`;
};

/** Rough width of the big figure, so the degree sign can hang off its right edge and leave the digits centred. */
const textWidth = (str: string, size: number) => [...str].reduce((a, c) => a + ((c === "." ? 0.3 : c === "–" ? 0.5 : 0.58) - 0.045) * size, 0);

interface Pending { tgt?: number; low?: number; high?: number }
/** What the big figure says, and a number to tell up from down. */
interface Figure { text: string; num: number; deg: boolean }
/** One character of the big figure: where it sits, the change (n) that brought it in, and the character it replaced. */
interface Glyph { ch: string; x: number; since: number; dir: "up" | "dn"; was?: string }

export class HaloThermostatCard extends LitElement {
  static override styles = styles;

  static getConfigElement() { return document.createElement("halo-thermostat-card-editor"); }
  static getStubConfig(hass?: HomeAssistant): Partial<HaloThermostatConfig> {
    return { entity: Object.keys(hass?.states ?? {}).find((e) => e.startsWith("climate.")) ?? "climate.example" };
  }

  @state() private _config?: HaloThermostatConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _pending?: Pending;
  @state() private _dragging = false;
  // Big figure: what it said last, and the characters on show, so changes can be animated.
  private _fig?: Figure;
  private _figN = 0;
  private _figDir: "up" | "dn" = "up";
  private _glyphs = new Map<string, Glyph>();
  private _glyphsGone: [string, Glyph][] = [];
  private _glyphN = 0;
  private _unobserve?: () => void;
  private _send?: number;
  private _clear?: number;

  setConfig(config: HaloThermostatConfig) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Choose a climate entity");
    this._config = config;
  }
  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    setLocale(hass);
    if (!this._config) return;
    if (!old || watchedThermostat(this._config).some((id) => old.states[id] !== hass.states[id])) this.requestUpdate();
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 7, min_columns: 4, min_rows: 2 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._unobserve = observeSize(this, (w, h) => { if (Math.abs(w - this._w) > 1) this._w = w; if (Math.abs(h - this._h) > 1) this._h = h; });
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unobserve?.(); clearTimeout(this._send); clearTimeout(this._clear); }
  override shouldUpdate() { return !!this._config && !!this._hass; }

  /** + or -: moves the target by one step (both ends of a heat/cool range), then sends it once presses stop. */
  private _press(m: ThermoModel, dir: 1 | -1) {
    if (!m.available || m.mode === "off") return;
    const p = this._pending;
    let next: Pending;
    if (m.range) {
      const low = p?.low ?? m.low ?? m.min, high = p?.high ?? m.high ?? m.max;
      const d = stepTarget(0, dir, m.step, -Infinity, Infinity);
      const sh = Math.min(Math.max(d, m.min - low), m.max - high);
      next = { low: round05(low + sh), high: round05(high + sh) };
    } else {
      next = { tgt: stepTarget(p?.tgt ?? m.tgt ?? m.cur ?? m.min, dir, m.step, m.min, m.max) };
    }
    this._commit(next, 700);
  }

  /** Shows a new target straight away, sends it after `delay` ms, and goes back to the thermostat's own numbers a while after that. */
  private _commit(next: Pending, delay: number) {
    this._pending = next;
    clearTimeout(this._send); clearTimeout(this._clear);
    this._send = window.setTimeout(() => {
      const data = next.tgt !== undefined ? { temperature: next.tgt } : { target_temp_low: next.low, target_temp_high: next.high };
      this._hass!.callService("climate", "set_temperature", { entity_id: this._config!.entity, ...data });
    }, delay);
    this._clear = window.setTimeout(() => { this._pending = undefined; }, delay + 3800);
  }

  /** Press on the dial ring or the compact bar and drag: the target follows the pointer and is sent once on release.
   *  In a heat/cool range the nearer end is picked up and can't pass the other. */
  private _grab(e: PointerEvent, at: (ev: PointerEvent) => number) {
    const m = this._shown(buildThermostat(this._hass!, this._config!));
    if (!m.available || m.mode === "off" || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    clearTimeout(this._send); clearTimeout(this._clear);
    this._dragging = true;
    let end: "low" | "high" | undefined;
    const move = (ev: PointerEvent) => {
      const v = snapTarget(at(ev), m.step, m.min, m.max), p = this._pending;
      let next: Pending;
      if (m.range) {
        const low = p?.low ?? m.low ?? m.min, high = p?.high ?? m.high ?? m.max;
        end ??= v < (low + high) / 2 ? "low" : "high";
        next = end === "low" ? { low: Math.min(v, high), high } : { low, high: Math.max(v, low) };
      } else next = { tgt: v };
      if (p && p.tgt === next.tgt && p.low === next.low && p.high === next.high) return;
      this._pending = next;
      this.dispatchEvent(new CustomEvent("haptic", { detail: "selection", bubbles: true, composed: true }));
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      this._dragging = false;
      if (this._pending) this._commit(this._pending, 0);
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    move(e);
  }

  /** Temperature under the pointer on the dial ring. */
  private _ringAt = (ev: PointerEvent) => {
    const m = buildThermostat(this._hass!, this._config!);
    const svg = this.renderRoot.querySelector(".dialbox svg") as SVGSVGElement;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return dialValue(pt.x - CX, pt.y - CY, m.min, m.max);
  };
  /** Temperature under the pointer along the compact bar. */
  private _barAt = (ev: PointerEvent) => {
    const m = buildThermostat(this._hass!, this._config!);
    const r = (this.renderRoot.querySelector(".bar") as HTMLElement).getBoundingClientRect();
    return m.min + ((ev.clientX - r.left) / (r.width || 1)) * (m.max - m.min);
  };

  /** The last mode the thermostat was on in, kept per entity so the toggle can turn it back on to that mode. */
  private get _lastKey() { return `halo-thermostat-last-mode:${this._config!.entity}`; }
  private _lastMode(): string | undefined { try { return localStorage.getItem(this._lastKey) ?? undefined; } catch { return undefined; } }
  private _remember(mode: string) { try { if (localStorage.getItem(this._lastKey) !== mode) localStorage.setItem(this._lastKey, mode); } catch { /* storage blocked */ } }

  private _toggle(m: ThermoModel) {
    if (m.mode !== "off") { this._remember(m.mode); this._setMode("off"); return; }
    const on = turnOnMode(m.modes.map((x) => x.id), this._lastMode());
    if (on) this._setMode(on);
  }

  private _setMode(mode: string) {
    this._pending = undefined;
    this._hass!.callService("climate", "set_hvac_mode", { entity_id: this._config!.entity, hvac_mode: mode });
  }

  /** The numbers as shown: pending presses win over the thermostat's own until it catches up. */
  private _shown(m: ThermoModel): ThermoModel {
    const p = this._pending;
    return p ? { ...m, ...(p.tgt !== undefined ? { tgt: p.tgt } : {}), ...(p.low !== undefined ? { low: p.low, high: p.high } : {}) } : m;
  }

  /** While dragging, a thermostat that takes half degrees shows one decimal throughout (21.0, 21.5), so the figure keeps its width. */
  private _holdDecimal(m: ThermoModel) { return this._dragging && m.step % 1 !== 0 && m.mode !== "off"; }

  /** Notes each change of the big figure: which way it went, and a count that keys the animations. */
  private _track(m: ThermoModel) {
    const num = m.mode === "off" ? m.cur ?? 0 : m.range ? (m.low ?? 0) + (m.high ?? 0) : m.tgt ?? 0;
    const f: Figure = { text: this._heroText(m, this._holdDecimal(m)), num, deg: this._hasDeg(m) };
    if (this._fig && this._fig.text !== f.text) {
      this._figN++;
      if (f.num !== this._fig.num) this._figDir = f.num > this._fig.num ? "up" : "dn";
    }
    this._fig = f;
    return f;
  }

  /** Each character keeps its slot. A changed digit fades across, drifting a little the way the number went;
   *  a decimal that appears or goes slides out of or back into the whole number. */
  private _layout(text: string, xs: number[]) {
    const keys = glyphKeys(text), old = this._glyphs, next = new Map<string, Glyph>();
    keys.forEach((k, i) => {
      const o = old.get(k), ch = text[i];
      next.set(k, o && o.ch === ch ? { ...o, x: xs[i] } : { ch, x: xs[i], since: o || this._figN ? this._figN : 0, dir: this._figDir, was: o?.ch });
    });
    if (this._figN !== this._glyphN) { this._glyphN = this._figN; this._glyphsGone = [...old].filter(([k]) => !next.has(k)).map(([k, g]) => [k, { ...g, since: this._figN }]); }
    this._glyphs = next;
    return [...next];
  }

  /** Where each character of the figure starts, and its width, measured off a hidden copy. */
  private _measure(text: string, size: number) {
    const t = this.renderRoot.querySelector<SVGTextElement>("text.meas");
    try {
      if (t) { t.setAttribute("font-size", String(size)); t.textContent = text; return { xs: [...text].map((_, i) => t.getStartPositionOfChar(i).x), w: t.getComputedTextLength() }; }
    } catch { /* not laid out */ }
    let x = 0;
    return { xs: [...text].map((c) => { const at = x; x += textWidth(c, size); return at; }), w: x };
  }

  /** Class for a character brought in by the latest changes: a swapped digit, or a decimal sliding out. */
  private _inCls = (g: Glyph) => (!g.since ? "" : g.was === undefined ? "in reveal" : `in ${g.dir}`);

  /** The big figure on the dial. */
  private _figureSvg(m: ThermoModel) {
    const f = this._track(m), off = !m.available ? "off" : "";
    const big = f.text.length > 4 ? 52 : 76, y = CY + (big === 76 ? 22 : 14);
    const { xs, w } = this._measure(f.text, big), x0 = 173 - w / 2;
    const at = (x: number) => `transform:translate(${x.toFixed(1)}px,0)`;
    const ch = (g: Glyph, k: string) => svg`<g class="gl" style=${at(x0 + g.x)}>
      ${g.since && g.was !== undefined ? keyed(`${k}${g.since}o`, svg`<text class="hero ${off} out ${g.dir}" y=${y} font-size=${big}>${g.was}</text>`) : nothing}
      ${keyed(`${k}${g.since}`, svg`<text class="hero ${off} ${this._inCls(g)}" y=${y} font-size=${big}>${g.ch}</text>`)}</g>`;
    return svg`${repeat(this._layout(f.text, xs), ([k]) => k, ([k, g]) => ch(g, k))}
      ${this._glyphsGone.map(([k, g]) => keyed(`${k}${g.since}x`, svg`<g style=${at(x0 + g.x)}><text class="hero ${off} out reveal" y=${y} font-size=${big}>${g.ch}</text></g>`))}
      ${f.deg ? svg`<g class="gl" style=${at(173 + w / 2 + 2)}><text class="hero ${off}" y=${y - big * 0.29} font-size=${big * 0.447} letter-spacing="0">°</text></g>` : nothing}`;
  }

  /** The big figure on the compact bar: the same, with characters in the flow and decimals opening and closing their width. */
  private _figureHtml(m: ThermoModel) {
    const f = this._track(m), glyphs = this._layout(f.text, [...f.text].map(() => 0));
    const order = (k: string) => { const r = /^d(\d+)$|^(\d+)([if])(\d+)$/.exec(k)!; return r[1] !== undefined ? [+r[1], -1, 0] : [+r[2], r[3] === "i" ? 0 : 1, (r[3] === "i" ? -1 : 1) * Number(r[4])]; };
    const all: [string, Glyph, boolean][] = [...glyphs.map(([k, g]) => [k, g, false] as [string, Glyph, boolean]), ...this._glyphsGone.map(([k, g]) => [k + "x", g, true] as [string, Glyph, boolean])];
    all.sort((a, b) => { const p = order(a[0].replace(/x$/, "")), q = order(b[0].replace(/x$/, "")); return p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || (a[2] ? -1 : 1); });
    return html`<span class="dg">${repeat(all, ([k]) => k, ([k, g, gone]) => gone
      ? keyed(`${k}${g.since}`, html`<span class="gc"><span class="out reveal">${g.ch}</span></span>`)
      : html`<span class="gc">${g.since && g.was !== undefined ? keyed(`${k}${g.since}o`, html`<span class="out ${g.dir}">${g.was}</span>`) : nothing}${keyed(`${k}${g.since}`, html`<span class=${this._inCls(g)}>${g.ch}</span>`)}</span>`)}${f.deg ? html`<sup>°</sup>` : nothing}</span>`;
  }

  /** The big figure: the target, or the room temperature while the thermostat is off. */
  private _heroText(m: ThermoModel, oneDecimal = false) {
    const t = oneDecimal ? (v: number) => fmtNum(v, 1) : fmtTemp;
    if (!m.available) return "–";
    if (m.mode === "off") return m.cur === undefined ? "–" : fmtTemp(m.cur);
    if (m.range && m.low !== undefined && m.high !== undefined) return `${t(m.low)}–${t(m.high)}`;
    return m.tgt === undefined ? "–" : t(m.tgt);
  }
  /** A degree sign goes after a single temperature, not a range or a dash. */
  private _hasDeg(m: ThermoModel) { return m.available && (m.mode === "off" ? m.cur !== undefined : !m.range && m.tgt !== undefined); }
  private _nowText(m: ThermoModel) {
    if (!m.available) return "Unavailable";
    const hum = m.humidity === undefined ? undefined : `${m.humidity}% humidity`;
    const parts = m.mode === "off" ? ["Off", hum] : [m.cur === undefined ? undefined : `Now ${fmtTemp(m.cur)}°`, hum];
    return parts.filter(Boolean).join(" · ");
  }

  private _modes(m: ThermoModel) {
    if (m.modes.length < 2) return nothing;
    return html`<div class="seg" role="group" aria-label="Mode">${m.modes.map((x) => html`<button aria-pressed=${String(m.mode === x.id)} @click=${() => this._setMode(x.id)}>${x.label}</button>`)}</div>`;
  }

  private _ringTicks(m: ThermoModel) {
    const out = [];
    const lo = m.range ? m.low : m.cur !== undefined && m.tgt !== undefined ? Math.min(m.cur, m.tgt) : undefined;
    const hi = m.range ? m.high : m.cur !== undefined && m.tgt !== undefined ? Math.max(m.cur, m.tgt) : undefined;
    const active = m.available && m.mode !== "off" && lo !== undefined && hi !== undefined && (m.range || m.tone === "heat" || m.tone === "cool");
    for (let i = 0; i <= TICKS; i++) {
      const v = m.min + ((m.max - m.min) * i) / TICKS;
      const on = active && v >= lo! - 0.001 && v <= hi! + 0.001;
      out.push(tick(RI, RO, dialAngle(v, m.min, m.max), `tk ${on ? (m.range ? "band" : "lit") : ""}`, 2.2));
    }
    if (m.available && m.cur !== undefined) out.push(tick(RI - 12, RO + 6, dialAngle(m.cur, m.min, m.max), "mk-cur", 3));
    if (m.available && m.mode !== "off") {
      if (m.range && m.low !== undefined && m.high !== undefined) {
        out.push(tick(RI - 12, RO + 6, dialAngle(m.low, m.min, m.max), "mk-lo", 4));
        out.push(tick(RI - 12, RO + 6, dialAngle(m.high, m.min, m.max), "mk-hi", 4));
      } else if (m.tgt !== undefined) out.push(tick(RI - 12, RO + 6, dialAngle(m.tgt, m.min, m.max), "mk-tgt", 4.5));
    }
    return out;
  }

  private _btn(m: ThermoModel, x: number, dir: 1 | -1) {
    const off = !m.available || m.mode === "off";
    const d = dir < 0 ? `M${x - 7} 264 h14` : `M${x - 7} 264 h14 M${x} 257 v14`;
    return svg`<g class="rb" role="button" tabindex=${off ? -1 : 0} aria-label=${dir < 0 ? "Lower target" : "Raise target"} aria-disabled=${String(off)}
      @click=${() => this._press(m, dir)} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._press(m, dir); } }}>
      <circle cx=${x} cy="264" r="22"></circle><path d=${d}></path></g>`;
  }

  private _dial(m: ThermoModel) {
    const hero = this._heroText(m);
    const big = hero.length > 4 ? 52 : 76;
    return html`<div class="dialbox"><svg viewBox="0 0 346 292" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Thermostat dial">
      ${this._ringTicks(m)}
      ${m.available && m.mode !== "off" ? svg`<path class="grab" d=${`M${pol(RM, -GRAB_END).join(" ")} A${RM} ${RM} 0 1 1 ${pol(RM, GRAB_END).join(" ")}`}
        @pointerdown=${(e: PointerEvent) => this._grab(e, this._ringAt)} @touchstart=${(e: TouchEvent) => e.preventDefault()}></path>` : nothing}
      <text class="lim" x="18" y="262" text-anchor="middle">${fmtTemp(Math.round(m.min))}°</text><text class="lim" x="328" y="262" text-anchor="middle">${fmtTemp(Math.round(m.max))}°</text>
      <text class="hero meas" x="0" y="-999" visibility="hidden"></text>
      <g class="figure">${this._figureSvg(m)}</g>
      <text class="sub" x="173" y=${CY + (big === 76 ? 52 : 44)} text-anchor="middle">${this._nowText(m)}</text>
      ${this._btn(m, 115, -1)}${this._btn(m, 231, 1)}
    </svg></div>`;
  }

  private _bar(m: ThermoModel) {
    const width = Math.max(this._w - 24, 120), n = Math.max(20, Math.floor(width / 5.5));
    const lo = m.range ? m.low : m.cur !== undefined && m.tgt !== undefined ? Math.min(m.cur, m.tgt) : undefined;
    const hi = m.range ? m.high : m.cur !== undefined && m.tgt !== undefined ? Math.max(m.cur, m.tgt) : undefined;
    const active = m.available && m.mode !== "off" && lo !== undefined && hi !== undefined && (m.range || m.tone === "heat" || m.tone === "cool");
    const pos = (v: number) => `calc(${(((v - m.min) / (m.max - m.min || 1)) * 100).toFixed(2)}% - 1.5px)`;
    const ticks = [];
    for (let i = 0; i <= n; i++) {
      const v = m.min + ((m.max - m.min) * i) / n;
      const on = active && v >= lo! - 0.001 && v <= hi! + 0.001;
      ticks.push(html`<i class=${on ? (m.range ? "band" : "lit") : ""} style="left:calc(${((i / n) * 100).toFixed(2)}% - 1px)"></i>`);
    }
    const live = m.available && m.mode !== "off";
    return html`<div class="bar ${live ? "live" : ""}" @pointerdown=${live ? (e: PointerEvent) => this._grab(e, this._barAt) : nothing}>${ticks}
      ${m.available && m.cur !== undefined ? html`<i class="cur" style="left:${pos(m.cur)}"></i>` : nothing}
      ${m.available && m.mode !== "off" && !m.range && m.tgt !== undefined ? html`<i class="tgt" style="left:${pos(m.tgt)}"></i>` : nothing}</div>`;
  }

  private _compact(m: ThermoModel) {
    const off = !m.available || m.mode === "off";
    const ids = m.modes.map((x) => x.id);
    const canToggle = m.available && ids.includes("off") && !!turnOnMode(ids) && (this._w === 0 || this._w >= 260);
    const on = m.mode !== "off";
    return html`<div class="inner c"><div class="nm">${m.name}</div>
      ${canToggle ? html`<button class="pw" aria-pressed=${String(on)} aria-label=${on ? "Turn off" : "Turn on"} @click=${() => this._toggle(m)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8v5.4"/><path d="M4.5 4.1a5.2 5.2 0 1 0 7 0"/></svg></button>` : nothing}
      <div class="hr">
        <button class="rb2" ?disabled=${off} aria-label="Lower target" @click=${() => this._press(m, -1)}><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button>
        <div class="hv ${!m.available ? "off" : ""}">${this._figureHtml(m)}</div>
        <button class="rb2" ?disabled=${off} aria-label="Raise target" @click=${() => this._press(m, 1)}><svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10"/></svg></button>
      </div>
      <div class="nw">${this._nowText(m)}</div>
      ${this._bar(m)}</div>`;
  }

  override render() {
    const cfg = this._config!, hass = this._hass!;
    const m = this._shown(buildThermostat(hass, cfg));
    const dark = !!hass.themes?.darkMode;
    const compact = this._h > 0 && this._h < 230;
    const hex = m.glow === "heat" ? (dark ? HEAT.night : HEAT.day) : m.glow === "cool" ? (dark ? COOL.night : COOL.day) : undefined;
    const c = shadesFromHex(hex, dark) ?? (dark ? GREY_NIGHT : GREY_DAY);
    if (m.available && m.mode !== "off") this._remember(m.mode);
    const [bw, bh] = BLOOM_SHAPE[compact ? "compact" : "dial"][hex ? m.bloom : "none"];
    const vars = { "--bw": String(bw), "--bh": String(bh), "--by": compact ? "114%" : "105%", "--c0": c.c0, "--c1": c.c1 };
    return html`<ha-card class="${dark ? "dark" : ""} ${m.tone} ${this._dragging ? "dragging" : ""} ${cfg.shadow === false ? "" : "halo-shadow"}" style=${styleMap(vars)}>
      <div class="bg"></div><div class="grain"></div>
      ${compact ? this._compact(m) : html`<div class="inner"><header><h2>${m.name}</h2></header>${this._dial(m)}${this._modes(m)}</div>`}
    </ha-card>`;
  }
}
