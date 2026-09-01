// pages.mjs — xabar, mavzu, kun va arxiv sahifalari.

import { SITE, head, topbar, foot, publisher, pageTitle, clampDesc } from "./shell.mjs";
import { coverBar, sourceMark, tagChips, listItem, crumbs, tagPath } from "./parts.mjs";

// ---------- bitta xabar ----------

export function postPage(p, related, u) {
  const { tashkent, ago, esc } = u;
  const now = tashkent(new Date().toISOString());
  const t = tashkent(p.published);

  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: p.title,
      description: p.summary,
      datePublished: p.published,
      dateModified: p.created || p.published,
      inLanguage: "uz",
      url: `${SITE.url}/x/${p.slug}/`,
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE.url}/x/${p.slug}/` },
      publisher,
      image: `${SITE.url}/og/${p.slug}.png`,
      isBasedOn: p.source.url,
      citation: [p.source.name, ...(p.also || []).map((a) => (typeof a === "string" ? a : a.name))].map((n) => ({
        "@type": "CreativeWork",
        publisher: { "@type": "Organization", name: n },
      })),
      keywords: (p.tags || []).join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Bosh sahifa", item: SITE.url },
        { "@type": "ListItem", position: 2, name: `${t.day}-${t.month}`, item: `${SITE.url}/kun/${t.ymd}/` },
        { "@type": "ListItem", position: 3, name: p.title },
      ],
    },
  ];

  // Eski xabarlarda `also` faqat nomlar ro'yxati, yangilarida havola bilan.
  // Havolasi yo'qini havola qilib ko'rsatmaymiz.
  const outlets = (p.also || [])
    .map((a) => (typeof a === "string" ? { name: a } : a))
    .filter((a) => a && a.name && a.name !== p.source.name);

  return `${head({
    title: pageTitle(p.title),
    description: p.summary,
    path: `/x/${p.slug}/`,
    image: `/og/${p.slug}.png`,
    article: { published: p.published, modified: p.created, tags: p.tags },
    jsonld,
  })}
${topbar(now.hhmm)}

<div class="wrap">
  ${crumbs([
    { label: "Bosh sahifa", href: "/" },
    { label: `${t.day}-${t.month}`, href: `/kun/${t.ymd}/` },
  ], u)}

  <article class="article">
    <span class="eyebrow">Xabar</span>
    <h1>${esc(p.title)}</h1>
    <p class="lede">${esc(p.summary)}</p>
    ${p.photo ? `
    <figure class="hero-photo">
      <img src="${esc(p.photo.src)}" alt="${esc(p.photo.entity)} — arxiv surati" width="1200" height="675" loading="lazy" decoding="async">
      <figcaption class="credit">
        Arxiv surati · ${esc(p.photo.author)} ·
        <a href="${esc(p.photo.page)}" target="_blank" rel="noopener nofollow">${esc(p.photo.license)}</a>,
        Wikimedia Commons
      </figcaption>
    </figure>` : ""}
    <div class="meta">
      ${sourceMark(p, u)}
      ${p.coverage > 1 ? coverBar(p.coverage) : ""}
      <span class="when-inline">${t.day}-${t.month}, ${t.hhmm} · ${ago(p.published)}</span>
      ${tagChips(p, u)}
    </div>
  </article>

  <section class="outlets">
    <h2>Manba</h2>
    <ul>
      <li><a href="${esc(p.source.url)}" target="_blank" rel="noopener nofollow">
        ${esc(p.source.name)} — asl maqola${p.source.indirect ? " (Google News orqali)" : ""}
      </a></li>
    </ul>
    ${outlets.length ? `
    <h2 style="margin-top:1.4rem">Bu voqea haqida yana kim yozdi</h2>
    <ul>${outlets
      .map((a) =>
        a.url
          ? `<li><a href="${esc(a.url)}" target="_blank" rel="noopener nofollow">${esc(a.name)}</a></li>`
          : `<li><span class="outlet-plain">${esc(a.name)}</span></li>`
      )
      .join("")}</ul>` : ""}
    <p>
      Sarlavha va xulosa asl maqola asosida sun'iy intellekt yordamida o'zbekchada
      tayyorlangan. To'liq matnni manbadan o'qing.
    </p>
  </section>

  <div class="share">
    <span class="share-label">Ulashish</span>
    <a class="primary" href="https://t.me/share/url=${encodeURIComponent(`${SITE.url}/x/${p.slug}/`)}&text=${encodeURIComponent(p.title)}"
       target="_blank" rel="noopener">Telegram</a>
    <a href="https://wa.me/?text=${encodeURIComponent(`${p.title} — ${SITE.url}/x/${p.slug}/`)}"
       target="_blank" rel="noopener">WhatsApp</a>
    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(`${SITE.url}/x/${p.slug}/`)}&text=${encodeURIComponent(p.title)}"
       target="_blank" rel="noopener">X</a>
    <button type="button" class="copy" data-url="${SITE.url}/x/${p.slug}/">Havolani nusxalash</button>
  </div>

  <div class="follow">
    <p><b>Har uch soatda yangilanadi.</b> Kunning eng muhim xabarlari Telegram kanalida ham chiqadi.</p>
    <a href="https://t.me/${SITE.telegram}" target="_blank" rel="noopener">@${SITE.telegram}</a>
  </div>

  ${related.length ? `
  <section class="related">
    <h2>Shu mavzuda</h2>
    ${related.map((r) => listItem(r, u)).join("")}
  </section>` : ""}
