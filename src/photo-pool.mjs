// photo-pool.mjs — Wikimedia Commons kategoriyalaridan surat havzasini yig'adi.
//
//   node src/photo-pool.mjs        → assets/photo-pool.json ni yangilaydi
//
// NEGA KATEGORIYA, kalit so'z emas: Commons'ning kalit so'z qidiruvi
// aloqasiz natija beradi. O'lchandi — "anthropic" so'roviga sopol idish va
// Misr to'qimachiligi qaytdi, "MediaTek" ga Bundesarchiv arxivi, "AMD" ga
// AQSh armiyasi. Kategoriyani esa odam to'ldiradi, shuning uchun ichidagi
// suratlar mavzuga tegishli bo'ladi.
//
// Kategoriya ham to'liq toza emas (logotip, diagramma, ekran rasmi tushadi),
// shuning uchun fayl nomi va o'lchami bo'yicha filtr qo'yiladi. Natija
// repozitoriyaga yoziladi va QO'LDA ko'rib chiqiladi — bu skript soatlik
// quvurda emas, kerak bo'lganda ishlatiladi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "user-agent": "ailenta/1.0 (https://ailenta.uz; surat havzasi)" };
const MIN_WIDTH = 900;
// Har mavzuga 12 ta. 24 ta xilma-xillikni sezilarli oshirmaydi, lekin
// repozitoriyaga ~50 MB qo'shadi — muqovalarni JPEG'ga o'tkazib qo'lga
// kiritgan yutuqni yo'qqa chiqaradi. 12 ta surat ~50 xabarga yetadi:
// har biri o'rtacha 4 marta chiqadi (ilgari 15-16 edi).
const PER_ENTITY = 12;

// Yangilik surati emas: logotip, chizma, ramz, muzey buyumi.
const JUNK = /logo|icon|wordmark|diagram|chart|graph|\bmap\b|screenshot|banner|symbol|flag|seal|schema|plot|infographic|textile|coin|stamp|painting|manuscript|signature|sculpture|drawing|sketch|cartoon|meme|qr[ _-]?code/i;

const api = async (params) => {
  const q = new URLSearchParams({ action: "query", format: "json", ...params });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: UA });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fromCategory(cat) {
  const j = await api({
    list: "categorymembers", cmtitle: `Category:${cat}`, cmtype: "file", cmlimit: "100",
  });
  const names = (j.query?.categorymembers || [])
    .map((x) => x.title.replace(/^File:/, ""))
    .filter((n) => /\.(jpe?g)$/i.test(n) && !JUNK.test(n));
  if (!names.length) return [];

  // O'lchami kichik surat muqova uchun yaramaydi.
  const out = [];
  for (let i = 0; i < names.length; i += 40) {
    const chunk = names.slice(i, i + 40);
    const info = await api({
      titles: chunk.map((n) => `File:${n}`).join("|"),
      prop: "imageinfo", iiprop: "size",
    });
    for (const page of Object.values(info.query?.pages || {})) {
      const ii = page.imageinfo?.[0];
      if (!ii || ii.width < MIN_WIDTH) continue;
      // Juda cho'ziq suratlar muqovada yomon kesiladi.
      const ar = ii.width / ii.height;
      if (ar < 0.5 || ar > 3.2) continue;
      out.push(page.title.replace(/^File:/, ""));
    }
    await sleep(200);
  }
  return out;
}

async function main() {
  const map = JSON.parse(await readFile(join(ROOT, "assets/photos.json"), "utf8"));
  const cats = map.kategoriyalar || {};
  if (!Object.keys(cats).length) {
    console.error("assets/photos.json da 'kategoriyalar' bo'limi yo'q.");
    process.exit(1);
  }

  let pool = {};
  try { pool = JSON.parse(await readFile(join(ROOT, "assets/photo-pool.json"), "utf8")); } catch {}
  const blocked = new Set(pool._blok || []);

  const out = { _izoh: pool._izoh || "Commons kategoriyalaridan yig'ilgan surat havzasi. node src/photo-pool.mjs bilan yangilanadi. _blok ro'yxatidagi fayllar chiqarib tashlanadi.", _blok: [...blocked] };

  for (const [key, catList] of Object.entries(cats)) {
    const list = Array.isArray(catList) ? catList : [catList];
    const files = [];
    for (const c of list) {
      try {
        files.push(...(await fromCategory(c)));
      } catch (e) {
        console.error(`  ✗ ${c}: ${e.message}`);
      }
      await sleep(300);
    }
    // Bir tadbirning o'nlab kadri bir xil suratdek ko'rinadi. O'lchandi:
    // "Dario Amodei" kategoriyasidan 22 ta fayl kelgan va hammasi bitta
    // uchrashuvning ketma-ket kadrlari edi. Nom asosidan (raqam va kadr
    // belgilarisiz) turkumlab, har turkumdan bittasini olamiz.
    const seriesKey = (f) => f
      .replace(/\.(jpe?g)$/i, "")
      .replace(/[\s_-]*\(?\d[\d\s_-]*\)?$/g, "")   // oxiridagi raqamlar
      .replace(/\s+\d{6,}$/g, "")                    // uzun id
      .trim().toLowerCase().slice(0, 34);

    const bySeries = new Map();
    for (const f of [...new Set(files)]) {
      if (blocked.has(f)) continue;
      const k = seriesKey(f);
      if (!bySeries.has(k)) bySeries.set(k, f);
    }
    const uniq = [...bySeries.values()].slice(0, PER_ENTITY);
    out[key] = uniq;
    console.log(`  ${String(uniq.length).padStart(3)}  ${key}  (${list.join(", ")})`);
  }

  await writeFile(join(ROOT, "assets/photo-pool.json"), JSON.stringify(out, null, 2) + "\n");
  const total = Object.entries(out).filter(([k]) => !k.startsWith("_")).reduce((a, [, v]) => a + v.length, 0);
  console.log(`\n  Jami: ${total} ta surat, ${Object.keys(cats).length} ta mavzuda.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
