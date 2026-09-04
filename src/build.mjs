// build.mjs — posts.json dan butun saytni quradi.
//
//   node src/build.mjs          → docs/ (nashr uchun: bosh sahifa, xabarlar,
//                                 mavzular, kunlar, arxiv, sitemap, RSS)
//   node src/build.mjs lenta    → site/lenta/ (faqat dizaynni ko'rish uchun)

import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";
import { postPage, listPage, topicsPage, notFoundPage, photosPage, instagramPage, searchPage, aboutPage, statsPage, glossaryPage } from "../templates/pages.mjs";
import { caption } from "./instagram.mjs";
import { slugTag } from "../templates/parts.mjs";
import { buildImages } from "./images.mjs";
import { ensurePhotos, assignPhotos } from "./photos.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
    year: d.getUTCFullYear(),
    date: `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`,
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
  };
}

export function ago(iso) {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins} daqiqa oldin`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return d === 1 ? "kecha" : `${d} kun oldin`;
}

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// Reuters, WSJ va Bloomberg'da ochiq RSS yo'q — ular Google News orqali topiladi
// va havola o'sha yerdan o'tadi. Buni yashirmasdan, aynan shunday yozamiz.
export const via = (p) =>
  p.source.indirect ? "Google News orqali" : hostOf(p.source.url);

const U = { tashkent, ago, esc, hostOf, via, MONTHS };

const write = async (relPath, body) => {
  const full = join(ROOT, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, body);
  return body.length;
};

// ---------- sitemap va RSS ----------

function sitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${esc(SITE.url)}${esc(u.path)}</loc>
    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function rss(posts, opt = {}) {
  const now = new Date().toUTCString();
  const title = opt.title || SITE.name;
  const link = opt.link || SITE.url;
  const description = opt.description || SITE.description;
  const self = opt.self || `${SITE.url}/rss.xml`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${esc(title)}</title>
  <link>${esc(link)}</link>
  <description>${esc(description)}</description>
  <language>uz</language>
  <lastBuildDate>${now}</lastBuildDate>
  <atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>
${posts.slice(0, 50).map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE.url}/x/${esc(p.slug)}/</link>
    <guid isPermaLink="true">${SITE.url}/x/${esc(p.slug)}/</guid>
    <pubDate>${new Date(p.published).toUTCString()}</pubDate>
    <description>${esc(p.summary)}</description>
    ${(p.tags || []).map((t) => `<category>${esc(t)}</category>`).join("")}
    <media:content url="${SITE.url}/og/${esc(p.slug)}.jpg" medium="image" type="image/jpeg" width="1200" height="630"/>
    <media:thumbnail url="${SITE.url}/og/${esc(p.slug)}.jpg"/>
  </item>`).join("\n")}
</channel>
</rss>
`;
}

// Instagram uchun alohida lenta.
//
// Vositachi xizmat (Make, Zapier va h.k.) shu lentani kuzatadi va yangi
// yozuvni Instagram'ga o'zi joylaydi. Shuning uchun bu yerda oddiy RSS'dan
// ikki farq bor: tavsif — postning to'liq matni (xulosa emas), va har
// yozuvda 1080x1350 rasmga havola turadi. Vositachiga faqat ikki maydonni
// ulash qoladi.
//
// Faqat muhimligi 4 va undan yuqori xabarlar kiradi — Instagram tasmasi
// har uch soatda to'lib ketmasligi kerak.
function instagramFeed(items) {
  const now = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${esc(SITE.name)} — Instagram</title>
  <link>${SITE.url}</link>
  <description>Instagram uchun tayyor postlar: 1080x1350 rasm va to'liq matn.</description>
  <language>uz</language>
  <lastBuildDate>${now}</lastBuildDate>
  <atom:link href="${SITE.url}/instagram.xml" rel="self" type="application/rss+xml"/>
${items.map((it) => {
  const img = `${SITE.url}/ig/${it.slug}.jpg`;
  return `  <item>
    <title>${esc(it.title)}</title>
    <link>${SITE.url}/x/${esc(it.slug)}/</link>
    <guid isPermaLink="true">${SITE.url}/x/${esc(it.slug)}/</guid>
    <pubDate>${new Date(it.published).toUTCString()}</pubDate>
    <description>${esc(it.caption)}</description>
    <enclosure url="${img}" length="${it.bytes}" type="image/jpeg"/>
    <media:content url="${img}" medium="image" type="image/jpeg" width="1080" height="1350"/>
  </item>`;
}).join("\n")}
</channel>
</rss>
`;
}

