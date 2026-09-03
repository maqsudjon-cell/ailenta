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
import sharp from "sharp";
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

  // Commons kategoriyalaridan yig'ilgan havza. Qo'lda tanlangan suratlar
  // birinchi turadi (ular tekshirilgan), havzadagilar ularni to'ldiradi.
  //
  // Sabab: qo'lda tanlash 31 ta surat berdi va ular 346 xabarda aylanib
  // yurdi — Anthropic suratlari 15-16 tadan xabarda takrorlandi. Havza
  // buni 188 taga chiqardi.
  let pool = {};
  try {
    pool = JSON.parse(await readFile(join(ROOT, "assets/photo-pool.json"), "utf8"));
  } catch {}

  const entries = [];
  for (const group of ["odamlar", "kompaniyalar", "mavzular"]) {
    for (const [key, val] of Object.entries(raw[group] || {})) {
      // Bir mavzuga bir nechta surat: ketma-ket xabarlarda bir xil rasm
      // chiqmasligi uchun. Eski yozuvlar (bitta satr) ham ishlayveradi.
      const hand = Array.isArray(val) ? val : [val];
      const extra = (pool[key] || []).filter((f) => !hand.includes(f));
      entries.push({ key, files: [...hand, ...extra], group });
    }
  }

  // Havzada bor, lekin qo'lda tanlanmagan mavzular ham qo'shilsin.
  const known = new Set(entries.map((e) => e.key));
  for (const [key, files] of Object.entries(pool)) {
    if (key.startsWith("_") || known.has(key) || !files.length) continue;
    entries.push({ key, files, group: "havza" });
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
    iiprop: "url|extmetadata|size",
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
    width: ii.width,
    height: ii.height,
    author: stripTags(meta.Artist?.value) || "noma'lum",
    license: stripTags(meta.LicenseShortName?.value) || "erkin litsenziya",
    licenseUrl: meta.LicenseUrl?.value || "",
  };
}

