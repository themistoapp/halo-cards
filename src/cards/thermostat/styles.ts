import { css } from "lit";
import { bloomStyles, shadowStyles, themeStyles } from "../../shared/bloom";

export const styles = [themeStyles, bloomStyles, shadowStyles, css`
  /* No text selection: tapping − or + twice selected the name and dial, and the highlight greyed out the card. */
  ha-card { --tone: var(--ink-2); user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  ha-card.heat { --tone: #e8742f; --cur: var(--ink); }
  ha-card.heat.dark { --tone: #ff9a5c; }
  ha-card.cool { --tone: #2f86cf; }
  ha-card.cool.dark { --tone: #6cc3ec; }
  /* Thermostat bloom: an ellipse from below the bottom edge, its width and height set apart (BLOOM_SHAPE),
     so it lies wide and low at target and rises up the card while heating or cooling. */
  @keyframes rise-in { from { --bw: 0; --bh: 0; } }
  .bg {
    transition: --bw 1.8s cubic-bezier(.22,.7,.2,1), --bh 1.8s cubic-bezier(.22,.7,.2,1), --c0 .9s ease, --c1 .9s ease;
    animation: rise-in 2.4s cubic-bezier(.22,.7,.2,1) backwards;
    background: radial-gradient(ellipse calc(var(--bw) * 1%) calc(var(--bh) * 1%) at 50% var(--by), var(--c0) 0%, var(--c1) 38%, transparent 75%), var(--surface);
  }
  .inner { gap: 6px; padding: 14px 16px 16px; }
  h2 { padding-top: 1px; }

  /* Dial: everything inside one SVG so it scales together. */
  .dialbox { flex: 1; min-height: 0; position: relative; }
  .dialbox svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
  .tk { stroke: var(--ink); opacity: .22; stroke-linecap: round; }
  .tk.lit { stroke: var(--tone); opacity: 1; }
  .tk.band { stroke: var(--ink); opacity: .5; }
  .mk-cur { stroke: var(--ink); stroke-linecap: round; }
  .mk-tgt { stroke: var(--tone); stroke-linecap: round; }
  .mk-lo { stroke: #e8742f; stroke-linecap: round; } .mk-hi { stroke: #2f86cf; stroke-linecap: round; }
  .dark .mk-lo { stroke: #ff9a5c; } .dark .mk-hi { stroke: #6cc3ec; }
  .hero { font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); font-weight: 600; letter-spacing: -.045em; fill: var(--ink); }
  .hero.off { fill: var(--ink-2); }
  .sub { font-size: 13px; fill: var(--ink-2); }
  .lim { font: 500 10px var(--code-font-family, ui-monospace, monospace); fill: var(--ink-2); }
  /* Invisible band along the ring that picks up a press and drag. */
  .grab { fill: none; stroke: transparent; stroke-width: 46; pointer-events: stroke; cursor: pointer; touch-action: none; }
  .rb { cursor: pointer; outline: none; }
  .rb circle { fill: var(--surface); stroke: var(--line); stroke-width: 1; }
  .rb path { stroke: var(--ink); stroke-width: 2; stroke-linecap: round; fill: none; }
  .rb:focus-visible circle { stroke: var(--action); stroke-width: 2; }
  .rb[aria-disabled="true"] { opacity: .4; cursor: default; }

  .seg { flex: none; display: flex; gap: 0; padding: 3px; border-radius: 99px; background: var(--sunken); overflow-x: auto; scrollbar-width: none; }
  .seg::-webkit-scrollbar { display: none; }
  .seg button { flex: 1 0 auto; border: 0; background: none; padding: 7px 14px; border-radius: 99px; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--ink-2); cursor: pointer; white-space: nowrap; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  /* Compact bar: target in the middle with - and +, now line, then the tick bar full width. */
  .c.inner { gap: 0; padding: 10px 12px; justify-content: space-between; }
  .c .nm { position: absolute; left: 12px; top: 10px; font: 500 10px/12px var(--code-font-family, ui-monospace, monospace); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); max-width: 28%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c .hr { display: flex; align-items: center; justify-content: center; gap: 18px; height: 44px; }
  .c .hv { font-size: 40px; line-height: 44px; font-weight: 600; letter-spacing: -.045em; min-width: 80px; text-align: center; font-variant-numeric: tabular-nums; }
  .c .hv .dg { position: relative; display: inline-block; }
  .c .hv sup { font-size: 18px; letter-spacing: 0; position: absolute; left: 100%; top: 4px; line-height: 1; }
  .c .hv.off { color: var(--ink-2); }
  .c .nw { text-align: center; font-size: 12px; line-height: 16px; color: var(--ink-2); }
  .c button.rb2 { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); display: grid; place-items: center; padding: 0; cursor: pointer; }
  .c button.rb2:disabled { opacity: .4; cursor: default; }
  .c button.rb2 svg { width: 14px; height: 14px; fill: none; stroke: var(--ink); stroke-width: 1.8; stroke-linecap: round; }
  /* Heat/off toggle, top right of the compact bar. On is pressed in: a darker well and an inner shadow, no colour. */
  .c button.pw { position: absolute; z-index: 2; top: 8px; right: 10px; width: 30px; height: 30px; border-radius: 50%; padding: 0; cursor: pointer; display: grid; place-items: center;
    border: 1.5px solid var(--line); background: var(--surface); color: var(--ink-2); -webkit-tap-highlight-color: transparent; transition: color .3s, box-shadow .3s, background .3s, transform .12s; }
  .c button.pw svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .c button.pw:active { transform: scale(.94); }
  .c button.pw:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
  .c button.pw[aria-pressed="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, var(--surface)); box-shadow: inset 0 1.5px 3px rgba(0,0,0,.28), inset 0 -1px 0 rgba(255,255,255,.6); }
  .dark .c button.pw[aria-pressed="true"] { box-shadow: inset 0 1.5px 3px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.06); }
  .bar { position: relative; height: 28px; margin-top: 4px; }
  .bar.live { cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
  .bar.live::before { content: ""; position: absolute; inset: -8px -6px -6px; }
  .bar i { position: absolute; bottom: 0; width: 2px; height: 18px; border-radius: 1px; background: var(--ink); opacity: .2; }
  .bar i.lit { background: var(--tone); opacity: 1; }
  .bar i.band { opacity: .5; }
  .bar i.cur { width: 3px; height: 28px; border-radius: 2px; background: var(--ink); opacity: 1; }
  .bar i.tgt { width: 4px; height: 28px; border-radius: 2px; background: var(--tone); opacity: 1; }
  /* Big figure, one element per character. While dragging it holds one decimal, grows a little and takes the mode colour;
     the decimal slides out of the whole number when it appears and back in when it goes (reveal). A changed digit fades across,
     drifting a few pixels the way the number went (up = it rose). */
  .hero, .c .hv { font-variant-numeric: tabular-nums; }
  @keyframes n-in-up { from { transform: translateY(.09em); opacity: 0; } }
  @keyframes n-in-dn { from { transform: translateY(-.09em); opacity: 0; } }
  @keyframes n-out-up { from { transform: none; opacity: 1; } to { transform: translateY(-.09em); opacity: 0; } }
  @keyframes n-out-dn { from { transform: none; opacity: 1; } to { transform: translateY(.09em); opacity: 0; } }
  @keyframes r-in { from { transform: translateX(-.25em); opacity: 0; } }
  @keyframes r-out { to { transform: translateX(-.25em); opacity: 0; } }
  @keyframes rw-in { from { max-width: 0; opacity: 0; } to { max-width: .7em; } }
  @keyframes rw-out { from { max-width: .7em; } to { max-width: 0; opacity: 0; } }
  .out:not(.reveal) { opacity: 0; }
  .in.up { animation: n-in-up .18s ease-out both; }
  .in.dn { animation: n-in-dn .18s ease-out both; }
  .out.up { animation: n-out-up .18s ease-out both; }
  .out.dn { animation: n-out-dn .18s ease-out both; }
  .figure .in.reveal { animation: r-in .22s ease-out both; }
  .figure .out.reveal { animation: r-out .22s ease-out both; }
  .c .hv .in.reveal { animation: rw-in .22s ease-out both; overflow: hidden; }
  .c .hv .out.reveal { animation: rw-out .22s ease-out both; overflow: hidden; }
  .gl { transition: transform .22s ease-out; }
  .c .hv .gc, .c .hv .gc > span { display: inline-block; vertical-align: top; }
  .c .hv .gc { position: relative; }
  .c .hv .gc > .out:not(.reveal) { position: absolute; left: 0; top: 0; }
  .figure, .c .hv { transform-box: fill-box; transform-origin: 50% 60%; transition: transform .25s cubic-bezier(.2,.8,.2,1); }
  .figure .hero { transition: fill .25s; }
  .dragging .figure, .dragging .c .hv { transform: scale(1.08); }
  .dragging .figure .hero:not(.off) { fill: var(--tone); }
  .dragging .c .hv { color: var(--tone); }
  .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--ink-2); font-size: 13px; }
`];
