// dedupe-posts.mjs — chiqib bo'lgan xabarlar orasidagi takrorlarni tozalaydi.
//
// Bir martalik tuzatuv: dastlab takror tekshiruvi bitta maqola havolasiga qarab
// ishlagani uchun bir voqea ikki xil so'z bilan ikki marta chiqib ketgan edi.
// Har bir voqeadan eng birinchi chiqqani qoldiriladi.
//
// node src/dedupe-posts.mjs          — nimani o'chirishini ko'rsatadi
// node src/dedupe-posts.mjs --apply  — o'chiradi

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

const STOP = new Set(
  ("va bilan uchun ham bu shu o'z uni unga ular bir ikki har qanday keyin oldin"
   + " kompaniyasi kompaniyani kompaniya haqida bo'yicha ustidan orqali").split(" ")
);

const tokens = (s) =>
  new Set(
    s.toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9Ѐ-ӿ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );

const overlap = (a, b) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));

// Eng eski birinchi — takror topilganda birinchi chiqqani qoladi.
const byAge = posts.slice().sort((a, b) => (a.created || "").localeCompare(b.created || ""));

const kept = [];
const dropped = [];

for (const p of byAge) {
  const t = tokens(`${p.title} ${p.summary}`);
  const twin = kept.find((k) => {
    const shared = overlap(t, k.toks);
    return shared >= 3 && shared / Math.min(t.size, k.toks.size) >= 0.5;
  });
  if (twin) dropped.push({ p, twin: twin.p });
  else kept.push({ p, toks: t });
}

console.log(`${posts.length} ta xabar → ${kept.length} ta qoladi, ${dropped.length} ta takror\n`);
for (const d of dropped) {
  console.log(`  o'chadi:  ${d.p.title}`);
  console.log(`  qoladi:   ${d.twin.title}\n`);
}

if (!APPLY) {
  console.log("Hech narsa o'zgartirilmadi. O'chirish uchun: node src/dedupe-posts.mjs --apply");
} else {
  const out = kept.map((k) => k.p).sort((a, b) => b.published.localeCompare(a.published));
  await writeFile(join(ROOT, "data/posts.json"), JSON.stringify(out, null, 2));
  console.log(`Yozildi: data/posts.json — ${out.length} ta xabar`);
}