// Google News uchun alohida sitemap. Oddiy sitemapdan farqi — unda maqola
// sanasi va tili news: nom fazosida beriladi va faqat SO'NGGI ikki kunlik
// xabarlar bo'ladi. Google News aynan shunisini kutadi; oddiy sitemap
// yangilik saytini indekslashga yetarli emas.
function newsSitemap(posts) {
  const cutoff = Date.now() - 48 * 3600_000;
  const fresh = posts.filter((p) => Date.parse(p.published) >= cutoff).slice(0, 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${fresh.map((p) => `  <url>
    <loc>${SITE.url}/x/${esc(p.slug)}/</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(SITE.name)}</news:name>
        <news:language>uz</news:language>
      </news:publication>
      <news:publication_date>${new Date(p.published).toISOString()}</news:publication_date>
      <news:title>${esc(p.title)}</news:title>
    </news:news>
  </url>`).join("\n")}
</urlset>
`;
}

// llms.txt — sayt xaritasining AI tizimlari uchun mo'ljallangan ko'rinishi.
//
// Sabab: til modellari HTML sahifani o'qiyotganda navigatsiya, uslub va
// takrorlanuvchi qismlarni mazmundan ajratishga kuch sarflaydi. llms.txt
// esa toza matn: sayt nima haqida, qanday bo'limlari bor va bugun nima
// chiqdi. Bu yangi, hali majburiy bo'lmagan standart, lekin arzon va
// zarari yo'q.
function llmsTxt(posts, u) {
  const today = posts.slice(0, 30);
  const sources = [...new Set(posts.map((p) => p.source.name))].sort();
  return `# ${SITE.name}

> ${SITE.description}

Sayt sun'iy intellekt yangiliklarini ochiq manbalardan yig'adi, o'zbek
tilida qisqa xulosa yozadi va har birida asl manbaga havola qoldiradi.
Xulosalar til modeli yordamida tayyorlanadi; asl matn tarjima qilinmaydi.
Yangilanish: har soatda. Til: o'zbek (lotin).

## Bo'limlar

- [Bosh sahifa](${SITE.url}/): so'nggi xabarlar
- [Arxiv](${SITE.url}/arxiv/): kunlar bo'yicha barcha xabarlar
- [Mavzular](${SITE.url}/mavzular/): mavzu bo'yicha ro'yxat
- [RSS](${SITE.url}/rss.xml): mashina o'qiydigan lenta
- [Suratlar va litsenziyalar](${SITE.url}/rasmlar/): rasmlarning manbasi

## So'nggi xabarlar

${today.map((p) => `- [${p.title}](${SITE.url}/x/${p.slug}/): ${p.summary}`).join("\n")}

## Manbalar

Xabarlar quyidagi nashrlardan yig'iladi: ${sources.join(", ")}.

## Foydalanish

Matndan foydalansangiz manba sifatida ${SITE.domain} ni va xabardagi asl
nashrni ko'rsating. Suratlar Wikimedia Commons'dan, o'z litsenziyalari
bilan — ular ${SITE.url}/rasmlar/ sahifasida sanab o'tilgan.
`;
}

// Qidiruv indeksi. GitHub Pages'da server yo'q, shuning uchun qidiruv
// brauzerda ishlaydi: indeks bir marta yuklanadi va filtrlash mahalliy
// bajariladi. 368 xabar uchun ~80 KB — bir martalik yuklash.
//
// Xulosa qisqartiriladi: to'liq matn indeksni ikki barobar kattalashtiradi,
// qidiruvga esa birinchi jumla yetadi.
function searchIndex(posts) {
  return JSON.stringify(posts.map((p) => ({
    s: p.slug,
    t: p.title,
    d: p.published.slice(0, 10),
    g: (p.tags || []).slice(0, 4),
    m: p.source.name,
    x: p.summary.slice(0, 140),
  })));
}

// ---------- asosiy ----------

async function buildPreview(name) {
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const { render } = await import(`../templates/${name}.mjs`);
  const n = await write(join("site", name, "index.html"), render(posts, U));
  console.log(`  ✓ site/${name}/index.html  (${(n / 1024).toFixed(1)} KB)`);
}

async function buildSite() {
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"))
    .sort((a, b) => b.published.localeCompare(a.published));

  // Eski sahifalar qolib ketmasin: xabar sahifalari har safar qaytadan quriladi.
  await rm(join(ROOT, "docs/x"), { recursive: true, force: true });
  await rm(join(ROOT, "docs/mavzu"), { recursive: true, force: true });
  await rm(join(ROOT, "docs/kun"), { recursive: true, force: true });

  // Haqiqiy suratlar — Wikimedia Commons'dan, erkin litsenziya bilan.
  // Mos surat topilmagan xabar kod bilan chizilgan muqovada qoladi.
  const photoCache = await ensurePhotos(posts);

  // MUHIM: taqsimot bosh sahifa KO'RSATADIGAN tartibda bajariladi.
  //
  // Ilgari u e'lon tartibida ishlardi, bosh sahifa esa xabarlarni
  // muhimlik bo'yicha qayta tartiblaydi. Natijada hisoblangan masofa
  // o'quvchi ko'radigan masofaga mos kelmasdi va bir surat bosh
  // sahifada uch marta chiqib qolardi.
  // Tartib katta.mjs dagi bilan AYNAN bir xil bo'lishi kerak: u avval
  // muhimlik bo'yicha saralaydi, uchta yetakchini ajratadi, qolganini esa
  // sana bo'yicha QAYTA tartiblaydi. Faqat birinchi saralashni takrorlash
  // yetarli emas edi — masofa hisobi to'rtinchi xabardan boshlab siljib
  // ketardi.
  // Bosh sahifa eng yangi 60 tasini oladi va ularni O'ZI qayta tartiblaydi.
  // Masofani butun ro'yxat bo'ylab hisoblash yaramaydi: mening ro'yxatimda
  // 200 qadam uzoq turgan ikki xabar bosh sahifada yonma-yon tushishi
  // mumkin. Shuning uchun avval AYNAN bosh sahifaning ro'yxati va tartibi
  // bo'yicha taqsimlaymiz, qolganini keyin.
  const HOME = 60;
  const homeSet = posts.slice(0, HOME);
  const byRank = homeSet.slice().sort(
    (a, b) => b.importance - a.importance || b.published.localeCompare(a.published)
  );
  const homeOrder = [
    ...byRank.slice(0, 3),
    ...byRank.slice(3).sort((a, b) => b.published.localeCompare(a.published)),
  ];
  const displayOrder = [...homeOrder, ...posts.slice(HOME)];
  const assigned = await assignPhotos(displayOrder, photoCache);
  const bySlug = new Map(displayOrder.map((p, i) => [p.slug, assigned[i]]));
  posts.forEach((p) => { p.photo = bySlug.get(p.slug) || null; });
  const withPhoto = posts.filter((p) => p.photo).length;

  // Muqova rasmlari sahifalardan oldin: og:image ular tayyor bo'lgach ishlaydi.
  const imgCount = await buildImages(posts);

  const urls = [];
  let pages = 0;

  // Bosh sahifa — eng so'nggi 60 tasi.
  const { render } = await import(`../templates/${PUBLISH}.mjs`);
  await write("docs/index.html", render(posts.slice(0, 60), U));
  urls.push({ path: "/", lastmod: posts[0]?.published || new Date().toISOString(), freq: "hourly", priority: "1.0" });
  pages++;

  // Mavzu va kun bo'yicha guruhlar.
  const byTag = new Map();
  const byDay = new Map();
  for (const p of posts) {
    for (const t of p.tags || []) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(p);
    }
    const ymd = tashkent(p.published).ymd;
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd).push(p);
  }

  // Xabar sahifalari.
  for (const p of posts) {
    const related = posts
      .filter((r) => r.slug !== p.slug && (r.tags || []).some((t) => (p.tags || []).includes(t)))
      .slice(0, 4);
    await write(`docs/x/${p.slug}/index.html`, postPage(p, related, U));
    urls.push({ path: `/x/${p.slug}/`, lastmod: p.published, freq: "monthly", priority: "0.8" });
    pages++;
  }

  // Mavzu sahifalari. Bitta xabarli mavzu sahifasi qidiruv uchun bo'sh sahifa —
  // havolasi ishlaydi, lekin indeksga tushmaydi va sitemapga kirmaydi.
  //
  // Chegara 3: ikkita xabarli sahifa ham Google uchun yupqa va shunday
  // sahifalar ko'p bo'lsa butun saytning bahosi tushadi.
  let thinTags = 0;
  const THIN_BELOW = 3;
  for (const [tag, items] of byTag) {
    const path = `/mavzu/${slugTag(tag)}/`;
    const thin = items.length < THIN_BELOW;
    await write(`docs${path}index.html`, listPage({
      title: `${tag} — ${SITE.name}`,
      heading: tag,
      intro: `"${tag}" mavzusidagi ${items.length} ta sun'iy intellekt xabari o'zbek tilida. `
        + `Sahifa har uch soatda avtomat to'lib boradi, har bir xabarda asl manbaga havola bor.`,
      path,
      items,
      noindex: thin,
      feed: thin ? null : `${path}rss.xml`,
      trail: [{ label: "Bosh sahifa", href: "/" }, { label: "Mavzular", href: "/mavzular/" }, { label: tag }],
    }, U));
    if (thin) thinTags++;
    else {
      urls.push({ path, lastmod: items[0].published, freq: "daily", priority: "0.7" });
      // Mavzu bo'yicha alohida RSS: o'quvchi butun lentaga emas, faqat
      // qiziqqan mavzusiga obuna bo'la oladi.
      await write(`docs${path}rss.xml`, rss(items.slice(0, 30), {
        title: `${SITE.name} — ${tag}`,
        link: `${SITE.url}${path}`,
        description: `"${tag}" mavzusidagi sun'iy intellekt xabarlari o'zbek tilida.`,
        self: `${SITE.url}${path}rss.xml`,
      }));
    }
    pages++;
  }

  // Kun sahifalari.
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  for (const [ymd, items] of days) {
    const t = tashkent(`${ymd}T12:00:00Z`);
    const path = `/kun/${ymd}/`;
    await write(`docs${path}index.html`, listPage({
      title: `${t.day}-${t.month}, ${t.year} — ${SITE.name}`,
      heading: `${t.day}-${t.month}, ${t.year}`,
      intro: `${t.day}-${t.month}, ${t.year} kuni dunyoda sun'iy intellekt bo'yicha nima bo'ldi — `
        + `${items.length} ta xabar, ${[...new Set(items.map((x) => x.source.name))].length} ta manbadan, `
        + `o'zbek tilida va har birida asl maqolaga havola bilan.`,
      path,
      items,
      trail: [{ label: "Bosh sahifa", href: "/" }, { label: "Arxiv", href: "/arxiv/" }, { label: `${t.day}-${t.month}` }],
    }, U));
    urls.push({ path, lastmod: items[0].published, freq: "monthly", priority: "0.6" });
    pages++;
  }

  // Arxiv — kunlar OY bo'yicha guruhlangan.
  //
  // Ilgari hamma kun bitta uzun ro'yxatda edi. Bir necha oydan keyin u
  // yuzlab havolaga aylanadi va foydasiz bo'lib qoladi.
  const byMonth = new Map();
  for (const [ymd, items] of days) {
    const t = tashkent(`${ymd}T12:00:00Z`);
    const key = ymd.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, { label: `${t.month} ${t.year}`, days: [], n: 0 });
    const m = byMonth.get(key);
    m.days.push([ymd, t, items.length]);
    m.n += items.length;
  }
  const archiveLinks = [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, m]) => `
      <section class="arch-month">
        <h2>${esc(m.label)} <span>${m.n} ta xabar</span></h2>
        <div class="tagcloud">${m.days
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([ymd, t, n]) => `<a href="/kun/${ymd}/">${t.day}-${t.month}<b>${n}</b></a>`)
          .join("")}</div>
      </section>`)
    .join("");
  await write("docs/arxiv/index.html", listPage({
    title: `Arxiv — ${SITE.name}`,
    heading: "Arxiv",
    intro: `Oy va kun bo'yicha arxiv: ${byMonth.size} oy, ${days.length} kun, jami ${posts.length} ta `
      + `sun'iy intellekt xabari o'zbek tilida. Har bir kunni alohida ochish mumkin.`,
    path: "/arxiv/",
    items: [],
    trail: [{ label: "Bosh sahifa", href: "/" }, { label: "Arxiv" }],
    extra: archiveLinks,
  }, U));
  urls.push({ path: "/arxiv/", lastmod: posts[0]?.published || new Date().toISOString(), freq: "daily", priority: "0.6" });
  pages++;

  // Mavzular ro'yxati.
  const tagCounts = [...byTag.entries()].map(([t, items]) => [t, items.length]).sort((a, b) => b[1] - a[1]);
  await write("docs/mavzular/index.html", topicsPage(tagCounts, U));
  urls.push({ path: "/mavzular/", lastmod: posts[0]?.published || new Date().toISOString(), freq: "daily", priority: "0.6" });
  pages++;

  // Loyiha haqida — javobgarlik, aloqa, tuzatish siyosati, maxfiylik,
  // litsenziya va manbalar ro'yxati bitta sahifada.
  await write("docs/haqida/index.html", aboutPage(
    [...new Set(posts.map((p) => p.source.name))].sort(),
    { posts: posts.length, sources: new Set(posts.map((p) => p.source.name)).size },
    U
  ));
  urls.push({ path: "/haqida/", lastmod: new Date().toISOString(), freq: "monthly", priority: "0.6" });
  pages++;

  // Atamalar lug'ati — saytdagi yagona to'liq original kontent.
  {
    const terms = JSON.parse(await readFile(join(ROOT, "assets/atamalar.json"), "utf8")).atamalar;
    await write("docs/lugat/index.html", glossaryPage(terms, U));
    urls.push({ path: "/lugat/", lastmod: new Date().toISOString(), freq: "monthly", priority: "0.7" });
    pages++;
  }

  // Ochiq statistika — shaffoflik. Raqamlar ma'lumotdan hisoblanadi.
  {
    const srcCount = new Map();
    for (const p of posts) srcCount.set(p.source.name, (srcCount.get(p.source.name) || 0) + 1);
    const dayCount = new Map();
    for (const p of posts) {
      const t = tashkent(p.published);
      const key = t.ymd;
      if (!dayCount.has(key)) dayCount.set(key, { label: `${t.day}-${t.month}`, n: 0 });
      dayCount.get(key).n++;
    }
    const days = [...dayCount.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    await write("docs/statistika/index.html", statsPage({
      posts: posts.length,
      sources: srcCount.size,
      tags: byTag.size,
      withPhoto,
      perDay: days.length ? Math.round(posts.length / days.length) : 0,
      days,
      topSources: [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    }, U));
    urls.push({ path: "/statistika/", lastmod: new Date().toISOString(), freq: "daily", priority: "0.5" });
    pages++;
  }

  // Qidiruv — 368 xabar orasidan topish uchun. Brauzerda ishlaydi.
  await write("docs/qidiruv/index.html", searchPage(U));
  urls.push({ path: "/qidiruv/", lastmod: new Date().toISOString(), freq: "monthly", priority: "0.5" });
  pages++;

  // Suratlar va litsenziyalar — erkin litsenziyalar shuni talab qiladi.
  await write("docs/rasmlar/index.html", photosPage(photoCache, U));
  urls.push({ path: "/rasmlar/", lastmod: new Date().toISOString(), freq: "monthly", priority: "0.3" });
  pages++;

  // Instagram uchun qo'l sahifasi. Sitemap'ga QO'SHILMAYDI va hech qayerdan
  // havola qilinmaydi — bu tashqi o'quvchi uchun emas, joylash uchun quroldir.
  const igItems = [];
  for (const p of posts.filter((p) => p.importance >= 4).slice(0, 40)) {
    // Rasmi yo'q yozuv lentaga tushmasligi kerak — vositachi uni ocholmaydi.
    let bytes = 0;
    try { bytes = (await stat(join(ROOT, `docs/ig/${p.slug}.jpg`))).size; } catch { continue; }
    igItems.push({
      slug: p.slug,
      title: p.title,
      published: p.published,
      importance: p.importance,
      caption: caption(p),
      bytes,
    });
  }
  await write("docs/ig-post/index.html", instagramPage(igItems, U));
  pages++;

  // Vositachi xizmat uchun lenta. Sitemap'ga kirmaydi — bu mashina uchun.
  await write("docs/instagram.xml", instagramFeed(igItems.slice(0, 20)));

  // Topilmadi sahifasi — GitHub Pages uni noto'g'ri manzilda ko'rsatadi.
  await write("docs/404.html", notFoundPage(posts, U));
  pages++;

  // Sitemap, RSS, robots.
  await write("docs/sitemap.xml", sitemap(urls));
  await write("docs/news-sitemap.xml", newsSitemap(posts));
  await write("docs/rss.xml", rss(posts));
  await write("docs/llms.txt", llmsTxt(posts, U));
  await write("docs/search-index.json", searchIndex(posts));

  // AI to'plovchilarini ATAYLAB nom bilan ruxsat etamiz. `User-agent: *`
  // ularni baribir qamrab oladi, lekin ba'zi operatorlar o'z nomini
  // qidiradi, Google-Extended esa alohida: u Gemini va AI Overviews
  // uchun kontent olishni boshqaradi va ruxsatsiz saytni chetlab o'tadi.
  //
  // Bu sayt ochiq manbalardan yig'iladi va manbaga havola qoldiradi —
  // uni AI tizimlari o'qishi maqsadga muvofiq.
  const aiBots = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-User", "Claude-SearchBot",
    "Google-Extended", "PerplexityBot", "Perplexity-User",
    "Applebot-Extended", "Bingbot", "CCBot", "cohere-ai", "Meta-ExternalAgent",
  ];
  await write("docs/robots.txt",
    `User-agent: *\nAllow: /\n\n` +
    aiBots.map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n") +
    `\nSitemap: ${SITE.url}/sitemap.xml\n` +
    `Sitemap: ${SITE.url}/news-sitemap.xml\n`
  );

  console.log(`  ✓ ${pages} ta sahifa · ${byTag.size} mavzu (${thinTags} tasi indekssiz) · ${days.length} kun`);
  const freshCount = posts.filter((p) => Date.now() - Date.parse(p.published) < 48 * 3600_000).length;
  console.log(`  ✓ sitemap.xml (${urls.length} manzil) · rss.xml (${Math.min(posts.length, 50)} xabar) · robots.txt`);
  console.log(`  ✓ news-sitemap.xml (${freshCount} yangi xabar) · llms.txt`);
  console.log(`  ✓ ${imgCount} ta muqova rasmi · favicon · kanal logotipi`);
  console.log(`  ✓ ${withPhoto}/${posts.length} ta xabarda haqiqiy surat`);
  console.log(`  ✓ /ig-post/ va instagram.xml — ${igItems.length} ta Instagram kartochkasi`);
}

const only = process.argv[2];
if (!only) await buildSite();
else if (only === "all") for (const t of THEMES) await buildPreview(t);
else await buildPreview(only);
