import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";

/**
 * Size test card: shows the card's own pixel size, the screen and window it is on, and how many Sections rows and
 * columns that is, over a ruler grid. Put it on the NSPanel at different sizes to find what fits.
 */
export class HaloSizeCard extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    ha-card { display: block; position: relative; height: 100%; box-sizing: border-box; overflow: hidden; background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color, #1b1b1f); font: 12px/16px ui-monospace, monospace;
      border-radius: var(--ha-card-border-radius, 12px);
      --g: color-mix(in srgb, var(--primary-text-color, #000) 10%, transparent); }
    /* Grid: 56px rows (the Sections row height), faint 8px lines inside. */
    .grid { position: absolute; inset: 0; background-image: linear-gradient(var(--g) 1px, transparent 1px), linear-gradient(90deg, var(--g) 1px, transparent 1px); background-size: 8px 8px; }
    .rows { position: absolute; inset: 0; background-image: linear-gradient(color-mix(in srgb, #e33 55%, transparent) 1px, transparent 1px); background-size: 100% 64px; }
    .box { position: absolute; border: 2px solid #e33; inset: 0; box-sizing: border-box; border-radius: inherit; pointer-events: none; }
    .info { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 92%, transparent); border-radius: 10px; padding: 10px 14px; text-align: center; width: 90%; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .big { font-size: 26px; line-height: 32px; font-weight: 700; letter-spacing: -.02em; }
    .dim { opacity: .65; }
    .corner { position: absolute; padding: 2px 5px; background: #e33; color: #fff; font-size: 10px; line-height: 12px; }
    .tl { left: 0; top: 0; border-bottom-right-radius: 6px; } .tr { right: 0; top: 0; border-bottom-left-radius: 6px; }
    .bl { left: 0; bottom: 0; border-top-right-radius: 6px; } .br { right: 0; bottom: 0; border-top-left-radius: 6px; }
  `;

  @state() private _w = 0;
  @state() private _h = 0;
  @state() private _top = 0;
  @state() private _win = "";
  private _ro?: ResizeObserver;
  private _on = () => this._measure();

  static getConfigElement() { return undefined; }
  static getStubConfig() { return {}; }
  setConfig(_c: unknown) { /* no options */ }
  set hass(_h: unknown) { /* not needed */ }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 6, min_columns: 3, min_rows: 1 }; }

  override connectedCallback() {
    super.connectedCallback();
    this._ro = new ResizeObserver(() => this._measure());
    this._ro.observe(this);
    window.addEventListener("resize", this._on);
    window.addEventListener("scroll", this._on, true);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this._ro?.disconnect();
    window.removeEventListener("resize", this._on);
    window.removeEventListener("scroll", this._on, true);
  }

  private _measure() {
    const r = this.getBoundingClientRect();
    this._w = Math.round(r.width); this._h = Math.round(r.height); this._top = Math.round(r.top);
    this._win = `${window.innerWidth} × ${window.innerHeight}`;
  }

  override render() {
    const rows = Math.max(1, Math.round((this._h + 8) / 64));
    const below = window.innerHeight - this._top;
    return html`<ha-card>
      <div class="grid"></div><div class="rows"></div><div class="box"></div>
      <span class="corner tl">0,0</span><span class="corner tr">${this._w}</span><span class="corner bl">${this._h}</span><span class="corner br">${this._w} × ${this._h}</span>
      <div class="info">
        <div class="big">${this._w} × ${this._h}</div>
        <div>card px · ~ ${rows} row${rows === 1 ? "" : "s"}</div>
        <div class="dim">window ${this._win} · screen ${screen.width} × ${screen.height} · ${window.devicePixelRatio}x</div>
        <div class="dim">card top ${this._top}px · ${below}px of window below it</div>
        <div class="dim">red lines = Sections rows (64px)</div>
      </div>
    </ha-card>`;
  }
}
