// merge-state.mjs — holat fayllarini YO'QOTMASDAN birlashtiradi.
//
// MUAMMO. Nashr qadami push rad etilganda `git pull --rebase -X theirs`
// qiladi. Rebase paytida "theirs" — shu yugurishning nusxasi, ya'ni u
// boshqa yugurishning ro'yxatini butunlay ustiga yozadi.
//
// telegram-sent.json esa faqat qo'shib boriladigan ro'yxat. Bir yugurish
// yuborgan xabar ikkinchisining nusxasida yo'q bo'lsa, o'sha yozuv
// yo'qoladi va xabar KEYINGI yugurishda qaytadan yuboriladi.
//
// O'lchandi: "Google Gemini tavsiyasi" xabari kanalga 00:02 va 00:04 da
// ikki marta chiqqan, faylda esa atigi bitta yozuv qolgan.
//
// YECHIM. Bunday fayllar uchun to'g'ri birlashtirish — BIRLASHMA (union),
// tanlov emas. Ikkala tomonning yozuvlari ham saqlanadi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Masofaviy nusxani o'qiymiz (ishchi papkaga tegmasdan).
async function fromOrigin(path) {
  try {
    const { stdout } = await run("git", ["show", `origin/main:${path}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function fromLocal(path) {
  try {
    return JSON.parse(await readFile(join(ROOT, path), "utf8"));
  } catch {
    return null;
  }
}

// telegram-sent.json: [{slug, at, how}] yoki eski shaklda ["slug"]
function mergeSent(a, b) {
  const norm = (list) => (list || []).map((e) => (typeof e === "string" ? { slug: e, at: null } : e));
  const out = new Map();
  for (const e of [...norm(a), ...norm(b)]) {
    const prev = out.get(e.slug);
    // Vaqti borini afzal ko'ramiz — u aniqroq yozuv.
    if (!prev || (!prev.at && e.at)) out.set(e.slug, e);
  }
  return [...out.values()].slice(-3000);
}

// seen.json: {urls: [], titles: []} — ikkalasi ham qo'shiladigan ro'yxat.
function mergeSeen(a, b) {
  if (!a) return b;
  if (!b) return a;
  const uniq = (x, y, cap) => [...new Set([...(x || []), ...(y || [])])].slice(-cap);
  return {
    ...a, ...b,
    urls: uniq(a.urls, b.urls, 12000),
    titles: uniq(a.titles, b.titles, 6000),
  };
}

async function main() {
  await run("git", ["fetch", "-q", "origin", "main"], { cwd: ROOT }).catch(() => {});

  let changed = 0;

  for (const [path, merge] of [
    ["data/telegram-sent.json", mergeSent],
    ["data/seen.json", mergeSeen],
  ]) {
    const local = await fromLocal(path);
    const remote = await fromOrigin(path);
    if (!local || !remote) continue;

    const merged = merge(remote, local);
    const before = JSON.stringify(local);
    const after = JSON.stringify(merged, null, 2);
    if (before !== JSON.stringify(merged)) {
      await writeFile(join(ROOT, path), after + "\n");
      const n = Array.isArray(merged) ? merged.length : (merged.urls?.length ?? 0);
      const was = Array.isArray(local) ? local.length : (local.urls?.length ?? 0);
      console.log(`  ${path}: ${was} → ${n}`);
      changed++;
    }
  }

  console.log(changed ? `Holat birlashtirildi (${changed} fayl).` : "Holat o'zgarmadi.");
}

main().catch((e) => {
  console.error(`Birlashtirish xatosi: ${e.message}`);
  // Bu qadam nashrni to'xtatmasin.
});
