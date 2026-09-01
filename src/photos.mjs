// photos.mjs — xabarlarga haqiqiy surat topadi.
//
// NEGA BOSHQA SAYTNING SURATINI OLMAYMIZ. CNBC yoki TechCrunch'dagi suratlar
// ularning mulki (ko'pincha Getty yoki kompaniyaning matbuot xizmatidan,
// litsenziya bilan). Ularni ko'chirib chiqarish mualliflik huquqini buzadi.
//
// O'RNIGA: Wikimedia Commons'dagi erkin litsenziyali suratlar. Ular qonuniy,
// tekin va o'sha odamlar bilan o'sha kompaniyalarni ko'rsatadi. Sharti bitta —
// muallif va litsenziya ko'rsatilishi kerak, buni har bir suratda qilamiz.
//
// Fayllar assets/photos.json da QO'LDA tanlangan. Avtomatik qidiruv sinovda
// aloqasiz suratlarni qaytardi, xabar yonidagi noto'g'ri surat esa suratsizlikdan
// yomonroq. Ro'yxatda yo'q mavzu kod bilan chizilgan muqovada qoladi.

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "AiLentaBot/1.0 (https://ai.maqsudjon.com; polatovmaqsudjon1@gmail.com)";
const WIDTH = 1200;
const THUMB_WIDTH = 400;   // lentadagi kichik rasm uchun alohida — katta faylni 64 pikselga siqish isrof

const slug = (s) =>
  String(s).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const stripTags = (s = "") =>
  String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// ---------- qaysi surat qaysi xabarga ----------

let MAP = null;
let FOCUS = {};

async function loadMap() {
  if (MAP) return MAP;
  const raw = JSON.parse(await readFile(join(ROOT, "assets/photos.json"), "utf8"));
  FOCUS = raw.fokus || {};
  const entries = [];
  for (const group of ["odamlar", "kompaniyalar", "mavzular"]) {
    for (const [key, file] of Object.entries(raw[group] || {})) {
      entries.push({ key, file, group });
    }
  }
  // Uzun nom oldin tekshirilsin: "john ternus" "apple" dan ustun turadi.
  entries.sort((a, b) => b.key.length - a.key.length);
  MAP = entries;
  return MAP;
}

// Xabarga mos nomni topadi. Avval odam va kompaniya nomi matndan qidiriladi,
// keyin teglar bo'yicha mavzu.
export async function matchEntity(post) {
  const map = await loadMap();
  const text = ` ${String(post.title)} ${String(post.summary)} `.toLowerCase();
  const tags = (post.tags || []).map((t) => String(t).toLowerCase());

  for (const e of map) {
    if (e.group === "mavzular") continue;
    if (text.includes(` ${e.key}`) || tags.includes(e.key)) return e;
  }
  for (const e of map) {
    if (e.group !== "mavzular") continue;
    if (tags.includes(e.key)) return e;
  }
  return null;
}

// ---------- Commons'dan ma'lumot ----------

async function commonsInfo(file, width = WIDTH) {
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(width),
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, {
    headers: { "user-agent": UA },
  });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const j = await res.json();
  const page = Object.values(j.query?.pages || {})[0];
  if (!page || page.missing !== undefined) throw new Error("fayl topilmadi");
  const ii = page.imageinfo?.[0];
  const meta = ii?.extmetadata || {};
  return {
    url: ii.thumburl || ii.url,
    page: ii.descriptionurl,
    author: stripTags(meta.Artist?.value) || "noma'lum",
    license: stripTags(meta.LicenseShortName?.value) || "erkin litsenziya",
    licenseUrl: meta.LicenseUrl?.value || "",
  };
}

// ---------- yuklab olish va keshlash ----------

const exists = (p) => access(p).then(() => true).catch(() => false);

export async function ensurePhotos(posts) {
  const cachePath = join(ROOT, "data/photos-cache.json");
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {}

  const needed = new Map();
  for (const p of posts) {
    const e = await matchEntity(p);
    if (e) needed.set(e.key, e.file);
  }

  await mkdir(join(ROOT, "docs/photo"), { recursive: true });
  let fetched = 0;

  for (const [key, file] of needed) {
    const name = `${slug(key)}.jpg`;
    const local = join(ROOT, "docs/photo", name);

    if (cache[key]?.file === file && (await exists(local))) continue;

    try {
      const info = await commonsInfo(file);
      const img = await fetch(info.url, { headers: { "user-agent": UA } });
      if (!img.ok) throw new Error(`rasm ${img.status}`);
      await writeFile(local, Buffer.from(await img.arrayBuffer()));

      const smallName = `${slug(key)}-sm.jpg`;
      const small = await commonsInfo(file, THUMB_WIDTH);
      const smallImg = await fetch(small.url, { headers: { "user-agent": UA } });
      if (smallImg.ok) {
        await writeFile(join(ROOT, "docs/photo", smallName), Buffer.from(await smallImg.arrayBuffer()));
      }

      cache[key] = {
        file,
        src: `/photo/${name}`,
        thumb: `/photo/${smallName}`,
        author: info.author,
        license: info.license,
        licenseUrl: info.licenseUrl,
        page: info.page,
      };
      fetched++;
      // Commons ko'p so'rovni cheklaydi — ketma-ket va bo'shashib so'raymiz.
      await new Promise((r) => setTimeout(r, 700));
    } catch (e) {
      console.error(`  ✗ surat olinmadi (${key}): ${e.message}`);
    }
  }

  await writeFile(cachePath, JSON.stringify(cache, null, 2));
  if (fetched) console.log(`  ✓ ${fetched} ta yangi surat yuklandi (jami ${Object.keys(cache).length})`);
  return cache;
}

// Xabarga tegishli surat yozuvi (yoki null).
//
// focus — suratni keng kartochkaga kesishda vertikal markaz. Tik suratni
// markazdan kessak odamning boshi kesilib qoladi, shuning uchun har biriga
// alohida qiymat berilgan.
export async function photoFor(post, cache) {
  const e = await matchEntity(post);
  if (!e) return null;
  const c = cache[e.key];
  if (!c) return null;
  await loadMap();
  return { ...c, entity: e.key, focus: FOCUS[e.key] ?? 0.5 };
}

if (process.argv[1] && process.argv[1].endsWith("photos.mjs")) {
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const cache = await ensurePhotos(posts);
  let withPhoto = 0;
  for (const p of posts) if (await photoFor(p, cache)) withPhoto++;
  console.log(`  ${withPhoto}/${posts.length} ta xabarda haqiqiy surat bor`);
}
