// build.mjs — posts.json dan statik sahifalar quradi.
//
// node src/build.mjs            → uchala dizaynni ham quradi
// node src/build.mjs lenta      → faqat bittasini

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Saytda chiqadigan dizayn. Qolganlari faqat solishtirish uchun quriladi.
const PUBLISH = "katta";
const THEMES = ["lenta", "katta", "gazeta"];

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

// Toshkent vaqti (UTC+5), kutubxonasiz.
export function tashkent(iso) {
  const d = new Date(Date.parse(iso) + 5 * 3600_000);
  return {
    hhmm: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    date: `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`,
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
  };
}

// "3 soat oldin"
export function ago(iso) {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins} daqiqa oldin`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return d === 1 ? "kecha" : `${d} kun oldin`;
}

export const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Manba nomidan sayt domenini chiqaramiz (favicon uchun emas, ko'rsatish uchun).
export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// Reuters, WSJ va Bloomberg'da ochiq RSS yo'q — ular Google News orqali topiladi
// va havola o'sha yerdan o'tadi. Buni yashirmasdan, aynan shunday yozamiz.
export const via = (p) =>
  p.source.indirect ? "Google News orqali" : hostOf(p.source.url);

async function main() {
  const only = process.argv[2];
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));

  // Argumentsiz chaqirilsa — nashr uchun quriladi (docs/ → GitHub Pages).
  // Dizayn nomi berilsa — solishtirish uchun site/ ichiga quriladi.
  const build = async (name, outDir, label) => {
    const { render } = await import(`../templates/${name}.mjs`);
    const html = render(posts, { tashkent, ago, esc, hostOf, via, MONTHS });
    await mkdir(join(ROOT, outDir), { recursive: true });
    await writeFile(join(ROOT, outDir, "index.html"), html);
    console.log(`  ✓ ${label}  (${(html.length / 1024).toFixed(1)} KB)`);
  };

  if (!only) {
    await build(PUBLISH, "docs", "docs/index.html");
    return;
  }
  if (only === "all") {
    for (const t of THEMES) await build(t, join("site", t), `site/${t}/index.html`);
    return;
  }
  await build(only, join("site", only), `site/${only}/index.html`);
}

main();
