// audit.mjs — qurilgan saytni tekshiradi.
//
// node src/audit.mjs
//
// Qidiruv tizimlari va o'quvchi uchun muhim bo'lgan narsalarni sanab chiqadi:
// meta teglar, ichki havolalar, JSON-LD, sitemap, sahifa vazni.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

const problems = [];
const notes = [];
const add = (level, page, msg) => (level === "xato" ? problems : notes).push({ page, msg });

// docs/ ichidagi barcha HTML sahifalar
async function htmlFiles(dir = DOCS, base = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p, `${base}/${e.name}`)));
    else if (e.name === "index.html") out.push({ file: p, url: `${base}/` });
    // Qidiruv tizimlarining tasdiqlash fayllari .html bilan tugaydi, lekin
    // sahifa emas — ular ichida bitta qator matn turadi. Ularni sahifa deb
    // tekshirsak "h1 yo'q", "sitemapda yo'q" kabi yolg'on xatolar chiqadi.
    else if (/^(google[0-9a-f]+|BingSiteAuth|yandex_[0-9a-f]+)\.html$/i.test(e.name)) continue;
    else if (e.name.endsWith(".html")) out.push({ file: p, url: `${base}/${e.name}` });
  }
  return out;
}

const pick = (html, re) => (html.match(re) || [])[1];

