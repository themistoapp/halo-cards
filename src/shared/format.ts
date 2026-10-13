import type { HomeAssistant } from "./types";

// Numbers, clock times and dates in the signed-in user's own settings (Profile → language, number format, time format).
// A dashboard has one user, so the cards share these; every card refreshes them when hass arrives.
// Until then (and in tests) it is British English with a 24-hour clock.

interface Locale { lang: string; num: string | undefined; hour12: boolean }
const DEFAULT: Locale = { lang: "en-GB", num: "en-GB", hour12: false };
let cur: Locale = DEFAULT;
let key = "";

/** Home Assistant's number formats as a locale to format with (undefined = the browser's own). */
const NUMBER: Record<string, string> = { comma_decimal: "en-US", decimal_comma: "de-DE", space_comma: "fr-FR" };

function twelveHour(lang: string | undefined): boolean {
  try { return !!new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12; } catch { return false; }
}

export function setLocale(hass?: Pick<HomeAssistant, "locale">) {
  const l = hass?.locale;
  if (!l?.language) return;
  const k = `${l.language}|${l.number_format}|${l.time_format}`;
  if (k === key) return;
  key = k;
  const num = l.number_format === "system" ? undefined : NUMBER[l.number_format ?? ""] ?? l.language;
  const hour12 = l.time_format === "12" ? true : l.time_format === "24" ? false : twelveHour(l.time_format === "system" ? undefined : l.language);
  cur = { lang: l.language, num, hour12 };
}

/** Back to the defaults (tests). */
export function resetLocale() { cur = DEFAULT; key = ""; }

export const language = () => cur.lang;
export const uses12h = () => cur.hour12;

/** A number with exactly `decimals` places, or up to `max` (default 2). No thousands separators unless `group`. */
export function fmtNum(v: number, decimals?: number, opts: { max?: number; group?: boolean } = {}): string {
  const places = decimals === undefined ? { maximumFractionDigits: opts.max ?? 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return v.toLocaleString(cur.num, { ...places, useGrouping: !!opts.group });
}

/** Whether this locale writes currency after the amount (3,42 €) rather than before (£3.42). */
export function currencyAfter(): boolean {
  try {
    const parts = new Intl.NumberFormat(cur.num, { style: "currency", currency: "EUR" }).formatToParts(1);
    return parts.findIndex((p) => p.type === "currency") > parts.findIndex((p) => p.type === "integer");
  } catch { return false; }
}

/** A clock time: 16:30, or 4:30 pm. */
export function clock(ms: number): string {
  const o: Intl.DateTimeFormatOptions = cur.hour12 ? { hour: "numeric", minute: "2-digit", hour12: true } : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Date(ms).toLocaleTimeString(cur.lang, o);
}

/** Hours past midnight (14.5) as a clock time. */
export function clockAt(hours: number): string {
  const d = new Date(2000, 0, 1, 0, Math.round(hours * 60));
  return clock(d.getTime());
}

/** An hour of the day for an axis or a forecast column: "06", or "6am". */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (!cur.hour12) return String(hh).padStart(2, "0");
  return new Date(2000, 0, 1, hh).toLocaleTimeString(cur.lang, { hour: "numeric", hour12: true }).replace(/[\s.]/g, "").toLowerCase();
}

export const fmtDate = (d: number | Date, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(cur.lang, o);
