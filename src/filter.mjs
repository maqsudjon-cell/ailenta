// filter.mjs — xom xabarlarni tozalaydi, takrorlarni tashlaydi, muhimini tanlaydi.
//
// Kirish:  data/raw.json, data/seen.json
// Chiqish: data/clusters.json — LLM'ga beriladigan tayyor klasterlar

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_PER_RUN = 14;
const CLUSTER_MIN = 0.26;   // bundan past o'xshashlik — boshqa voqea

// Sarlavhada uchrasa, mavzu AI ekaniga ishonch beradi.
const AI_TERMS = [
  "ai", "a.i.", "artificial intelligence", "machine learning", "llm", "gpt", "chatgpt",
  "claude", "gemini", "anthropic", "openai", "deepmind", "mistral", "llama", "qwen",
  "neural", "transformer", "model", "agent", "agentic", "inference", "training",
  "deepseek", "copilot", "midjourney", "diffusion", "chatbot", "robot", "humanoid",
  "nvidia", "gpu", "datacenter", "data center", "hugging face", "grok", "xai",
  "sun'iy intellekt", "sun’iy intellekt", "suniy intellekt",
];

// Bular yangilik emas — reklama, ro'yxat, birja shovqini.
const JUNK = [
  /\bdeal(s)?\b.*\b(off|save|discount|price)\b/i,
  /\b(best|top)\s+\d+\b/i,
  /\bcoupon|black friday|prime day\b/i,
  /\b(stock|shares|nasdaq|nyse|price target|earnings call|q[1-4] results)\b/i,
  /\bhoroscope|lottery|sports?\b/i,
  /\bwhy .* is a (buy|sell)\b/i,
  /^watch\b/i,            // Bloomberg TV lavhalari — maqola emas
  /\| bloomberg tech\b/i,
];

// Nashrlar sarlavhaga qo'shadigan xizmat belgilari.
const cleanTitle = (t) =>
  t.replace(/^(exclusive|analysis|update \d+|breaking|opinion|explainer)\s*[|:-]\s*/i, "")
   .replace(/\s*[|—–-]\s*(bloomberg|reuters|cnbc|the verge|techcrunch)[^|]*$/i, "")
   .trim();

const STOP = new Set(
  ("a an the of for to in on at by with from and or as is are was were be been it its this that " +
   "new now says say said after before over under into out up down more most than what how why " +
   "will can could would should may might s t re ve ll amid could you your our their his her")
    .split(" ")
);

const norm = (s) =>
  s.toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "sue"/"sued", "song"/"songs" bir xil so'z sanalsin.
function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

const tokens = (s) =>
  new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem));

function overlap(a, b) {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared;
}

// Har bir so'zning og'irligi — qanchalik kam uchrasa, shuncha ko'p ma'no beradi.
// Bugun "anthropic" o'nlab sarlavhada bor, "mediatek" esa bir voqeada. Shuning
// uchun umumiy so'zlarni sanash yetarli emas: og'irlik bilan solishtiramiz.
function buildIdf(docs) {
  const df = new Map();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) || 0) + 1);
  const n = docs.length;
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log(n / (c + 1)) + 1);
  return idf;
}

function vectorize(toks, idf) {
  const v = new Map();
  let sq = 0;
  for (const t of toks) {
    const w = idf.get(t) ?? 1;
    v.set(t, w);
    sq += w * w;
  }
  return { v, norm: Math.sqrt(sq) || 1 };
}

function cosine(a, b) {
  const [small, big] = a.v.size < b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small.v) {
    const o = big.v.get(t);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}

// Klaster markazi — a'zolar vektorlarining o'rtachasi. Yangi xabar ayni shu
// markazga solishtiriladi: bitta chetdagi a'zo orqali zanjirlanish bo'lmaydi,
// lekin bir voqeaning turli xil yozilgan sarlavhalari baribir topiladi.
function centroidOf(vecs) {
  const sum = new Map();
  for (const { v } of vecs) {
    for (const [t, w] of v) sum.set(t, (sum.get(t) || 0) + w);
  }
  let sq = 0;
  for (const [t, w] of sum) {
    const avg = w / vecs.length;
    sum.set(t, avg);
    sq += avg * avg;
  }
  return { v: sum, norm: Math.sqrt(sq) || 1 };
}

function aiScore(item) {
  const hay = ` ${norm(item.title)} ${norm(item.summary || "")} `;
  let hits = 0;
  for (const term of AI_TERMS) if (hay.includes(` ${term} `)) hits++;
  return hits;
}

