import { getLang } from "./i18n";

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

function group(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const money = (n: number | null | undefined) => (n == null ? "yoxdur" : group(n) + " ₼");

export function num(n: number | null | undefined, digits = 0): string {
  if (n == null) return "yoxdur";
  const fixed = n.toFixed(digits);
  const [i, d] = fixed.split(".");
  return group(Number(i)) + (d && Number(d) !== 0 ? "," + d : "");
}

export const pct = (p: number | null | undefined) => (p == null ? "yoxdur" : Math.round(p * 100) + "%");

export function date(v: string | null | undefined): string {
  if (!v) return "yoxdur";
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v);
  const lang = getLang();
  if (lang !== "az") return d.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dateTime(v: string | null | undefined): string {
  if (!v) return "yoxdur";
  const d = new Date(v);
  return `${date(v)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function countdown(deadline: string): string {
  const ms = new Date(deadline + "T23:59:59").getTime() - Date.now();
  if (ms <= 0) return "Müddət bitib";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d} gün ${h} saat` : `${h} saat`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function initials(name: string): string {
  return name
    .replace(/["“”]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** One decimal, for model metrics where 99.5% must not round up to 100%. */
export const pct1 = (p: number | null | undefined) => (p == null ? "yoxdur" : (Math.floor(p * 1000) / 10).toFixed(1) + "%");

/**
 * Model confidence as words, not a percentage: the classifier is trained on an open Kaggle dataset and its probabilities
 * (often 99–100%) overstate how certain a recommendation for a real plot can be.
 */
export const fit = (p: number | null | undefined) => (p == null ? "yoxdur" : p >= 0.6 ? "çox uyğun" : p >= 0.25 ? "uyğun" : "az uyğun");
