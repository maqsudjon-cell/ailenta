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
// Kuniga 5 ta alohida post, kun bo'yi tarqatilgan. Kunlik yakun alohida
// dayjest posti bilan chiqadi (src/digest.mjs, kechqurun).
//
// Ilgari bu yerda "to'plam" posti ham bor edi — muhim xabarlarning
// hammasini bir postga yig'ib yuborardi. U olib tashlandi: alohida
// postlar o'qilishi va ko'rinishi bo'yicha ancha ustun, kunlik yakun
// esa dayjestda baribir beriladi.
const TOP_PER_DAY = Number(process.env.TELEGRAM_TOP_PER_DAY || 5);
const TOP_GAP_MIN = Number(process.env.TELEGRAM_TOP_GAP_MIN || 150);
const PER_RUN = Number(process.env.TELEGRAM_PER_RUN || 1);

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

  let ok = 0;

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

  if (ok) {
    await writeFile(
      join(ROOT, "data/telegram-sent.json"),
      JSON.stringify(sent.slice(-3000), null, 2)
    );
  }

  const left = queue.filter((p) => !sentSet.has(p.slug)).length;
  console.log(
    `Telegram: ${ok} ta yuborildi · bugun ${topToday + ok}/${TOP_PER_DAY} · ` +
    `navbatda ${left} ta (kunlik yakun dayjestda chiqadi)`
  );
}

main();
