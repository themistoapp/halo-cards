import { css } from "lit";
import { shadowStyles, themeStyles } from "../../shared/bloom";
import { fittingStyles } from "./fitting";

export const styles = [themeStyles, shadowStyles, fittingStyles, css`
  ha-card {
    border: 0; background: transparent; user-select: none; -webkit-user-select: none;
    /* Daylight contrast: controls sit on near-solid surface and lift off the glow with a soft shadow. */
    --well: color-mix(in srgb, var(--surface) 86%, transparent);
    --raise: 0 1px 2px rgba(30,24,40,.12), 0 4px 14px -3px rgba(30,24,40,.16);
  }
  ha-card.dark { --well: color-mix(in srgb, var(--ink) 11%, color-mix(in srgb, var(--surface) 60%, transparent)); --raise: 0 1px 2px rgba(0,0,0,.5), 0 4px 14px -3px rgba(0,0,0,.45); }
  /* The glow: an ellipse in the light's colour from the fitting's corner (or the icon's), bigger with brightness. */
  @keyframes glow-in { from { --bw: 0; --bh: 0; } }
  .bg { position: absolute; inset: 0;
    transition: --bw .9s cubic-bezier(.22,.7,.2,1), --bh .9s cubic-bezier(.22,.7,.2,1), --c0 .6s ease;
    animation: glow-in 2s cubic-bezier(.22,.7,.2,1) backwards;
    background: radial-gradient(ellipse calc(var(--bw) * 1%) calc(var(--bh) * 1%) at var(--bx) var(--by), color-mix(in srgb, var(--c0) 78%, var(--surface)) 0%, color-mix(in srgb, var(--c0) 34%, var(--surface)) 40%, transparent 75%), var(--surface); }
  .dark .bg { background: radial-gradient(ellipse calc(var(--bw) * 1%) calc(var(--bh) * 1%) at var(--bx) var(--by), color-mix(in srgb, var(--c0) 46%, var(--surface)) 0%, color-mix(in srgb, var(--c0) 18%, var(--surface)) 40%, transparent 75%), var(--surface); }
  /* Grain with light and dark specks, so it shows on a pale daylight glow as well as at night. */
  .grain { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .5;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='1.4 0 0 0 -.2 1.4 0 0 0 -.2 1.4 0 0 0 -.2 0 0 0 0 .55'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
  .inner { gap: 10px; padding: 14px 16px 16px; }
  .spacer { flex: 1; min-height: 0; }
  button { border: 0; padding: 0; background: none; font-size: inherit; line-height: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  button:focus-visible, [role="slider"]:focus-visible, .mini:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
  ha-icon { --mdc-icon-size: 16px; display: inline-flex; }
  svg.ln { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  /* Name chip (as on the Entity tiles); with no picture its icon circle fills with the light. */
  .tchip { display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 100%; box-sizing: border-box; min-height: 32px; padding: 3px 12px 3px 3px; border-radius: 99px; background: var(--well); box-shadow: var(--raise); color: var(--ink); }
  .tchip.bare { padding: 3px 12px; }
  .tchip .ico { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--sunken); color: var(--ink-2); transition: background .3s, box-shadow .3s, color .3s; }
  .tchip .label { font-size: 13px; line-height: 18px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .on .tchip .ico, .on .cico { background: var(--glow); color: #1b1400; box-shadow: 0 0 12px 1px color-mix(in srgb, var(--glow) 70%, transparent); }
  header { min-height: 32px; }
  /* Power: the thermostat's pressed-in toggle, lifted when out. */
  .pw { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--well); color: var(--ink-2); box-shadow: var(--raise); transition: transform .12s, box-shadow .3s, background .3s; }
  .pw:active { transform: scale(.94); }
  .pw[aria-pressed="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, var(--surface)); box-shadow: inset 0 1.5px 3px rgba(0,0,0,.28), inset 0 -1px 0 rgba(255,255,255,.6); }
  .dark .pw[aria-pressed="true"] { box-shadow: inset 0 1.5px 3px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.06); }

  /* Headline: what the light is doing, in words. */
  .hl { font-size: 30px; line-height: 1.05; font-weight: 600; letter-spacing: -.035em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .off .hl { color: var(--ink-2); }
  .head { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .pic .head { max-width: calc(100% - 112px); }
  /* The picture, top right. A pendant hangs in from the top edge. */
  .corner { position: absolute; z-index: 2; right: 18px; top: 14px; display: block; width: max-content; cursor: pointer; border-radius: 12px; }
  .corner .fx { --fh: 92px; }
  .corner.pendant { top: -36px; } .corner.pendant .fx { --fh: 132px; }
  .corner.downlight { top: 16px; } .corner.downlight .fx { --fh: 62px; }
  .corner.path .fx { --fh: 76px; }
  .corner.gem { top: -24px; } .corner.gem .fx { --fh: 120px; }
  .corner.bar { top: 12px; } .corner.bar .fx { --fh: 96px; }
  .corner.bloom .fx, .corner.chandelier .fx { --fh: 84px; }

  /* Track: one long pill. Brightness fills with the light; warmth and colour are the scale itself with a ring knob. */
  .track { position: relative; flex: none; height: 44px; border-radius: 14px; background: var(--well); box-shadow: var(--raise); overflow: hidden; cursor: pointer; touch-action: none; }
  .track .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, color-mix(in srgb, var(--glow) 50%, var(--surface)), var(--glow)); }
  .off .track .fill { background: color-mix(in srgb, var(--ink) 12%, transparent); }
  .track .grip { position: absolute; top: 11px; bottom: 11px; width: 4px; margin-left: -12px; border-radius: 2px; background: color-mix(in srgb, var(--ink) 55%, transparent); }
  .on .track .grip { background: color-mix(in srgb, #1b1400 55%, transparent); }
  .track .ti { position: absolute; top: 50%; transform: translateY(-50%); display: flex; color: var(--ink-2); pointer-events: none; }
  .track .ti.l { left: 12px; } .track .ti.r { right: 12px; }
  .track.k, .track.h { border-radius: 99px; }
  .track.k { background: linear-gradient(90deg, var(--kscale)); }
  .track.h { background: linear-gradient(90deg, hsl(0 100% 60%), hsl(45 100% 60%), hsl(90 100% 60%), hsl(150 100% 60%), hsl(200 100% 60%), hsl(250 100% 60%), hsl(300 100% 60%), hsl(360 100% 60%)); }
  .track .knob { position: absolute; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; border: 3px solid #fff; box-sizing: border-box; background: var(--glow); box-shadow: 0 1px 4px rgba(0,0,0,.35); }
  .track .knob.idle { background: transparent; }
  .off .track.k, .off .track.h { opacity: .55; }
  .track.drag .fill, .track.drag .grip { transition: none; }

  /* Tabs (the thermostat's modes). */
  .seg { flex: none; display: flex; padding: 3px; border-radius: 99px; background: var(--well); box-shadow: var(--raise); }
  .seg button { flex: 1; padding: 5px 8px; border-radius: 99px; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--ink-2); white-space: nowrap; }
  .seg button[aria-pressed="true"] { background: var(--action); color: var(--action-ink); box-shadow: var(--press); }

  /* Presets: whites, a hairline, colours. A surface rim and a shadow keep pale whites visible on a pale glow. */
  .sw { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
  .sw.few { justify-content: flex-start; gap: 12px; }
  .sw .div { width: 1px; height: 20px; background: var(--line); flex: none; }
  .sw button { flex: none; width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid var(--surface); box-sizing: border-box; background: var(--c); box-shadow: var(--raise); position: relative; transition: transform .12s; }
  .sw button:active { transform: scale(.92); }
  .sw button[aria-pressed="true"]::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid var(--ink); }
  .sw.sm { gap: 8px; }
  .sw.sm button { width: 24px; height: 24px; border-width: 2px; }
  .sw.sm button[aria-pressed="true"]::after { inset: -5px; border-width: 1.5px; }

  /* Compact: icon or thumbnail, name and headline, as many presets as fit, brightness under. At 12 x 3 the presets get their own row. */
  .compact { padding: 10px 12px 12px; gap: 8px; justify-content: space-between; }
  .crow { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .cico { width: 36px; height: 36px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--well); box-shadow: var(--raise); color: var(--ink-2); transition: background .3s, box-shadow .3s; }
  .cico ha-icon { --mdc-icon-size: 18px; } .cico svg.ln { width: 18px; height: 18px; }
  .thumb { width: 44px; height: 40px; flex: none; display: grid; place-items: center; }
  .thumb .fx { --fh: 40px; }
  .thumb .fx.downlight { --fh: 32px; }
  .ctx { flex: 1; min-width: 0; }
  .ctx .nm { font-size: 14px; line-height: 18px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ctx .st { font-size: 12px; line-height: 16px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .compact .track { height: 40px; }

  /* Mini, 6 x 2: the icon (or the fitting) and the name. Sliding sideways dims; a thin bar shows while it does. */
  .mini { padding: 12px 14px; justify-content: space-between; gap: 6px; cursor: pointer; touch-action: pan-y; }
  .mini .cico { width: 40px; height: 40px; }
  .mini .cico ha-icon { --mdc-icon-size: 20px; } .mini .cico svg.ln { width: 20px; height: 20px; }
  .mini .thumb { width: 48px; height: 44px; justify-items: start; }
  .mini .thumb .fx { --fh: 44px; }
  .mini .thumb .fx.downlight { --fh: 34px; }
  .mini .nm { font-size: 14px; line-height: 18px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .off .mini .nm { color: var(--ink-2); }
  .mini .lvl { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: color-mix(in srgb, var(--ink) 10%, transparent); }
  .mini .lvl i { position: absolute; inset: 0 auto 0 0; background: var(--glow); }
  .na { opacity: .55; }

  @media (prefers-reduced-motion: reduce) { .bg { animation: none; transition: none; } .tchip .ico, .cico, .sw button, .pw { transition: none; } }
`];
