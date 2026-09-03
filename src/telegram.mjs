// telegram.mjs — shu yugurishda saytga chiqqan xabarlarni kanalga yuboradi.
//
// Kerakli sozlamalar (GitHub secrets):
//   TELEGRAM_BOT_TOKEN — @BotFather bergan token
//   TELEGRAM_CHAT_ID   — kanal manzili (@kanal_nomi) yoki raqamli id
//
// Kalit yo'q bo'lsa jimgina to'xtaydi — quvurning qolgan qismi ishlayveradi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const PAUSE = 1500; // Telegram kanalga soniyasiga bir nechta xabar yuborishni cheklaydi

// Kanalga faqat muhim xabarlar darhol chiqadi. Qolganlari saytda turadi va
// ertalabki dayjestga tushadi — aks holda kanal kuniga 30 ta post bilan to'ladi.
const MIN_IMPORTANCE = Number(process.env.TELEGRAM_MIN_IMPORTANCE || 4);

// Kanal tezligi. Jadval kuniga 8 martadan ~30 martaga chiqqach, kuniga 25 ta
// xabar keta boshladi — obunachi uchun bu juda ko'p.
//
// Chegarani ko'tarish yordam bermaydi: LLM eng yuqori baho sifatida 4 qo'yadi,
// 5 hech qachon chiqmaydi. Ya'ni MIN_IMPORTANCE=5 kanalni butunlay jimitardi.
// Shuning uchun muhimlik emas, TEZLIK cheklanadi.
// Kanal ikki xil post chiqaradi.
//
// Sabab: kuniga ~100 xabar chiqadi, ulardan ~25 tasi muhimlik 4. Har birini
// alohida post qilsak kanal yashab qolmaydi; chegara qo'ysak esa yaxshi
// xabarlar navbatda eskirib yo'qoladi (o'lchandi: chegara 8 bo'lganda
// 24 ta xabar navbatda qolib ketgan).
//
// Yechim — hajmni emas, SHAKLNI o'zgartirish:
//   1. Eng muhimlari  → alohida post, rasm va xulosa bilan
//   2. Qolganlari     → bir necha soatda bir marta bitta TO'PLAM posti
//
// Shunda muhim xabarlarning hammasi kanalga yetib boradi, lekin post soni
// kuniga ~10 tadan oshmaydi.
const TOP_PER_DAY = Number(process.env.TELEGRAM_TOP_PER_DAY || 6);
const TOP_GAP_MIN = Number(process.env.TELEGRAM_TOP_GAP_MIN || 75);
const PER_RUN = Number(process.env.TELEGRAM_PER_RUN || 1);

const ROUNDUP_EVERY_MIN = Number(process.env.TELEGRAM_ROUNDUP_EVERY_MIN || 200);
const ROUNDUP_MIN = Number(process.env.TELEGRAM_ROUNDUP_MIN || 3);
const ROUNDUP_MAX = Number(process.env.TELEGRAM_ROUNDUP_MAX || 12);

