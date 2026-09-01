// pages.mjs — xabar, mavzu, kun va arxiv sahifalari.

import { SITE, head, topbar, foot, publisher } from "./shell.mjs";
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
    title: `${p.title} — ${SITE.name}`,
    description: p.summary,
    path: `/x/${p.slug}/`,
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