// ---------- kesish markazini o'zi topish ----------
//
// Keng kartochkaga sig'dirilganda tik surat balandligining yarmigacha qismi
// kesiladi. Markazdan kessak odamning boshi yoki binoning logotipi ketadi —
// ular deyarli har doim suratning tepasida bo'ladi.
//
// Tayyor kutubxonalar sinovdan o'tmadi: smartcrop va sharp'ning "attention"
// usuli MediaTek, Salesforce va robot suratlarida kesimni PASTDAN oldi, ya'ni
// aynan teskari (o'rtacha xato 0.86 va 0.56). Ular kontrast ko'p joyni
// tanlaydi, mavzu esa boshqa joyda bo'lishi mumkin.
//
// Nisbatga qarab qo'yilgan oddiy qoida ancha aniq chiqdi (o'rtacha xato 0.09).
export function autoFocus(width, height) {
  if (!width || !height) return 0.5;
  const ar = width / height;
  if (ar >= 1.4) return 0.5;    // keng surat — deyarli kesilmaydi
  if (ar >= 1.0) return 0.35;   // kvadratga yaqin
  if (ar >= 0.8) return 0.28;   // biroz tik
  return 0.18;                  // baland tik surat — mavzu tepada
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
    if (e) needed.set(e.key, e.files);
  }

  await mkdir(join(ROOT, "docs/photo"), { recursive: true });
  let fetched = 0;

  // Variantlar bitta ro'yxatga yoyiladi. Birinchisi eski nom bilan qoladi
  // (qayta yuklab o'tirmaslik uchun), qolganlari -2, -3 qo'shimchasi bilan.
  const jobs = [];
  for (const [key, files] of needed) {
    files.forEach((file, i) => {
      jobs.push({
        id: i === 0 ? key : `${key}#${i}`,
        base: i === 0 ? slug(key) : `${slug(key)}-${i + 1}`,
        file,
      });
    });
  }

  for (const { id, base, file } of jobs) {
    const key = id;
    const name = `${base}.jpg`;
    const local = join(ROOT, "docs/photo", name);

    if (cache[key]?.file === file && (await exists(local))) continue;

    try {
      const info = await commonsInfo(file);
      const img = await fetch(info.url, { headers: { "user-agent": UA } });
      if (!img.ok) throw new Error(`rasm ${img.status}`);
      // Commons'dan kelgan fayl siqilmagan — o'rtacha 400 KB, ba'zisi 1 MB.
      // Havza 31 tadan 106 taga o'sgach bu docs/photo ni 13 MB dan 42 MB ga
      // chiqardi, ya'ni muqovalarni JPEG'ga o'tkazib qo'lga kiritgan
      // yutuqni yo'qqa chiqardi. Ko'rinishga ta'sir qilmaydigan darajada
      // siqamiz.
      const raw = Buffer.from(await img.arrayBuffer());
      let out = raw;
      try {
        out = await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      } catch { /* siqilmasa asl faylni qoldiramiz */ }
      await writeFile(local, out);

      const smallName = `${base}-sm.jpg`;
      const small = await commonsInfo(file, THUMB_WIDTH);
      const smallImg = await fetch(small.url, { headers: { "user-agent": UA } });
      if (smallImg.ok) {
        const rawSmall = Buffer.from(await smallImg.arrayBuffer());
        let outSmall = rawSmall;
        try {
          outSmall = await sharp(rawSmall).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
        } catch {}
        await writeFile(join(ROOT, "docs/photo", smallName), outSmall);
      }

      cache[key] = {
        file,
        src: `/photo/${name}`,
        thumb: `/photo/${smallName}`,
        focus: autoFocus(info.width, info.height),
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
export async function photoFor(post, cache, variant = 0) {
  const e = await matchEntity(post);
  if (!e) return null;
  await loadMap();
  const i = ((variant % e.files.length) + e.files.length) % e.files.length;
  const key = i === 0 ? e.key : `${e.key}#${i}`;
  const c = cache[key] || cache[e.key];
  if (!c) return null;
  // Fokus o'zi hisoblanadi; ro'yxatdagi qiymat faqat qoida xato bo'lgan
  // kamdan-kam holat uchun (masalan robotning boshi suratning eng tepasida).
  return { ...c, entity: e.key, focus: FOCUS[e.key] ?? c.focus ?? 0.5 };
}

// Butun ro'yxatga surat taqsimlaydi.
//
// NEGA BITTALAB EMAS. Har mavzuga bitta surat biriktirilganda Anthropic
// haqidagi 18 ta xabar bitta rasmni ulashardi va lentada ketma-ket ikki
// bir xil surat chiqardi. Tasodifiy tanlash ham buni yechmaydi — qo'shni
// ikkitasi baribir bir xil tushishi mumkin.
//
// Shuning uchun navbat: har mavzu uchun hisoblagich yuritiladi va ro'yxat
// bo'ylab suratlar aylanadi. Bu qo'shni xabarlarda bir xil rasmni MUTLAQO
// istisno qiladi va natija barqaror — bir xil ro'yxat har doim bir xil
// taqsimot beradi.
export async function assignPhotos(posts, cache) {
  const seen = new Map();
  const out = [];
  for (const post of posts) {
    const e = await matchEntity(post);
    if (!e) { out.push(null); continue; }
    const n = seen.get(e.key) || 0;
    seen.set(e.key, n + 1);
    out.push(await photoFor(post, cache, n));
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("photos.mjs")) {
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const cache = await ensurePhotos(posts);
  const assigned = await assignPhotos(posts, cache);
  const withPhoto = assigned.filter(Boolean).length;
  const used = new Set(assigned.filter(Boolean).map((a) => a.src));
  console.log(`  ${used.size} xil surat ishlatilyapti`);
  console.log(`  ${withPhoto}/${posts.length} ta xabarda haqiqiy surat bor`);
}
