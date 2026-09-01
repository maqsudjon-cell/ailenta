// collect.mjs — barcha manbalardan xom xabarlarni yig'adi.
// Tashqi kutubxona ishlatmaydi: Node 20+ dagi fetch va oddiy XML parser yetarli.
//
// Chiqish: data/raw.json — [{ id, title, url, source, sourceName, published, summary, weight, points }]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (compatible; AiLentaBot/1.0; +https://ai.maqsudjon.com)";
const TIMEOUT = 20_000;

// ---------- kichik yordamchilar ----------

const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#8217": "’", "#8216": "‘", "#8220": "“",
  "#8221": "”", "#8211": "–", "#8212": "—", "#160": " ",
};

function decode(str = "") {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e.toLowerCase().startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

const stripTags = (s = "") => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// Kuzatuv parametrlarini olib tashlab, URL'ni bir xil ko'rinishga keltiradi.
export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref|source|fbclid|gclid|oc$|hl$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

// ---------- RSS / Atom ----------

function parseFeed(xml, src) {
  const out = [];
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];

  for (const b of blocks) {
    const title = stripTags(tag(b, "title"));
    if (!title) continue;

    // Atom: <link href="..."/>, RSS: <link>...</link>
    let link = tag(b, "link");
    if (!link || link.startsWith("<")) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
        || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decode(alt[1]) : "";
    }
    if (!link) link = stripTags(tag(b, "guid"));
    if (!/^https?:/i.test(link)) continue;

    const published = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const summary = stripTags(
      tag(b, "description") || tag(b, "summary") || tag(b, "content") || tag(b, "content:encoded")
    ).slice(0, 900);

    const url = normalizeUrl(link);
    out.push({
      id: hash(url),
      title,
      url,
      source: src.id,
      sourceName: src.name,
      published: published ? new Date(published).toISOString() : new Date().toISOString(),
      summary,
      weight: src.weight ?? 1,
      primary: !!src.primary,
      local: !!src.local,
    });
  }
  return src.cap ? out.slice(0, src.cap) : out;
}

// ---------- Hacker News ----------

async function collectHN(cfg) {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const q = new URLSearchParams({
    tags: "story",
    numericFilters: `created_at_i>${since},points>${cfg.minPoints ?? 40}`,
    hitsPerPage: "60",
  });
  const json = JSON.parse(await get(`https://hn.algolia.com/api/v1/search_by_date?${q}`));

  return (json.hits || [])
    .filter((h) => h.url && h.title)
    .map((h) => {
      const url = normalizeUrl(h.url);
      return {
        id: hash(url),
        title: h.title,
        url,
        source: "hackernews",
        sourceName: cfg.name,
        published: new Date(h.created_at).toISOString(),
        summary: "",
        weight: cfg.weight ?? 3,
        points: h.points,
        discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      };
    });
}

// ---------- Google News ----------

async function collectGoogleNews(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q.q + " when:2d")}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await get(url);
  return parseFeed(xml, q).map((it) => {
    // Google News sarlavhasi "Sarlavha - Nashr" ko'rinishida keladi.
    // Nashr nomida ham chiziqcha bo'lishi mumkin (tech-insider.org), shuning
    // uchun oxirgi ajratgichdan bo'lamiz.
    const cut = it.title.lastIndexOf(" - ");
    if (cut > 10 && it.title.length - cut < 45) {
      it.sourceName = it.title.slice(cut + 3).trim();
      it.title = it.title.slice(0, cut).trim();
    }
    return it;
  });
}

// ---------- asosiy ----------

async function main() {
  const cfg = JSON.parse(await readFile(join(ROOT, "sources.json"), "utf8"));
  const jobs = [];

  for (const f of cfg.feeds) {
    jobs.push(
      get(f.url).then((xml) => parseFeed(xml, f)).catch((e) => {
        console.error(`  ✗ ${f.id}: ${e.message}`);
        return [];
      })
    );
  }
  for (const q of cfg.googleNews || []) {
    jobs.push(collectGoogleNews(q).catch((e) => {
      console.error(`  ✗ ${q.id}: ${e.message}`);
      return [];
    }));
  }
  if (cfg.hackernews) {
    jobs.push(collectHN(cfg.hackernews).catch((e) => {
      console.error(`  ✗ hackernews: ${e.message}`);
      return [];
    }));
  }

  const results = await Promise.all(jobs);
  const all = results.flat();

  // Faqat oxirgi 3 kun. OpenAI va Hugging Face feedlari butun arxivni beradi.
  const cutoff = Date.now() - (cfg.maxAgeHours ?? 72) * 3600_000;
  const blocked = new RegExp(`\\b(${(cfg.blockDomains || []).join("|")})\\b`, "i");

  const items = all.filter((it) => {
    const t = Date.parse(it.published);
    if (!Number.isFinite(t) || t < cutoff) return false;
    if (cfg.blockDomains?.length && blocked.test(it.sourceName)) return false;
    return true;
  });

  // Google News so'rovidan kelgan xabarga so'rovning emas, nashrning obro'si beriladi.
  for (const it of items) {
    if (!it.source.startsWith("gn-")) continue;
    it.weight = cfg.publishers?.[it.sourceName] ?? 1;
    if (it.local) it.weight += 3;
    // Google News havolasi asl maqolaga emas, o'zining qayta yo'naltirish
    // sahifasiga olib boradi. Bunday xabar tasdiq uchun yaraydi, lekin
    // saytda manba sifatida ko'rsatilmaydi.
    it.indirect = true;
  }

  // Bitta URL bir necha manbadan kelishi mumkin — eng og'irini qoldiramiz.
  const byUrl = new Map();
  for (const it of items) {
    const cur = byUrl.get(it.url);
    if (!cur || it.weight > cur.weight) byUrl.set(it.url, it);
  }
  const unique = [...byUrl.values()].sort((a, b) => b.published.localeCompare(a.published));

  await mkdir(join(ROOT, "data"), { recursive: true });
  await writeFile(join(ROOT, "data/raw.json"), JSON.stringify(unique, null, 2));

  const perSource = {};
  for (const it of unique) perSource[it.sourceName] = (perSource[it.sourceName] || 0) + 1;
  console.log(`Yig'ildi: ${unique.length} ta yangi (${all.length} xom, ${all.length - items.length} eski yoki bloklangan)`);
  for (const [k, v] of Object.entries(perSource).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(v).padStart(3)}  ${k}`);
  }
}

main();