${foot(now)}`;
}

// ---------- ro'yxat sahifasi (mavzu, kun, arxiv) ----------

export function listPage({ title, heading, intro, path, items, trail, extra = "", noindex = false }, u) {
  const { tashkent, esc } = u;
  const now = tashkent(new Date().toISOString());

  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: heading,
      description: intro,
      url: `${SITE.url}${path}`,
      inLanguage: "uz",
      publisher,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: items.slice(0, 50).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE.url}/x/${p.slug}/`,
        name: p.title,
      })),
    },
  ];

  return `${head({ title, description: intro, path, jsonld, noindex })}
${topbar(now.hhmm)}

<div class="wrap">
  ${crumbs(trail, u)}

  <div class="listing-head">
    <h1>${esc(heading)}</h1>
    ${intro ? `<p>${esc(intro)}</p>` : ""}
  </div>

  <section class="listing">
    ${items.length
      ? items.map((p) => listItem(p, u)).join("")
      : `<p class="note">Bu sahifada hozircha xabar yo'q.</p>`}
  </section>

  ${extra}
${foot(now)}`;
}

// ---------- suratlar va litsenziyalar ----------
//
// Erkin litsenziyalar muallif va litsenziya ko'rsatilishini talab qiladi.
// Har bir suratning tagida yozuv bor, bu sahifa esa hammasini bir joyga yig'adi.
export function photosPage(cache, u) {
  const { tashkent, esc } = u;
  const now = tashkent(new Date().toISOString());
  const rows = Object.entries(cache).sort((a, b) => a[0].localeCompare(b[0]));

  return `${head({
    title: `Suratlar va litsenziyalar — ${SITE.name}`,
    description: "Saytdagi suratlar Wikimedia Commons'dan erkin litsenziya bilan olingan. "
      + "Har birining muallifi va litsenziyasi shu sahifada ko'rsatilgan.",
    path: "/rasmlar/",
  })}
${topbar(now.hhmm)}

<div class="wrap">
  ${crumbs([{ label: "Bosh sahifa", href: "/" }, { label: "Suratlar" }], u)}

  <div class="listing-head">
    <h1>Suratlar va litsenziyalar</h1>
    <p>
      Saytdagi suratlar boshqa nashrlardan olinmaydi — ular birovning mulki.
      Bu yerdagi barcha surat Wikimedia Commons'dan, erkin litsenziya bilan.
      Mos surat topilmagan xabarda kod bilan chizilgan muqova turadi.
    </p>
  </div>

  <div class="scroll" style="margin-top:1.6rem">
    <table>
      <thead><tr><th>Mavzu</th><th>Muallif</th><th>Litsenziya</th><th>Manba</th></tr></thead>
      <tbody>
        ${rows.map(([key, c]) => `<tr>
          <td><img src="${esc(c.thumb || c.src)}" width="40" height="40" alt="" loading="lazy"
               style="border-radius:4px;object-fit:cover;vertical-align:middle;margin-right:.6rem">${esc(key)}</td>
          <td>${esc(c.author)}</td>
          <td>${esc(c.license)}</td>
          <td><a href="${esc(c.page)}" target="_blank" rel="noopener nofollow">Commons</a></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
${foot(now)}`;
}

// ---------- topilmadi ----------
//
// GitHub Pages mavjud bo'lmagan manzilda shu faylni ko'rsatadi. Bo'sh oq
// sahifa o'rniga o'quvchini kerakli joyga yo'naltiramiz.
export function notFoundPage(latest, u) {
  const { tashkent, esc } = u;
  const now = tashkent(new Date().toISOString());
  return `${head({
    title: `Sahifa topilmadi — ${SITE.name}`,
    description: "Bunday sahifa yo'q. Bosh sahifadan so'nggi sun'iy intellekt yangiliklarini o'qing.",
    path: "/404.html",
    noindex: true,
  })}
${topbar(now.hhmm)}

<div class="wrap">
  <div class="listing-head">
    <h1>Bunday sahifa yo'q</h1>
    <p>Havola eskirgan yoki manzilda xato bo'lishi mumkin. Quyidagilardan boshlang.</p>
  </div>

  <div class="tagcloud" style="padding-top:1.6rem">
    <a href="/">Bosh sahifa</a>
    <a href="/arxiv/">Arxiv</a>
    <a href="/mavzular/">Mavzular</a>
    <a href="/rss.xml">RSS</a>
  </div>

  <section class="related" style="padding-top:2.4rem">
    <h2>So'nggi xabarlar</h2>
    ${latest.slice(0, 5).map((p) => listItem(p, u)).join("")}
  </section>
${foot(now)}`;
}

// ---------- mavzular ro'yxati ----------

export function topicsPage(tags, u) {
  const { esc } = u;
  const cloud = `<div class="tagcloud">${tags
    .map(([t, n]) => `<a href="${tagPath(t)}">${esc(t)}<b>${n}</b></a>`)
    .join("")}</div>`;

  return listPage(
    {
      title: `Mavzular — ${SITE.name}`,
      heading: "Mavzular",
      intro: `${tags.length} ta mavzu bo'yicha xabarlar. Har bir mavzu sahifasi o'zi to'lib boradi.`,
      path: "/mavzular/",
      items: [],
      trail: [{ label: "Bosh sahifa", href: "/" }, { label: "Mavzular" }],
      extra: cloud,
    },
    u
  );
}