function scoreCluster(c) {
  const lead = c.items[0];
  let s = 0;
  s += lead.weight * 4;                       // manba ishonchi
  s += Math.min(c.items.length - 1, 4) * 6;   // nechta nashr yozgan
  s += Math.min(c.aiHits, 4) * 3;             // AI'ga aloqadorlik
  if (c.items.some((i) => i.primary)) s += 10; // birlamchi e'lon (kompaniyaning o'zi)
  if (c.items.some((i) => i.local)) s += 25;   // O'zbekistonga aloqador
  const pts = Math.max(...c.items.map((i) => i.points || 0));
  s += Math.min(pts / 25, 8);                 // HN ovozlari
  const ageH = (Date.now() - Date.parse(lead.published)) / 3600_000;
  s -= Math.max(0, ageH - 12) * 0.4;          // eskirgani uchun jarima
  return Math.round(s * 10) / 10;
}

async function readJson(p, fallback) {
  try {
    return JSON.parse(await readFile(join(ROOT, p), "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const raw = await readJson("data/raw.json", []);
  const seen = await readJson("data/seen.json", { urls: [], titles: [] });
  const seenUrls = new Set(seen.urls);
  const seenTitles = seen.titles.map((t) => tokens(t));

  const fresh = raw.filter((it) => {
    if (seenUrls.has(it.url)) return false;
    if (JUNK.some((re) => re.test(it.title))) return false;
    return tokens(it.title).size >= 2;
  });

  // AI'ga aloqasi bo'lmaganlarni tashlaymiz.
  const scored = fresh
    .map((it) => {
      it.title = cleanTitle(it.title);
      return { it, aiHits: aiScore(it), toks: tokens(it.title) };
    })
    .filter((x) => x.aiHits > 0);

  const idf = buildIdf(scored.map((x) => x.toks));
  for (const x of scored) x.vec = vectorize(x.toks, idf);

  // Bir voqea haqidagi turli xabarlarni bitta klasterga yig'amiz.
  // Solishtirish faqat klaster *urug'i* bilan bo'ladi. Agar har bir a'zo bilan
  // solishtirsak, A~B va B~C bo'lgani uchun aloqasiz A va C bir klasterga
  // tushib qoladi — zanjirlanish. Urug' bilan solishtirish buni to'xtatadi.
  let clusters = [];
  for (const x of scored) {
    let best = null;
    let bestSim = CLUSTER_MIN;
    for (const c of clusters) {
      if (overlap(c.toks, x.toks) < 2) continue;
      const sim = cosine(c.centroid, x.vec);
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best) {
      best.members.push(x);
      best.aiHits = Math.max(best.aiHits, x.aiHits);
      best.centroid = centroidOf(best.members.map((m) => m.vec));
      for (const t of x.toks) best.toks.add(t);
    } else {
      clusters.push({ members: [x], aiHits: x.aiHits, centroid: x.vec, toks: new Set(x.toks) });
    }
  }

  // Voqea allaqachon chiqqanmi? Klasterning istalgan a'zosi ilgari nashr
  // etilgan sarlavhaga o'xshasa — bu o'sha voqea, boshqa nashrning so'zi bilan.
  const alreadyPublished = (c) =>
    c.members.some((m) =>
      seenTitles.some((prev) => overlap(m.toks, prev) / Math.min(m.toks.size, prev.size || 1) >= 0.5)
    );

  const repeats = clusters.filter(alreadyPublished).length;
  clusters = clusters.filter((c) => !alreadyPublished(c));

  for (const c of clusters) {
    c.items = c.members.map((m) => m.it);
    delete c.members;
    delete c.centroid;
    delete c.toks;
    // Eng ishonchli manba klasterning boshida tursin.
    // Bosh manba: avvalo havolasi asl maqolaga olib boradigani, keyin obro'lisi.
    const rank = (x) => (x.indirect ? 0 : 40) + x.weight + (x.primary ? 5 : 0);
    c.items.sort((a, b) => rank(b) - rank(a));
    c.score = scoreCluster(c);
  }

  clusters.sort((a, b) => b.score - a.score);
  const picked = clusters.slice(0, MAX_PER_RUN);

  await writeFile(join(ROOT, "data/clusters.json"), JSON.stringify(picked, null, 2));

  console.log(`Xom: ${raw.length} → yangi: ${fresh.length} → AI: ${scored.length} → klaster: ${clusters.length + repeats} (${repeats} tasi takror) → tanlandi: ${picked.length}\n`);
  for (const c of picked) {
    const lead = c.items[0];
    console.log(`  [${String(c.score).padStart(5)}] ${lead.sourceName}${c.items.length > 1 ? ` +${c.items.length - 1}` : ""}`);
    console.log(`          ${lead.title.slice(0, 88)}`);
  }
}

main();
