// Bosh sahifa — "Katta": oq maydon, yirik tipografiya, kam rang.
//
// Sahifadagi har bir belgi biror ma'lumotni tashiydi:
//   sarlavha o'lchami  → xabar muhimligi
//   qamrov chizig'i    → nechta nashr yozgani
//   chapdagi vaqt      → Toshkent bo'yicha e'lon vaqti
//   kun ajratgichi     → xabar qaysi kunga tegishli

import { SITE, head, topbar, foot, publisher } from "./shell.mjs";
import { coverBar, sourceMark, feedItem, tagPath } from "./parts.mjs";
import { cardSvg } from "../src/cover.mjs";

export function render(posts, u) {
  const { tashkent, ago, esc } = u;
  const now = tashkent(new Date().toISOString());

  const sorted = posts.slice().sort(
    (a, b) => b.importance - a.importance || b.published.localeCompare(a.published)
  );
  const lead = sorted[0];
  const second = sorted.slice(1, 3);
  const rest = sorted.slice(3).sort((a, b) => b.published.localeCompare(a.published));

  const sources = [...new Set(posts.map((p) => p.source.name))].sort();

  // Eng ko'p yoziladigan mavzular. Kam uchraydiganlari tasmani to'ldirib,
  // foydali signalni ko'mib yuboradi — shuning uchun yettitasi.
  const tagCount = new Map();
  for (const p of posts) for (const t of p.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([t]) => t);

  const dayLabel = (ymd) => {
    const today = now.ymd;
    const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);
    if (ymd === today) return "Bugun";
    if (ymd === y) return "Kecha";
    const t = tashkent(`${ymd}T12:00:00Z`);
    return `${t.day}-${t.month}`;
  };

  const groups = [];
  for (const p of rest) {
    const ymd = tashkent(p.published).ymd;
    const g = groups.find((x) => x.ymd === ymd);
    if (g) g.items.push(p);
    else groups.push({ ymd, items: [p] });
  }

  const secondCard = (p) => `
    <article class="twin-item">
      <a class="twin-thumb" href="/x/${esc(p.slug)}/" aria-hidden="true" tabindex="-1">${
        p.photo
          // Kartochka 480 piksel keng, lekin to'liq surat 1200 piksel va ~300 KB.
          // srcset bilan brauzer ekranga mos o'lchamni o'zi tanlaydi: telefonda
          // 400 pikselli nusxa (~65 KB) yetarli.
          ? `<img class="thumb card photo" src="${esc(p.photo.src)}" width="480" height="320"
                 ${p.photo.thumb ? `srcset="${esc(p.photo.thumb)} 400w, ${esc(p.photo.src)} 1200w"
                 sizes="(max-width: 720px) 92vw, 480px"` : ""}
                 style="object-position:50% ${Math.round((p.photo.focus ?? 0.5) * 100)}%"
                 loading="lazy" decoding="async" alt="">`
          : cardSvg(p, 480, 270)
      }</a>
      <h2><a href="/x/${esc(p.slug)}/">${esc(p.title)}</a></h2>
      <p>${esc(p.summary)}</p>
      <div class="meta">
        ${sourceMark(p, u)}
        ${p.coverage > 1 ? coverBar(p.coverage) : ""}
        <span class="when-inline">${ago(p.published)}</span>
      </div>
    </article>`;

  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      inLanguage: "uz",
      publisher,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: sorted.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE.url}/x/${p.slug}/`,
        name: p.title,
      })),
    },
  ];

  return `${head({
    title: `${SITE.name} — sun'iy intellekt yangiliklari o'zbekcha`,
    description: SITE.description,
    path: "/",
    jsonld,
  })}
${topbar(now.hhmm)}

<div class="wrap">

  <section class="hero">
    <span class="eyebrow">Kunning asosiy xabari</span>
    <h1><a href="/x/${esc(lead.slug)}/">${esc(lead.title)}</a></h1>
    <p class="sum">${esc(lead.summary)}</p>
    <div class="meta">
      ${sourceMark(lead, u)}
      ${lead.coverage > 1 ? coverBar(lead.coverage) : ""}
      <span class="when-inline">${ago(lead.published)}</span>
    </div>
  </section>

  <!-- Mavzu tasmasi. Ilgari mavzular faqat /mavzular/ ortida edi va
       o'quvchi sayt nimalarni qamrab olishini bilmasdi. Endi eng ko'p
       yoziladigan mavzular bosh sahifada turadi. -->
  <nav class="topics" aria-label="Mavzular">
    ${topTags.map((t) => `<a href="${tagPath(t)}">${esc(t)}</a>`).join("")}
    <a class="topics-all" href="/mavzular/">Barchasi →</a>
  </nav>

  <!-- Saytning va'dasi. Ilgari kichik kulrang monospace qator edi va uch
       qatorga noqulay o'ralib, nosozlik jurnaliga o'xshab turardi. Bu —
       asosiy pozitsiya, shunday ko'rinishi kerak. -->
  <section class="creed">
    <p class="creed-line">${esc(SITE.tagline)}</p>
    <dl class="creed-facts">
      <div><dt>${posts.length}</dt><dd>xabar</dd></div>
      <div><dt>${sources.length}</dt><dd>manba</dd></div>
      <div><dt>1 soat</dt><dd>yangilanish</dd></div>
    </dl>
  </section>

  <section class="twin">
    ${second.map(secondCard).join("")}
  </section>

  <aside class="tgcta">
    <div class="tgcta-text">
      <b>Telegramda ham o'qing</b>
      <span>Kunning eng muhim xabarlari kanalga ham chiqadi — saytga kirmasdan
      xabardor bo'lasiz.</span>
    </div>
    <a href="https://t.me/${SITE.telegram}" target="_blank" rel="noopener">@${SITE.telegram}</a>
  </aside>

  ${groups.map((g) => `
  <section>
    <div class="daymark"><span><a href="/kun/${g.ymd}/">${dayLabel(g.ymd)}</a></span></div>
    ${g.items.map((p) => feedItem(p, u)).join("")}
  </section>`).join("")}

  <p class="note">
    <b>Bu sahifa avtomat to'ldiriladi.</b> Xabarlar ochiq manbalardan yig'iladi, xulosalar
    sun'iy intellekt yordamida o'zbekchada yoziladi va har birida asl manbaga havola turadi.
    Sarlavha o'lchami xabar muhimligini, yonidagi chiziq esa bu voqea haqida nechta nashr
    yozganini ko'rsatadi. Tahlil maqolalari qo'lda yoziladi va alohida belgilanadi.
  </p>

  <!-- Yuqoridagi blok bilan bir xil ko'rinishda: sahifada ikki xil uslubdagi
       bitta taklif chalkashtiradi. Matni boshqa — pastga yetib kelgan
       o'quvchi allaqachon qiziqqan, unga aniqroq va'da beramiz. -->
  <aside class="tgcta">
    <div class="tgcta-text">
      <b>Kanalda ham bor</b>
      <span>Kunning eng muhim xabarlari va har kuni ertalab dayjest —
      hammasi o'zbek tilida.</span>
    </div>
    <a href="https://t.me/${SITE.telegram}" target="_blank" rel="noopener">@${SITE.telegram}</a>
  </aside>

  <section class="sources">
    <div class="sources-label">Bugungi manbalar</div>
    <div class="sources-list">${sources.slice(0, 12).map((s) => `<span>${esc(s)}</span>`).join("")}${
      sources.length > 12 ? `<a class="sources-more" href="/haqida/">yana ${sources.length - 12} ta</a>` : ""
    }</div>
  </section>
${foot(now)}`;
}