async function main() {
  const pages = await htmlFiles();
  const titles = new Map();
  const descs = new Map();
  const internal = new Set();
  let totalBytes = 0;
  let biggest = { url: "", size: 0 };

  for (const { file, url } of pages) {
    const html = await readFile(file, "utf8");
    const size = Buffer.byteLength(html);
    totalBytes += size;
    if (size > biggest.size) biggest = { url, size };

    // --- meta teglar ---
    const title = pick(html, /<title>([\s\S]*?)<\/title>/);
    const desc = pick(html, /<meta name="description" content="([^"]*)"/);
    const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
    const robots = pick(html, /<meta name="robots" content="([^"]*)"/);
    const ogImage = pick(html, /<meta property="og:image" content="([^"]*)"/);

    if (!title) add("xato", url, "sarlavha yo'q");
    if (!desc) add("xato", url, "tavsif yo'q");
    if (!canonical) add("xato", url, "canonical yo'q");
    if (!ogImage) add("xato", url, "og:image yo'q");

    // Uzunlik eslatmalari faqat qidiruvga chiqadigan sahifalarga tegishli:
    // noindex sahifaning Google'da parchasi ham bo'lmaydi, kesiladigan joyi ham.
    const noindex = robots && robots.includes("noindex");
    if (!noindex) {
      if (title && title.length > 65) add("eslatma", url, `sarlavha uzun (${title.length} belgi, Google ~60 da kesadi)`);
      if (desc && desc.length > 165) add("eslatma", url, `tavsif uzun (${desc.length} belgi)`);
      if (desc && desc.length < 60) add("eslatma", url, `tavsif qisqa (${desc.length} belgi)`);
    }

    if (!noindex && title) {
      if (titles.has(title)) add("xato", url, `sarlavha takrorlanadi: ${titles.get(title)}`);
      else titles.set(title, url);
    }
    if (!noindex && desc) {
      if (descs.has(desc)) add("eslatma", url, `tavsif takrorlanadi: ${descs.get(desc)}`);
      else descs.set(desc, url);
    }

    // --- sarlavhalar ierarxiyasi ---
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 === 0) add("xato", url, "h1 yo'q");
    if (h1 > 1) add("xato", url, `${h1} ta h1 bor, bittasi bo'lishi kerak`);

    // --- canonical o'z manziliga mos kelsinmi ---
    if (canonical && !canonical.endsWith(url)) {
      add("xato", url, `canonical boshqa manzilga ishora qiladi: ${canonical}`);
    }

    // --- JSON-LD ---
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (e) {
        add("xato", url, `JSON-LD buzuq: ${e.message.slice(0, 60)}`);
      }
    }

    // --- ichki havolalar ---
    // <script> ichidagi matn havola emas. Qidiruv sahifasining kodida
    // '/x/' + it.s + '/' degan satr bor va u "bo'sh joyga olib boruvchi
    // havola" deb xato belgilanardi.
    const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    for (const m of noScript.matchAll(/href="(\/[^"]*)"/g)) internal.add(m[1]);
  }

  // --- ichki havolalar haqiqatan mavjudmi ---
  for (const href of internal) {
    if (href.startsWith("//") || href.includes("#")) continue;
    const target = href.endsWith("/") ? join(DOCS, href, "index.html") : join(DOCS, href);
    try {
      await stat(target);
    } catch {
      add("xato", href, "ichki havola bo'sh joyga olib boradi");
    }
  }

  // --- sitemap ---
  const sitemap = await readFile(join(DOCS, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const sitemapPaths = new Set(locs.map((l) => l.replace(/^https?:\/\/[^/]+/, "")));
  for (const p of sitemapPaths) {
    const target = p.endsWith("/") ? join(DOCS, p, "index.html") : join(DOCS, p);
    try {
      await stat(target);
    } catch {
      add("xato", p, "sitemapda bor, lekin sahifa yo'q");
    }
  }
  // Indekslanadigan sahifa sitemapga tushganmi
  for (const { file, url } of pages) {
    const html = await readFile(file, "utf8");
    if ((html.match(/<meta name="robots" content="([^"]*)"/) || [])[1]?.includes("noindex")) continue;
    // Xabar sahifasi HAR DOIM sitemapda bo'lishi kerak. U yerda bo'lmasa
    // demak sahifa bor, lekin posts.json da yo'q — ya'ni xabar ma'lumotdan
    // yo'qolgan va keyingi qurilishda sahifa ham o'chib ketadi. Bu eslatma
    // emas, nosozlik. (Bir marta sodir bo'lgan: ikkita yugurish rebase'da
    // to'qnashib, posts.json bir yugurishnikiga, sahifa boshqasinikiga
    // o'tib qolgan.)
    if (!sitemapPaths.has(url)) {
      add(url.startsWith("/x/") ? "xato" : "eslatma", url,
        url.startsWith("/x/") ? "sitemapda yo'q — sahifa bor, lekin posts.json da yo'q" : "sitemapda yo'q");
    }
  }

  // --- 404 sahifasi ---
  try {
    await stat(join(DOCS, "404.html"));
  } catch {
    add("xato", "/404.html", "404 sahifasi yo'q — noto'g'ri manzilda GitHub'ning oq sahifasi chiqadi");
  }

  // --- robots.txt ---
  const robotsTxt = await readFile(join(DOCS, "robots.txt"), "utf8").catch(() => "");
  if (!robotsTxt.includes("Sitemap:")) add("xato", "/robots.txt", "sitemap havolasi yo'q");

  // --- RSS ---
  const rss = await readFile(join(DOCS, "rss.xml"), "utf8").catch(() => "");
  if (!rss.includes("<atom:link")) add("eslatma", "/rss.xml", "atom:link self havolasi yo'q");

  // ---------- hisobot ----------
  console.log(`Tekshirildi: ${pages.length} ta sahifa, jami ${(totalBytes / 1024).toFixed(0)} KB`);
  console.log(`Eng og'ir sahifa: ${biggest.url} — ${(biggest.size / 1024).toFixed(0)} KB\n`);

  if (problems.length) {
    console.log(`XATOLAR (${problems.length}):`);
    for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p.page}\n      ${p.msg}`);
    if (problems.length > 40) console.log(`  ... yana ${problems.length - 40} ta`);
  } else {
    console.log("Xato topilmadi.");
  }

  if (notes.length) {
    console.log(`\nESLATMALAR (${notes.length}):`);
    const grouped = new Map();
    for (const n of notes) {
      const key = n.msg.replace(/\d+/g, "N").slice(0, 60);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(n.page);
    }
    for (const [msg, pagesList] of grouped) {
      console.log(`  · ${msg} — ${pagesList.length} ta sahifa`);
      for (const p of pagesList.slice(0, 3)) console.log(`      ${p}`);
      if (pagesList.length > 3) console.log(`      ...`);
    }
  }

  process.exitCode = problems.length ? 1 : 0;
}

main();