const MAX_AGE_HOURS = Number(process.env.TELEGRAM_MAX_AGE_HOURS || 30);

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Teg Telegramda hashtag bo'lib ketadi: bo'shliq va apostrof olib tashlanadi.
const hashtag = (t) =>
  "#" + String(t).replace(/[’'`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/_+$/, "");

function message(p) {
  const tags = (p.tags || []).map(hashtag).join(" ");
  const lines = [
    `<b>${esc(p.title)}</b>`,
    "",
    esc(p.summary),
    "",
    `<a href="${esc(p.source.url)}">${esc(p.source.name)}</a>` +
      (p.coverage > 1 ? ` · ${p.coverage} nashr yozdi` : ""),
    `<a href="${SITE.url}/x/${esc(p.slug)}/">Saytda o'qish</a>`,
  ];
  if (tags) lines.push("", tags);
  // Post boshqa joyga uzatilganda kanal manzili u bilan birga ketsin —
  // o'qigan odam qayerdan kelganini biladi va bosib qo'shila oladi.
  lines.push("", `@${SITE.telegram}`);
  return lines.join("\n");
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${res.status}`);
  return j.result;
}

// Rasm bilan yuboriladi — kanalda faqat matn turgani zerikarli ko'rinadi.
//
// Rasm URL bilan emas, fayl bo'lib yuboriladi: bu qadam saytga chiqishdan
// oldin ishlaydi, ya'ni havola hali mavjud emas va Telegram uni yuklab
// ololmaydi ("failed to get HTTP URL content").
// ---------- to'plam posti ----------
//
// Birinchi variant oddiy nuqtali ro'yxat edi va zerikarli chiqdi: 12 ta
// bir xil ko'rinishdagi qator, manba nomi alohida qatorda joy yeydi,
// ko'z hech narsaga ilashmaydi.
//
// Endi xabarlar mavzu bo'yicha guruhlanadi va har biri BITTA qatorda
// turadi. Mahalliy xabarlar eng tepada: o'zbek o'quvchisi uchun eng
// qimmatli farq shu, uni ro'yxat o'rtasida ko'mib yuborish bema'nilik.
const UZ_SOURCES = new Set(["Pivot", "Spot.uz", "Daryo", "Gazeta.uz", "Kun.uz", "UzDaily", "Review.uz"]);

// Tartib muhim: ro'yxat yuqoridan pastga shu ketma-ketlikda chiqadi.
const GROUPS = [
  { key: "uz",       label: "O'ZBEKISTON",   emoji: "🇺🇿" },
  { key: "xavf",     label: "XAVFSIZLIK",    emoji: "🔐", tags: ["xavfsizlik", "maxfiylik"] },
  { key: "siyosat",  label: "SIYOSAT",       emoji: "⚖️", tags: ["siyosat", "qonun", "sud", "tartibga solish"] },
  { key: "biznes",   label: "BIZNES",        emoji: "💼", tags: ["biznes", "iqtisod", "ipo", "mehnat bozori", "investitsiya"] },
  { key: "model",    label: "MODELLAR",      emoji: "🧠", tags: ["tadqiqot", "agentlar", "chatbot"] },
  { key: "temir",    label: "CHIP VA BULUT", emoji: "⚙️", tags: ["chiplar", "bulut", "ma'lumotlar markazi", "robototexnika"] },
  { key: "jamiyat",  label: "JAMIYAT",       emoji: "🏥", tags: ["tibbiyot", "ta'lim", "jamiyat", "madaniyat"] },
  // Ko'p xabar FAQAT kompaniya nomi bilan teglanadi (masalan [Meta] yoki
  // [Nvidia, Hugging Face]) — mavzu tegi umuman bo'lmaydi, chunki xabar
  // aynan o'sha kompaniya haqida. Ular oxirgi guruhga tushadi, aks holda
  // "qolganlari" ro'yxatning yarmini egallab ketardi.
  { key: "kompaniya", label: "KOMPANIYALAR", emoji: "🏢", tags: [
    "anthropic", "openai", "google", "meta", "nvidia", "microsoft", "apple",
    "hugging face", "amazon", "xai", "mistral", "deepseek", "salesforce",
    "oracle", "tesla", "ibm", "qualcomm", "amd", "intel", "samsung",
  ] },
];
const OTHER = { label: "QOLGANLARI", emoji: "📌" };

function groupOf(p) {
  if (UZ_SOURCES.has(p.source.name)) return "uz";
  const tags = (p.tags || []).map((t) => String(t).toLowerCase());
  for (const g of GROUPS) {
    if (g.tags && g.tags.some((t) => tags.includes(t))) return g.key;
  }
  return "other";
}

export function roundupMessage(items, stamp) {
  const line = (p) =>
    `→ <a href="${SITE.url}/x/${esc(p.slug)}/">${esc(p.title)}</a> · <i>${esc(p.source.name)}</i>`;

  const out = [
    `⚡️ <b>Qisqacha · ${items.length} ta xabar</b>`,
    `<i>${esc(stamp)}</i>`,
  ];

  // To'rttadan kam bo'lsa guruhlash ortiqcha — sarlavhalar mazmundan
  // ko'proq joy egallab ketadi.
  if (items.length < 4) {
    out.push("", ...items.map(line));
  } else {
    const bins = new Map();
    for (const p of items) {
      const k = groupOf(p);
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(p);
    }
    // Guruh soni cheklanadi. 12 ta xabarga 8 ta sarlavha ko'p — post
    // maydalanib, sarlavhalar mazmundan ko'proq joy egallaydi. Eng katta
    // guruhlar qoladi, bittalik guruhlar oxiriga yig'iladi.
    //
    // O'zbekiston bundan mustasno: u bitta xabar bo'lsa ham o'z sarlavhasi
    // bilan chiqadi, chunki bu kanal uchun eng qimmatli farq.
    const MAX_GROUPS = 5;
    const ranked = GROUPS
      .filter((g) => bins.get(g.key)?.length)
      .sort((a, b) => (b.key === "uz") - (a.key === "uz")
        || bins.get(b.key).length - bins.get(a.key).length);
    const keep = new Set(ranked.slice(0, MAX_GROUPS).map((g) => g.key));

    for (const g of GROUPS) {
      const list = bins.get(g.key);
      if (!list || !list.length || !keep.has(g.key)) continue;
      out.push("", `${g.emoji} <b>${g.label}</b>`, ...list.map(line));
      bins.delete(g.key);
    }
    // Guruhga tushmaganlar va chegaradan chiqqan kichik guruhlar.
    const rest = [...bins.values()].flat()
      .sort((a, b) => b.published.localeCompare(a.published));
    if (rest.length) out.push("", `${OTHER.emoji} <b>${OTHER.label}</b>`, ...rest.map(line));
  }

  out.push("", `Hammasi saytda → ${SITE.url}`, `@${SITE.telegram}`);
  return out.join("\n");
}

async function sendPhotoFile(text, filePath) {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.set("chat_id", CHAT);
  form.set("caption", text);
  form.set("parse_mode", "HTML");
  form.set("photo", new Blob([bytes], { type: "image/png" }), "cover.png");

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${res.status}`);
  return j.result;
}

async function send(text, photoPath) {
  if (photoPath) {
    try {
      return await sendPhotoFile(text, photoPath);
    } catch (e) {
      console.error(`    (rasm o'tmadi: ${e.message} — matn bilan yuborilmoqda)`);
    }
  }
  return api("sendMessage", {
    chat_id: CHAT,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!TOKEN || !CHAT) {
    console.log("Telegram: TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID yo'q — o'tkazib yuborildi.");
    return;
  }

  let run;
  try {
    run = JSON.parse(await readFile(join(ROOT, "data/last-run.json"), "utf8"));
  } catch {
    console.log("Telegram: last-run.json yo'q — yuboradigan yangi xabar yo'q.");
    return;
  }

  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  // Bir marta yuborilgan xabar ikkinchi marta ketmasin.
  //
  // Fayl ilgari oddiy slug ro'yxati edi, endi har yozuvda vaqt ham bor —
  // tezlikni hisoblash uchun kerak. Eski yozuvlar ham o'qiladi.
  let raw = [];
  try {
    raw = JSON.parse(await readFile(join(ROOT, "data/telegram-sent.json"), "utf8"));
  } catch {}
  const sent = raw.map((e) => (typeof e === "string" ? { slug: e, at: null } : e));
  const sentSet = new Set(sent.map((e) => e.slug));

  const now = Date.now();
  const DAY = 86400_000;
  const since = (t) => (t ? (now - t) / 60000 : Infinity);
  const lastOf = (kind) =>
    sent.reduce((m, e) => {
      if (!e.at || (kind && e.how !== kind)) return m;
      const t = Date.parse(e.at);
      return t > m ? t : m;
    }, 0);

  const topToday = sent.filter(
    (e) => e.at && e.how !== "roundup" && now - Date.parse(e.at) < DAY
  ).length;
  const sinceTop = since(lastOf("post"));
  const sinceRoundup = since(lastOf("roundup"));

  // Navbat SHU yugurishda yozilganlar bilan cheklanmaydi. Aks holda tezlik
  // cheklovi tufayli o'tkazib yuborilgan xabar boshqa hech qachon ketmasdi:
  // keyingi yugurishda last-run.json boshqa slug'lar bilan almashadi.
  const queue = posts
    .filter((p) => !sentSet.has(p.slug))
    .filter((p) => p.importance >= MIN_IMPORTANCE)
    // Eskirgan xabarni kanalga chiqarish ma'nosiz.
    .filter((p) => now - Date.parse(p.published) < MAX_AGE_HOURS * 3600_000)
    .sort((a, b) => b.importance - a.importance || b.published.localeCompare(a.published));

  if (!queue.length) {
    console.log(`Telegram: muhimlik ${MIN_IMPORTANCE}+ bo'lgan yangi xabar yo'q.`);
    return;
  }

  let ok = 0, inRoundup = 0;

  // ---------- 1. Eng muhimlari: alohida post ----------
  if (topToday < TOP_PER_DAY && sinceTop >= TOP_GAP_MIN) {
    const budget = Math.min(PER_RUN, TOP_PER_DAY - topToday, queue.length);
    for (const p of queue.slice(0, budget)) {
      try {
        await send(message(p), join(ROOT, `docs/og/${p.slug}.jpg`));
        sent.push({ slug: p.slug, at: new Date().toISOString(), how: "post" });
        sentSet.add(p.slug);
        ok++;
        console.log(`  → ${p.title}`);
      } catch (e) {
        console.error(`  ✗ yuborilmadi: ${p.title} — ${e.message}`);
      }
      await sleep(PAUSE);
    }
  }

  // ---------- 2. Qolganlari: bitta to'plam posti ----------
  // Alohida post qilinmagan xabarlar shu yerda kanalga yetadi. Eng eskisidan
  // boshlaymiz: navbat oxirida turganlar eskirib yo'qolmasin.
  const rest = queue
    .filter((p) => !sentSet.has(p.slug))
    .sort((a, b) => a.published.localeCompare(b.published))
    .slice(0, ROUNDUP_MAX);

  if (sinceRoundup >= ROUNDUP_EVERY_MIN && rest.length >= ROUNDUP_MIN) {
    const stamp = new Date(now + 5 * 3600_000).toISOString().slice(11, 16);
    try {
      await send(roundupMessage(rest, stamp));
      const at = new Date().toISOString();
      for (const p of rest) {
        sent.push({ slug: p.slug, at, how: "roundup" });
        sentSet.add(p.slug);
      }
      inRoundup = rest.length;
      console.log(`  → to'plam: ${rest.length} ta xabar`);
    } catch (e) {
      console.error(`  ✗ to'plam yuborilmadi — ${e.message}`);
    }
  }

  if (ok || inRoundup) {
    await writeFile(
      join(ROOT, "data/telegram-sent.json"),
      JSON.stringify(sent.slice(-3000), null, 2)
    );
  }

  const left = queue.filter((p) => !sentSet.has(p.slug)).length;
  console.log(
    `Telegram: ${ok} ta alohida (bugun ${topToday + ok}/${TOP_PER_DAY})` +
    (inRoundup ? ` · to'plamda ${inRoundup} ta` : "") +
    ` · navbatda ${left} ta`
  );
}

main();
