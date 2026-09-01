// to-artifact.mjs — qurilgan sahifani Artifact formatiga o'giradi.
//
// Artifact qobig'i <html>, <head>, <body> teglarini o'zi qo'shadi, shuning uchun
// ulardan tozalab, ichidagi <title>, shrift havolalari, <style> va tana qismini
// ketma-ket qo'yamiz.
//
// node src/to-artifact.mjs katta <chiqish-fayli>

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [theme, out] = process.argv.slice(2);

if (!theme || !out) {
  console.error("Ishlatilishi: node src/to-artifact.mjs <dizayn> <chiqish-fayli>");
  process.exit(1);
}

const src = await readFile(join(ROOT, "site", theme, "index.html"), "utf8");

const pick = (re) => (src.match(re) || []).join("\n");

const title = pick(/<title>[\s\S]*?<\/title>/i);
const fonts = pick(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/gi);
const style = pick(/<style>[\s\S]*?<\/style>/i);

const bodyMatch = src.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error("<body> topilmadi");
const body = bodyMatch[1].trim();

const page = [title, fonts, style, body].filter(Boolean).join("\n\n");

await writeFile(out, page + "\n");
console.log(`  ✓ ${out}  (${(page.length / 1024).toFixed(1)} KB)`);
