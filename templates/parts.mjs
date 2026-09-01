import { thumbSvg, cardSvg } from "../src/cover.mjs";

// parts.mjs — sahifalar orasida takrorlanadigan bo'laklar.
// Bosh sahifa, xabar sahifasi, mavzu va kun sahifalari shularni ishlatadi.

export const slugTag = (t) =>
  String(t).toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const tagPath = (t) => `/mavzu/${slugTag(t)}/`;

// Qamrov chizig'i: 1 ta nashr = eng qisqa, 12+ = to'liq.
export function coverBar(n) {
  const pct = Math.min(100, Math.round((Math.min(n, 12) / 12) * 100));
  return `<span class="cover" title="${n} ta nashr bu voqea haqida yozdi">
      <span class="cover-track"><span class="cover-fill" style="width:${pct}%"></span></span>
      <span class="cover-n">${n} nashr</span>
    </span>`;
}

export const tagChips = (p, u) =>
  (p.tags || [])
    .map((t) => `<a class="chip" href="${tagPath(t)}">${u.esc(t)}</a>`)
    .join("");

export const sourceMark = (p, u) => `
    <span class="pub">${u.esc(p.source.name)}</span>
    ${p.source.indirect ? `<span class="viamark">${u.esc(u.via(p))}</span>` : ""}`;

// Haqiqiy surat bo'lsa o'shani, bo'lmasa kod bilan chizilgan katakni ko'rsatamiz.
export function itemThumb(p, u) {
  const inner = p.photo
    ? `<img class="thumb card photo" src="${u.esc(p.photo.thumb || p.photo.src)}" width="220" height="147" loading="lazy" decoding="async" alt="">`
    : cardSvg(p, 220, 147);
  return `<a class="item-thumb" href="/x/${u.esc(p.slug)}/" aria-hidden="true" tabindex="-1">${inner}</a>`;
}

export const tier = (p) => (p.importance >= 5 ? "t1" : p.importance === 4 ? "t2" : "t3");

// Oqimdagi bitta qator.
export function feedItem(p, u) {
  const t = u.tashkent(p.published);
  return `
    <article class="item ${tier(p)}">
      <time class="when" datetime="${u.esc(p.published)}">${t.hhmm}</time>
      <div class="item-body">
        <h3><a href="/x/${u.esc(p.slug)}/">${u.esc(p.title)}</a></h3>
        <p>${u.esc(p.summary)}</p>
        <div class="meta">
          ${sourceMark(p, u)}
          ${p.coverage > 1 ? coverBar(p.coverage) : ""}
          ${tagChips(p, u)}
        </div>
      </div>
      ${itemThumb(p, u)}
    </article>`;
}

// Ro'yxat sahifalarida (mavzu, kun, arxiv) ishlatiladigan qator — sanasi bilan.
export function listItem(p, u) {
  const t = u.tashkent(p.published);
  return `
    <article class="item ${tier(p)}">
      <time class="when" datetime="${u.esc(p.published)}">${t.day}-${t.month.slice(0, 3)}<br>${t.hhmm}</time>
      <div class="item-body">
        <h3><a href="/x/${u.esc(p.slug)}/">${u.esc(p.title)}</a></h3>
        <p>${u.esc(p.summary)}</p>
        <div class="meta">
          ${sourceMark(p, u)}
          ${p.coverage > 1 ? coverBar(p.coverage) : ""}
          ${tagChips(p, u)}
        </div>
      </div>
      ${itemThumb(p, u)}
    </article>`;
}

export function crumbs(trail, u) {
  return `<nav class="crumbs" aria-label="Yo'l">
    ${trail
      .map((c, i) =>
        (i ? '<span aria-hidden="true">/</span>' : "") +
        (c.href ? `<a href="${c.href}">${u.esc(c.label)}</a>` : `<span>${u.esc(c.label)}</span>`)
      )
      .join("")}
  </nav>`;
}
