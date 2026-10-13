// Custom SVG icons: pasted <svg> markup, a bare 24×24 path (as in Material Design Icons), or a URL to an .svg file.
// Every source is cleaned the same way and drawn in its own shadow root, so an icon's ids and <style> stay with it.

const SVG_NS = "http://www.w3.org/2000/svg";

const KEEP = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "clippath", "mask", "lineargradient", "radialgradient",
  "stop", "use", "symbol", "title", "desc", "text", "tspan", "pattern", "style", "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "feflood",
  "fecomposite", "femerge", "femergenode", "fedropshadow", "femorphology"]);
/** Containers that are dropped but whose contents are kept (Illustrator wraps artwork in <switch>). */
const UNWRAP = new Set(["switch", "a"]);

const BLACK = new Set(["#000", "#000000", "black", "rgb(0,0,0)"]);
const WHITE = new Set(["#fff", "#ffffff", "white", "rgb(255,255,255)"]);
const PAINT = new Set(["fill", "stroke", "stop-color", "color"]);

/** Meridian: black linework follows the ink (currentColor), white fills follow the card surface, so icons invert at night. */
export function themeColour(v: string): string | undefined {
  const k = v.trim().toLowerCase().replace(/\s+/g, "");
  return BLACK.has(k) ? "currentColor" : WHITE.has(k) ? "var(--surface)" : undefined;
}

export function cleanCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, "none")
    .replace(/(^|[;{\s])(fill|stroke|stop-color|color)\s*:\s*([^;}!]+)/gi, (m, pre: string, prop: string, val: string) => {
      const t = themeColour(val);
      return t ? `${pre}${prop}:${t}` : m;
    });
}

function cleanElement(el: Element) {
  for (const a of [...el.attributes]) {
    const name = a.name.toLowerCase(), v = a.value;
    if (name.startsWith("on") || /javascript:/i.test(v)) el.removeAttribute(a.name);
    else if ((name === "href" || name === "xlink:href") && !v.trim().startsWith("#")) el.removeAttribute(a.name);
    else if (name === "style") el.setAttribute("style", cleanCss(v));
    else if (PAINT.has(name)) {
      // var() is only reliable in a style declaration, not a presentation attribute.
      const t = themeColour(v);
      if (t) { el.removeAttribute(a.name); el.setAttribute("style", `${name}:${t};${el.getAttribute("style") ?? ""}`); }
    }
  }
}

function cleanTree(parent: Element) {
  for (const child of [...parent.children]) {
    const tag = child.localName.toLowerCase();
    if (UNWRAP.has(tag)) { cleanTree(child); child.replaceWith(...child.childNodes); continue; }
    if (!KEEP.has(tag)) { child.remove(); continue; }
    if (tag === "style") { child.textContent = cleanCss(child.textContent ?? ""); continue; }
    cleanElement(child);
    cleanTree(child);
  }
  for (const n of [...parent.childNodes]) if (n.nodeType === 8) n.remove(); // comments
}

/** Parses and cleans <svg> markup: no scripts, handlers, outside links or foreign content. Undefined if there's no <svg>. */
export function sanitizeSvg(markup: string): SVGSVGElement | undefined {
  const tpl = document.createElement("template");
  tpl.innerHTML = markup; // inert: nothing in a template runs or loads
  const svg = tpl.content.querySelector("svg");
  if (!svg) return undefined;
  cleanElement(svg);
  cleanTree(svg);
  // Fill the icon box: keep the drawing's own coordinates, drop its fixed size.
  const w = parseFloat(svg.getAttribute("width") ?? ""), h = parseFloat(svg.getAttribute("height") ?? "");
  if (!svg.hasAttribute("viewBox") && w > 0 && h > 0) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.setAttribute("aria-hidden", "true");
  return svg as SVGSVGElement;
}

const PATH = /^[Mm][\d\s,.+\-eEMmZzLlHhVvCcSsQqTtAa]*$/;
const URL_RE = /^(\/|https?:\/\/)\S+$/i;

export type SvgKind = "markup" | "path" | "url" | "invalid";
export function svgKind(src: string): SvgKind {
  const s = src.trim();
  return s.startsWith("<") ? "markup" : URL_RE.test(s) ? "url" : PATH.test(s) ? "path" : "invalid";
}

function fromPath(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", d.trim()); p.setAttribute("fill", "currentColor");
  svg.append(p);
  return svg;
}

const fetched = new Map<string, Promise<SVGSVGElement | undefined>>();

/** The cleaned icon for any source; URLs are fetched once and remembered. */
export function resolveSvg(src: string): SVGSVGElement | undefined | Promise<SVGSVGElement | undefined> {
  const s = src.trim();
  switch (svgKind(s)) {
    case "markup": return sanitizeSvg(s);
    case "path": return fromPath(s);
    case "invalid": return undefined;
  }
  let p = fetched.get(s);
  if (!p) {
    p = fetch(s).then((r) => (r.ok ? r.text() : "")).then((t) => (t ? sanitizeSvg(t) : undefined), () => undefined);
    fetched.set(s, p);
    if (fetched.size > 40) fetched.delete(fetched.keys().next().value as string);
  }
  return p;
}

const STYLE = `:host{display:inline-block;width:20px;height:20px;line-height:0;flex:none}svg{display:block;width:100%;height:100%;overflow:visible}`;

/** <halo-svg-icon .src=${…}>: draws a custom icon in currentColor, sized by its host. Gets an `invalid` attribute if the source can't be read. */
export class HaloSvgIcon extends HTMLElement {
  private _src = "";
  private _root = this.attachShadow({ mode: "open" });
  set src(v: string) { if (v !== this._src) { this._src = v ?? ""; void this._draw(); } }
  get src() { return this._src; }

  private async _draw() {
    const src = this._src;
    const svg = await resolveSvg(src);
    if (src !== this._src) return;
    const style = document.createElement("style");
    style.textContent = STYLE;
    this._root.replaceChildren(style, ...(svg ? [svg.cloneNode(true)] : []));
    this.toggleAttribute("invalid", !svg && !!src.trim());
  }
}
